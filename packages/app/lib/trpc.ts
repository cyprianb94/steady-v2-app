import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@steady/server/src/trpc/router';
import { getAccessToken } from './auth-session';

const getBaseUrl = () => {
  // In dev, use the machine's LAN IP so physical devices can reach the server.
  // expo-constants exposes the debuggerHost which includes the IP Metro is using.
  const { default: Constants } = require('expo-constants') as {
    default: { expoConfig?: { hostUri?: string } };
  };
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:3000`;
  }
  return 'http://localhost:3000';
};

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      headers: async () => {
        const accessToken = getAccessToken();
        if (!accessToken) return {};

        return {
          authorization: `Bearer ${accessToken}`,
        };
      },
    }),
  ],
});
