import http from 'http';
import  app  from './app';
import { env } from './config/env';
import { connectMongo } from './db/mongoose';

async function bootstrap(): Promise<void> {
  await connectMongo();

  const server = http.createServer(app);
  server.listen(env.port, env.host, () => {
    // eslint-disable-next-line no-console
    console.log(`Express backend listening on http://${env.host}:${env.port}`);
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start Express backend', err);
  process.exit(1);
});

