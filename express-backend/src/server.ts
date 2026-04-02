/**
 * Vercel / serverless entry — default export only.
 * Do not use http.createServer() or listen() here (that pattern belongs in local dev).
 * @see src/local.ts for npm run dev / npm start
 */
import app from './app';

export default app;
