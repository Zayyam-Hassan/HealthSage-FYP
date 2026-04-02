import http from 'http';
import app from './app';
import { env } from './config/env';

/**
 * MongoDB connects lazily on first request (see ensureDbConnection + connectToDatabase).
 * Do not await DB here — required for Vercel serverless and fast local startup.
 */
function bootstrap(): void {
  const server = http.createServer(app);
  server.listen(env.port, env.host, () => {
    // eslint-disable-next-line no-console
    console.log(`Express backend listening on http://${env.host}:${env.port}`);
  });
}

bootstrap();
