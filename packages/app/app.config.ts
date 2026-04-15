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

export default function appConfig({ config }: ExpoConfigContext): ExpoConfig {
  return {
    ...config,
    extra: {
      ...config.extra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim() || null,
    },
  };
}
