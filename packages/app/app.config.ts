import path from 'node:path';
import type { ExpoConfig } from 'expo/config';

const repoEnvPath = path.resolve(__dirname, '../../.env');

try {
  process.loadEnvFile(repoEnvPath);
} catch {
  // Local env is optional and may be provided by the shell/CI instead.
}

type ExpoConfigContext = {
  config: ExpoConfig;
};

function isPrivateApiHost(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  if (
    normalizedHostname === 'localhost'
    || normalizedHostname === '0.0.0.0'
    || normalizedHostname === '::1'
    || normalizedHostname.startsWith('127.')
  ) {
    return true;
  }

  if (normalizedHostname.startsWith('10.') || normalizedHostname.startsWith('192.168.')) {
    return true;
  }

  const octets = normalizedHostname.split('.');
  if (octets.length !== 4) {
    return false;
  }

  const [firstOctet, secondOctet] = octets.map(Number);
  return firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31;
}

function isReleaseEasBuildProfile(profile: string | undefined): boolean {
  return profile === 'preview' || profile === 'production';
}

export function validateApiUrlForBuildProfile(
  apiUrl: string | undefined,
  buildProfile: string | undefined,
): string | null {
  const normalizedApiUrl = apiUrl?.trim() || null;
  if (!isReleaseEasBuildProfile(buildProfile)) {
    return normalizedApiUrl;
  }

  if (!normalizedApiUrl) {
    throw new Error(
      `EXPO_PUBLIC_API_URL is required for EAS ${buildProfile} builds.`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(normalizedApiUrl);
  } catch {
    throw new Error(`Invalid EXPO_PUBLIC_API_URL for EAS ${buildProfile} build: ${normalizedApiUrl}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(
      `EXPO_PUBLIC_API_URL must use HTTPS for EAS ${buildProfile} builds: ${normalizedApiUrl}`,
    );
  }

  if (isPrivateApiHost(parsed.hostname)) {
    throw new Error(
      `EXPO_PUBLIC_API_URL must be public for EAS ${buildProfile} builds: ${normalizedApiUrl}`,
    );
  }

  return normalizedApiUrl;
}

export default function appConfig({ config }: ExpoConfigContext): ExpoConfig {
  const apiUrl = validateApiUrlForBuildProfile(
    process.env.EXPO_PUBLIC_API_URL,
    process.env.EAS_BUILD_PROFILE,
  );

  return {
    ...config,
    extra: {
      ...config.extra,
      apiUrl,
    },
  };
}
