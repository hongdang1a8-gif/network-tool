const { exec } = require('child_process');
const os = require('os');
const dns = require('dns');

console.log("Starting Debug...");

// 1. Test DNS
try {
    const servers = dns.getServers();
    console.log("DNS Servers:", servers);
} catch (e) {
    console.error("DNS Error:", e.message);
}

// 2. Test Network Interfaces
try {
    const nets = os.networkInterfaces();
    console.log("Network Interfaces found.");
    let lanIp = 'Unknown';
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                lanIp = net.address;
                console.log(`Found IP: ${lanIp} on ${name}`);
            }
        }
    }
} catch (e) {
    console.error("Network Interfaces Error:", e.message);
}

// 3. Test Ping
console.log("Testing Ping...");
const isWindows = process.platform === "win32";
const pingCmd = isWindows ? "ping -n 1 8.8.8.8" : "ping -c 1 8.8.8.8";

exec(pingCmd, (error, stdout, stderr) => {
    if (error) {
        console.error("Ping Error:", error.message);
    } else {
        console.log("Ping Output:", stdout);
    }
    console.log("Debug Finished.");
});
