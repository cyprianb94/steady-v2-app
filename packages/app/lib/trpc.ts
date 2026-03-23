import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@steady/server/src/trpc/router';

const getBaseUrl = () => {
  // TODO: Use environment variable or Expo Constants
  return 'http://localhost:3000';
};

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      headers: () => {
        // TODO: Inject Supabase auth token
        return {
          authorization: 'Bearer demo-user',
        };
      },
    }),
  ],
});
