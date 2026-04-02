import Fastify from 'fastify';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fastifyTRPCPlugin,
  type FastifyTRPCPluginOptions,
} from '@trpc/server/adapters/fastify';
import { createAppRouter, type AppRouter } from './trpc/router';
import { createContext } from './trpc/context';
import { createServerDeps } from './repos/server-deps';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../../.env');

try {
  process.loadEnvFile(envPath);
} catch {
  // Local env is optional in tests/CI and may be injected by the shell instead.
}

const server = Fastify({ logger: true });

// Health check
server.get('/health', async () => {
  return { status: 'ok', service: 'steady-server' };
});

const appRouter = createAppRouter(createServerDeps());

// tRPC
server.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext,
  } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Steady server listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
