const express = require('express');
const { exec } = require('child_process');
const os = require('os');
const dns = require('dns');
const net = require('net');
const app = express();
const port = 3001;

app.use(express.static('public'));
app.use(express.json());

// --- Helper Functions ---

// Parse Ping Output for Latency
function parsePingLatency(stdout) {
    const match = stdout.match(/time[=<]([\d\.]+)/);
    return match ? parseFloat(match[1]) : null;
}

// Get Wi-Fi Details (Windows)
function getWifiDetails() {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') return resolve(null);

        exec('netsh wlan show interfaces', (err, stdout) => {
            if (err) return resolve(null);

            // Parse Band (e.g., "Band : 5 GHz")
            const bandMatch = stdout.match(/Band\s*:\s*(.*)/i);
            const band = bandMatch ? bandMatch[1].trim() : null;

            // Parse Signal
            const signalMatch = stdout.match(/Signal\s*:\s*(.*)/i);
            const signal = signalMatch ? signalMatch[1].trim() : null;

            resolve({ band, signal });
        });
    });
}

// Map Windows Build to Version
function getWindowsVersion(release) {
    const build = parseInt(release.split('.')[2]);
    if (isNaN(build)) return release;

    // Windows 11/10 Mapping
    if (build >= 26100) return "Version 24H2";
    if (build >= 22631) return "Version 23H2";
    if (build >= 22621) return "Version 22H2";
    if (build >= 22000) return "Version 21H2 (Win 11)";
    if (build >= 19045) return "Version 22H2 (Win 10)";
    if (build >= 19044) return "Version 21H2 (Win 10)";
    if (build >= 19043) return "Version 21H1";

    return `Build ${build}`;
}

// Check port
function checkPort(port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);
        socket.on('connect', () => { socket.destroy(); resolve({ port: port, status: 'Open' }); });
        socket.on('timeout', () => { socket.destroy(); resolve({ port: port, status: 'Closed' }); });
        socket.on('error', (err) => { socket.destroy(); resolve({ port: port, status: 'Closed' }); });
        socket.connect(port, '127.0.0.1');
    });
}

// --- API Endpoints ---

app.get('/api/status', async (req, res) => {
    try {
        const wanIp = req.socket.remoteAddress;

        // Ping 8.8.8.8
        const isWindows = process.platform === "win32";
        const pingCmd = isWindows ? "ping -n 1 8.8.8.8" : "ping -c 1 8.8.8.8";

        // Execute Ping, but also run Wifi check in parallel/sequence
        exec(pingCmd, async (error, stdout, stderr) => {
            let isOnline = false;
            let latency = null;
            if (!error && stdout && (stdout.includes("Reply from") || stdout.includes("bytes from"))) {
                isOnline = true;
                latency = parsePingLatency(stdout);
            }

            // LAN IP & Connection Type Detection
            let lanIp = 'Unknown';
            let connectionType = 'Unknown';
            let wifiDetails = null;
            try {
                const nets = os.networkInterfaces();
                for (const name of Object.keys(nets)) {
                    for (const net of nets[name]) {
                        if (net.family === 'IPv4' && !net.internal) {
                            lanIp = net.address;

                            const lowerName = name.toLowerCase();
                            if (lowerName.includes('wi-fi') || lowerName.includes('wlan')) {
                                connectionType = 'Wi-Fi 📶';
                                // Fetch extra Wi-Fi info if on Windows
                                if (isWindows) wifiDetails = await getWifiDetails();
                            } else if (lowerName.includes('ethernet')) {
                                connectionType = 'Ethernet (LAN) 🔌';
                            } else {
                                connectionType = name;
                            }
                            break;
                        }
                    }
                    if (lanIp !== 'Unknown') break;
                }
            } catch (e) { }

            // Append Wi-Fi Info to Connection Type string
            if (wifiDetails && wifiDetails.band) {
                connectionType += ` (${wifiDetails.band})`;
            }

            // DNS
            let dnsList = 'Unknown';
            try {
                const servers = dns.getServers();
                if (Array.isArray(servers)) dnsList = servers.join(', ');
            } catch (e) { }

            res.json({
                wanIp, lanIp, connectionType, dns: dnsList, isOnline, latency
            });
        });
    } catch (err) {
        res.status(500).json({ error: "Internal Error" });
    }
});

app.get('/api/system-health', (req, res) => {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memUsage = Math.round((usedMem / totalMem) * 100);

        let friendlyOs = os.type();
        const release = os.release();

        if (os.platform() === 'win32') {
            const major = parseInt(release.split('.')[0]);
            const build = parseInt(release.split('.')[2]);
            if (major === 10) {
                if (build >= 22000) friendlyOs = "Windows 11";
                else friendlyOs = "Windows 10";
            }
        }

        // Get readable version (e.g., "Version 24H2")
        const readableVersion = getWindowsVersion(release);

        res.json({
            uptime: os.uptime(),
            totalMem: (totalMem / (1024 ** 3)).toFixed(1) + ' GB',
            freeMem: (freeMem / (1024 ** 3)).toFixed(1) + ' GB',
            usedMem: (usedMem / (1024 ** 3)).toFixed(1) + ' GB',
            memUsage: memUsage,
            cpuModel: os.cpus()[0].model,
            cpuCores: os.cpus().length,
            platform: os.platform(),
            friendlyOs: friendlyOs,
            readableVersion: readableVersion,
            osRelease: release,
            hostname: os.hostname()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/traceroute', (req, res) => {
    const isWindows = process.platform === "win32";
    const cmd = isWindows ? "tracert -h 15 -w 300 8.8.8.8" : "traceroute -m 15 -w 1 8.8.8.8";

    exec(cmd, { timeout: 20000 }, (error, stdout, stderr) => {
        if (error) {
            return res.json({ output: stdout || stderr || "Trace failed" });
        }
        res.json({ output: stdout });
    });
});

app.get('/api/port-scan', async (req, res) => {
    const portsToScan = [21, 22, 53, 80, 443, 3000, 3001, 3306, 3389, 8080];
    const results = [];
    for (const p of portsToScan) {
        const result = await checkPort(p);
        results.push(result);
    }
    res.json(results);
});

// --- Google Sheets Integration ---
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// TODO: Thay thế bằng ID của Google Sheet bạn (Trong url /spreadsheets/d/<ID>/edit)
const SPREADSHEET_ID = '1yvDsGwFDHJE7GEiu8OtQxDsRxGdv53TfepeGZQSDN-E';

app.post('/api/log-sheet', async (req, res) => {
    try {
        // Load Service Account Credentials
        let serviceAccount;
        try {
            serviceAccount = require('./service-account.json');
        } catch (e) {
            return res.status(500).json({ error: "Không tìm thấy file 'service-account.json'. Hãy copy nó vào thư mục dự án." });
        }

        if (SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
            return res.status(400).json({ error: "Chưa cấu hình SPREADSHEET_ID trong server.js" });
        }

        // Auth
        const serviceAccountAuth = new JWT({
            email: serviceAccount.client_email,
            key: serviceAccount.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

        await doc.loadInfo(); // Loads logs
        const sheet = doc.sheetsByIndex[0]; // First sheet

        // Prepare Row Data
        const logData = {
            Time: new Date().toLocaleString(),
            Hostname: req.body.hostname || 'N/A',
            OS: req.body.osInfo || 'N/A',
            ConnectionType: req.body.connectionType || 'N/A',
            WanIP: req.body.wanIp || 'N/A',
            LanIP: req.body.lanIp || 'N/A',
            Ping: req.body.ping || 'N/A',
            DownloadSpeed: req.body.speed || 'N/A',
            Note: req.body.note || ''
        };

        await sheet.addRow(logData);

        console.log("Logged to Google Sheet:", logData);
        res.json({ status: 'success', message: 'Đã lưu vào Google Sheet thành công!' });

    } catch (e) {
        console.error("Google Sheet Error:", e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// --- System Management ---
app.post('/api/rename-computer', (req, res) => {
    const newName = req.body.newName;
    if (!newName || !/^[a-zA-Z0-9-]+$/.test(newName)) {
        return res.status(400).json({ status: 'error', message: 'Tên máy không hợp lệ (Chỉ dùng chữ, số, dấu gạch ngang)' });
    }

    // PowerShell command to rename
    const cmd = `powershell -Command "Rename-Computer -NewName '${newName}' -Force"`;

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error("Rename Error:", stderr);
            return res.status(500).json({
                status: 'error',
                message: 'Lỗi: Cần chạy Server bằng quyền Administrator để đổi tên máy! (Error: Access Denied or Invalid Name)'
            });
        }
        res.json({ status: 'success', message: 'Đổi tên thành công! Hãy khởi động lại máy tính để áp dụng.' });
    });
});

app.get('/api/speedtest/download', (req, res) => {
    const size = 10 * 1024 * 1024;
    const buffer = Buffer.alloc(size, 'a');
    res.send(buffer);
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
