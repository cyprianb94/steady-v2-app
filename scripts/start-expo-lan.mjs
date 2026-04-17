import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const preferredInterfacePatterns = [
  /^en0$/i,
  /^en1$/i,
  /^wi-?fi$/i,
  /^wifi$/i,
  /^wlan\d+$/i,
  /^eth\d+$/i,
  /^en\d+$/i,
];

const depreferredInterfacePatterns = [
  /^lo\d*$/i,
  /^utun\d*$/i,
  /^tun\d*$/i,
  /^tap\d*$/i,
  /^wg\d*$/i,
  /^tailscale\d*$/i,
  /^bridge\d*$/i,
  /^awdl\d*$/i,
  /^llw\d*$/i,
  /^anpi\d*$/i,
];

function isUsableIpv4(entry) {
  return (
    entry?.family === 'IPv4'
    && !entry.internal
    && typeof entry.address === 'string'
    && !entry.address.startsWith('169.254.')
  );
}

function scoreInterface(name) {
  if (depreferredInterfacePatterns.some((pattern) => pattern.test(name))) {
    return -100;
  }

  const preferredIndex = preferredInterfacePatterns.findIndex((pattern) => pattern.test(name));
  if (preferredIndex !== -1) {
    return 100 - preferredIndex;
  }

  return 0;
}

function getLanIp() {
  const overrideIp = process.env.STEADY_DEV_LAN_IP?.trim();
  if (overrideIp) {
    return overrideIp;
  }

  const candidates = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (!isUsableIpv4(entry)) {
        continue;
      }

      candidates.push({
        address: entry.address,
        name,
        score: scoreInterface(name),
      });
    }
  }

  candidates.sort((left, right) => (
    right.score - left.score
    || left.name.localeCompare(right.name)
    || left.address.localeCompare(right.address)
  ));

  return candidates[0]?.address ?? null;
}

const args = process.argv.slice(2);
const shouldPrint = args.includes('--print');
const forwardedArgs = args.filter((arg) => arg !== '--print');
const lanIp = getLanIp();

if (!lanIp) {
  console.error(
    'Could not determine a LAN IPv4 address. Set STEADY_DEV_LAN_IP and rerun `npm run dev:app`.',
  );
  process.exit(1);
}

const apiUrl = `http://${lanIp}:3000`;

if (shouldPrint) {
  console.log(apiUrl);
  process.exit(0);
}

console.log(`Starting Expo in LAN mode with EXPO_PUBLIC_API_URL=${apiUrl}`);

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(
  npmCommand,
  ['run', 'start', '-w', 'packages/app', '--', '--host', 'lan', ...forwardedArgs],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      EXPO_PUBLIC_API_URL: apiUrl,
      REACT_NATIVE_PACKAGER_HOSTNAME: lanIp,
      STEADY_DEV_LAN_IP: lanIp,
    },
    stdio: 'inherit',
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
