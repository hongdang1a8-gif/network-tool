// Setup global variables
let pingChart; // Chart.js instance
let pingInterval;

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initBasicStatus();
    initSpeedTest();
    initChart();

    // Start Polling for Real-time Data
    setInterval(updateRealtimeData, 2000); // Pulse every 2 seconds
});

// --- Tab Logic ---
function initTabs() {
    window.switchTab = (tabId) => {
        // Toggle Buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        // Toggle Content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
    };
}

// --- Basic Status (Overview) ---
function initBasicStatus() {
    // Fetch WAN IP from external source once
    fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => {
            const el = document.getElementById('wan-ip');
            // Update only if we get a valid IP
            if (data.ip) {
                el.innerHTML = `${data.ip} <br><small style="font-size:0.6em; color:#9db2bf">(External/Quốc tế)</small>`;
                // Add a marker class so polling doesn't overwrite it with ::1
                el.dataset.fetched = "true";
            }
        })
        .catch(e => console.log("External IP fetch failed", e));
}

// --- Speed Test (Cloudflare) ---
function initSpeedTest() {
    const speedBtn = document.getElementById('speed-btn');
    const speedResultEl = document.getElementById('speed-result');

    speedBtn.addEventListener('click', () => {
        speedBtn.disabled = true;
        speedBtn.textContent = 'Testing / Đang kiểm tra...';
        speedResultEl.textContent = '';

        const startTime = Date.now();
        const testUrl = `https://speed.cloudflare.com/__down?bytes=10000000&t=${Date.now()}`;

        fetch(testUrl)
            .then(res => {
                if (!res.ok) throw new Error('Network err');
                return res.blob();
            })
            .then(blob => {
                const duration = (Date.now() - startTime) / 1000;
                const speedMbps = ((blob.size * 8) / duration / (1024 * 1024)).toFixed(2);

                speedResultEl.innerHTML = `<h2 style="margin:0">${speedMbps} <small>Mbps</small></h2>`;

                // Add Save Button if not exists
                if (!document.getElementById('save-sheet-btn')) {
                    const btn = document.createElement('button');
                    btn.id = 'save-sheet-btn';
                    btn.textContent = '💾 Save to Google Sheet';
                    btn.className = 'action-btn';
                    btn.style.marginTop = '10px';
                    btn.style.background = '#10b981';
                    btn.onclick = () => saveToSheet(speedMbps);
                    speedResultEl.appendChild(btn);
                }

                speedBtn.textContent = 'Run Speed Test / Chạy kiểm tra';
                speedBtn.disabled = false;
            })
            .catch(e => {
                speedResultEl.textContent = 'Test Failed';
                speedBtn.textContent = 'Retry / Thử lại';
                speedBtn.disabled = false;
            });
    });
}

async function saveToSheet(speed) {
    const btn = document.getElementById('save-sheet-btn');
    const origText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    const wanIp = document.getElementById('wan-ip').innerText.split('\n')[0];
    const lanIp = document.getElementById('lan-ip').innerText.split('\n')[0];

    const connType = document.getElementById('conn-type').textContent;

    // Get extended info from UI (already populated by polling)
    const hostname = document.getElementById('sys-hostname').textContent;
    const osInfo = document.getElementById('sys-platform').innerText; // Gets text content of OS

    // Get latest ping from chart if available, or fetch
    const ping = pingChart.data.datasets[0].data.slice(-1)[0] || 'N/A';

    try {
        const res = await fetch('/api/log-sheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wanIp, lanIp, ping, speed,
                hostname, osInfo, connectionType: connType,
                note: 'Manual Test'
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert('Saved to Google Sheet!');
            btn.textContent = 'Saved ✅';
        } else {
            alert('Error: ' + data.message);
            btn.textContent = 'Failed ❌';
        }
    } catch (e) {
        alert('Network Error connecting to server');
        btn.textContent = 'Error';
    }

    setTimeout(() => {
        btn.disabled = false;
        btn.textContent = origText;
    }, 3000);

}

// --- Chart.js Setup ---
function initChart() {
    const ctx = document.getElementById('pingChart').getContext('2d');
    pingChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // Time labels
            datasets: [{
                label: 'Ping (ms)',
                data: [],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: false }, // Hide time labels for clean look
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }
            },
            plugins: {
                legend: { display: false }
            },
            animation: { duration: 0 } // Disable animation for smooth streaming
        }
    });
}

// --- Real-time Data Polling ---
async function updateRealtimeData() {
    try {
        // 1. Status & Ping API
        const statusRes = await fetch('/api/status');
        const statusData = await statusRes.json();

        // Update Overview UI
        const wanEl = document.getElementById('wan-ip');
        if (!wanEl.dataset.fetched || (statusData.wanIp !== '::1' && statusData.wanIp !== '127.0.0.1')) {
            if (!wanEl.dataset.fetched) wanEl.textContent = statusData.wanIp || 'Unknown';
        }
        document.getElementById('lan-ip').innerHTML = `${statusData.lanIp || 'Unknown'} <br><small style="font-size:0.6em; color:#9db2bf">(Local)</small>`;
        document.getElementById('conn-type').textContent = statusData.connectionType || 'Unknown';
        document.getElementById('dns-server').textContent = statusData.dns || 'Unknown';

        const dot = document.querySelector('.status-dot');
        const txt = document.getElementById('status-text');
        if (statusData.isOnline) {
            dot.className = 'status-dot online';
            txt.textContent = 'Online';
        } else {
            dot.className = 'status-dot offline';
            txt.textContent = 'Offline';
        }

        // Update Chart
        const latency = statusData.latency || 0;
        const now = new Date().toLocaleTimeString();

        // Keep last 20 data points
        if (pingChart.data.labels.length > 20) {
            pingChart.data.labels.shift();
            pingChart.data.datasets[0].data.shift();
        }
        pingChart.data.labels.push(now);
        pingChart.data.datasets[0].data.push(latency);
        pingChart.update();

        // 2. System Health API (Only fetch if tab is active to save resources? optional. fetching always for now)
        const healthRes = await fetch('/api/system-health');
        const hData = await healthRes.json();

        let icon = '🖥️';
        if (hData.friendlyOs.includes('Windows')) icon = '🪟';
        if (hData.friendlyOs.includes('mac')) icon = '🍎';
        if (hData.friendlyOs.includes('Linux')) icon = '🐧';

        document.getElementById('sys-hostname').textContent = hData.hostname || 'Unknown';
        document.getElementById('sys-platform').innerHTML = `<span style="font-size:1.2em">${icon} <strong>${hData.friendlyOs}</strong></span> <small style="color:#64748b; margin-left:8px;">${hData.readableVersion}</small>`;
        document.getElementById('sys-cpu').textContent = hData.cpuModel;
        document.getElementById('sys-cores').textContent = hData.cpuCores;
        document.getElementById('sys-ram').textContent = `${hData.memUsage}% Used (${hData.usedMem} / ${hData.totalMem})`;
        document.getElementById('sys-uptime').textContent = formatUptime(hData.uptime);
        document.getElementById('sys-uptime').textContent = formatUptime(hData.uptime);

    } catch (e) {
        console.error("Polling error", e);
    }
}

function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

// --- Advanced Actions ---
window.runPortScan = async () => {
    const out = document.getElementById('port-output');
    const btn = document.getElementById('scan-btn');

    out.textContent = "Scanning ports (21, 22, 53, 80, 443, 3000, 3001, 3306...)\nThis may take a few seconds...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/port-scan');
        const data = await res.json();

        out.textContent = ""; // Clear
        data.forEach(item => {
            const statusLine = `Port ${item.port}: [${item.status}]\n`;
            out.textContent += statusLine;
        });
    } catch (e) {
        out.textContent = "Error scanning ports.";
    }
    btn.disabled = false;
};

window.runTraceroute = async () => {
    const out = document.getElementById('trace-output');
    const btn = document.getElementById('trace-btn');

    out.textContent = "Tracing route to 8.8.8.8...\nPlease wait (up to 20s)...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/traceroute');
        const data = await res.json();
        out.textContent = data.output;
    } catch (e) {
        out.textContent = "Error running traceroute.";
    }
    btn.disabled = false;
};

// --- System Management ---
async function renameComputer() {
    const input = document.getElementById('new-hostname');
    const newName = input.value.trim();

    if (!newName) return alert("Please enter a new name / Vui lòng nhập tên mới");

    if (!confirm(`Are you sure you want to rename this computer to "${newName}"?\nThis will require a restart.`)) return;

    try {
        const res = await fetch('/api/rename-computer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newName })
        });
        const data = await res.json();

        if (data.status === 'success') {
            alert(data.message);
            input.value = '';
        } else {
            alert(data.message);
        }
    } catch (e) {
        alert("Error connecting to server");
    }
}
