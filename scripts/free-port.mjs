import { execFileSync } from 'node:child_process';

const port = Number(process.argv[2] ?? 3000);
const pids = new Set();

if (process.platform === 'win32') {
  const output = execFileSync('netstat.exe', ['-ano'], { encoding: 'utf8' });
  for (const line of output.split(/\r?\n/)) {
    if (line.includes(`:${port}`) && /LISTENING\s+(\d+)$/.test(line)) pids.add(Number(line.match(/LISTENING\s+(\d+)$/)[1]));
  }
} else {
  try {
    const output = execFileSync('lsof', ['-ti', `:${port}`], { encoding: 'utf8' });
    for (const value of output.split(/\r?\n/)) if (/^\d+$/.test(value)) pids.add(Number(value));
  } catch { /* No process is using the port. */ }
}

for (const pid of pids) {
  if (pid === process.pid) continue;
  try { process.kill(pid, 'SIGTERM'); console.log(`Stopped process ${pid} on port ${port}.`); } catch { /* Process already exited. */ }
}
