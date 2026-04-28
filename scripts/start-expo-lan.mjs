import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const apiPort = Number(process.env.PORT) || 3000;
const apiHealthTimeoutMs = Number(process.env.STEADY_DEV_API_HEALTH_TIMEOUT_MS) || 30_000;
const relayHealthTimeoutMs = Number(process.env.STEADY_DEV_STRAVA_RELAY_HEALTH_TIMEOUT_MS) || 2_000;
const envApiUrlKey = 'EXPO_PUBLIC_API_URL';
const envStravaOAuthRelayUrlKey = 'EXPO_PUBLIC_STRAVA_OAUTH_RELAY_URL';
const devApiUrlOverrideKey = 'STEADY_DEV_API_URL';

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

function readEnvValue(filePath, key) {
  try {
    const contents = fs.readFileSync(filePath, 'utf8');

    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match || match[1] !== key) {
        continue;
      }

      const value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        return value.slice(1, -1);
      }

      return value;
    }
  } catch {
    return null;
  }

  return null;
}

function getExpoApiUrl(fallbackUrl) {
  const explicitDevApiUrl = process.env[devApiUrlOverrideKey]?.trim();
  if (explicitDevApiUrl) {
    return explicitDevApiUrl;
  }

  const explicitExpoApiUrl = process.env[envApiUrlKey]?.trim();
  if (explicitExpoApiUrl) {
    try {
      const parsed = new URL(explicitExpoApiUrl);
      if (parsed.protocol !== 'https:') {
        return explicitExpoApiUrl;
      }
    } catch {
      return explicitExpoApiUrl;
    }
  }

  return fallbackUrl;
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function getUrlOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function getStravaOAuthRelayUrl() {
  const explicitRelayUrl = process.env[envStravaOAuthRelayUrlKey]?.trim();
  if (explicitRelayUrl) {
    return explicitRelayUrl;
  }

  const envFiles = [
    path.join(repoRoot, 'packages/app/.env'),
    path.join(repoRoot, '.env'),
  ];

  for (const filePath of envFiles) {
    const relayUrl = readEnvValue(filePath, envStravaOAuthRelayUrlKey);
    if (relayUrl) {
      return relayUrl;
    }
  }

  const legacyApiUrls = [
    process.env[envApiUrlKey]?.trim(),
    ...envFiles.map((filePath) => readEnvValue(filePath, envApiUrlKey)),
  ];

  return legacyApiUrls.find((value) => value && isHttpsUrl(value)) ?? null;
}

const args = process.argv.slice(2);
const shouldPrint = args.includes('--print');
const shouldSkipServer = args.includes('--no-server') || process.env.STEADY_DEV_SKIP_SERVER === '1';
const forwardedArgs = args.filter((arg) => arg !== '--print' && arg !== '--no-server');
const lanIp = getLanIp();

if (!lanIp) {
  console.error(
    'Could not determine a LAN IPv4 address. Set STEADY_DEV_LAN_IP and rerun `npm run dev:app`.',
  );
  process.exit(1);
}

const apiUrl = `http://${lanIp}:${apiPort}`;
const expoApiUrl = getExpoApiUrl(apiUrl);
const stravaOAuthRelayUrl = getStravaOAuthRelayUrl();

if (shouldPrint) {
  console.log(apiUrl);
  process.exit(0);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function isApiHealthy() {
  try {
    const response = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(1_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function isStravaRelayHealthy(relayUrl) {
  let relayOrigin;
  try {
    relayOrigin = new URL(relayUrl).origin;
  } catch {
    return false;
  }

  try {
    const response = await fetch(`${relayOrigin}/health`, {
      signal: AbortSignal.timeout(relayHealthTimeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForApiHealth(serverChild) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < apiHealthTimeoutMs) {
    if (await isApiHealthy()) {
      return;
    }

    if (serverChild?.exitCode !== null) {
      throw new Error('Fastify API exited before it became reachable.');
    }

    await delay(500);
  }

  throw new Error(
    `Fastify API did not become reachable at ${apiUrl}/health within ${apiHealthTimeoutMs}ms.`,
  );
}

function spawnChild(command, args, env = process.env) {
  return spawn(command, args, {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });
}

let serverChild = null;
let expoChild = null;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (expoChild && expoChild.exitCode === null) {
    expoChild.kill('SIGTERM');
  }
  if (serverChild && serverChild.exitCode === null) {
    serverChild.kill('SIGTERM');
  }

  process.exit(code);
}

async function main() {
  if (!shouldSkipServer && !(await isApiHealthy())) {
    console.log(`Starting Fastify API for Expo at ${apiUrl}`);
    serverChild = spawnChild(npmCommand, ['run', 'dev:server']);
  }

  if (!shouldSkipServer) {
    await waitForApiHealth(serverChild);
    console.log(`Fastify API is reachable at ${apiUrl}`);
  }

  if (stravaOAuthRelayUrl) {
    console.log(`Using Strava OAuth relay ${stravaOAuthRelayUrl}`);
    if (!(await isStravaRelayHealthy(stravaOAuthRelayUrl))) {
      console.warn(
        `Strava OAuth relay is not reachable at ${getUrlOrigin(stravaOAuthRelayUrl)}/health. `
        + `Start or update your public tunnel and set ${envStravaOAuthRelayUrlKey} to the live HTTPS origin. `
        + `Normal Expo Go API calls will still use ${expoApiUrl}.`,
      );
    }
  } else {
    console.warn(
      `No Strava OAuth relay configured. Expo Go Strava connect needs ${envStravaOAuthRelayUrlKey}=https://... `
      + `pointing at the local API server.`,
    );
  }

  console.log(`Starting Expo in LAN mode with EXPO_PUBLIC_API_URL=${expoApiUrl}`);
  expoChild = spawnChild(
    npmCommand,
    ['run', 'start', '-w', 'packages/app', '--', '--host', 'lan', ...forwardedArgs],
    {
      ...process.env,
      EXPO_PUBLIC_API_URL: expoApiUrl,
      ...(stravaOAuthRelayUrl ? { EXPO_PUBLIC_STRAVA_OAUTH_RELAY_URL: stravaOAuthRelayUrl } : {}),
      REACT_NATIVE_PACKAGER_HOSTNAME: lanIp,
      STEADY_DEV_LAN_IP: lanIp,
    },
  );

  expoChild.on('exit', (code, signal) => {
    if (signal && !shuttingDown) {
      console.log(`Expo exited from ${signal}.`);
    }
    shutdown(code ?? 0);
  });

  serverChild?.on('exit', (code, signal) => {
    if (shuttingDown) return;

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`Fastify API exited unexpectedly with ${reason}. Stopping Expo.`);
    shutdown(code ?? 1);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
});
