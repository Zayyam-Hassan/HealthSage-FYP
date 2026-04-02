import http from 'http';
import app from './app';
import { env } from './config/env';

const server = http.createServer(app);
server.listen(env.port, env.host, () => {
  // eslint-disable-next-line no-console
  console.log(`Express backend listening on http://${env.host}:${env.port}`);
});
