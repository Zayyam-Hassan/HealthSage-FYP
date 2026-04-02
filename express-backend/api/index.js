/**
 * Vercel serverless entry — run `npm run build` before deploy so `dist/app.js` exists.
 * Rewrites in vercel.json send all routes here; Express sees the original URL path.
 */
const app = require('../dist/app').default;
module.exports = app;
