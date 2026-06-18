import { exec } from 'child_process';

exec('powershell -Command "Get-CimInstance Win32_Process -Filter \\"CommandLine LIKE \'%printer-bridge.js%\'\\" | Select-Object ProcessId"', (err, stdout) => {
    if (err) {
        console.error("Error:", err);
        return;
    }
    const lines = stdout.split('\n').map(l => l.trim()).filter(l => /^\d+$/.test(l));
    console.log("PIDs encontrados:", lines);
    lines.forEach(pid => {
        exec(`taskkill /F /PID ${pid}`, (kErr, kStdout) => {
            console.log(`Killed PID ${pid}:`, kStdout || kErr?.message);
        });
    });
});
