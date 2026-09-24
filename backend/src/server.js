const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { Router } = require('./router');
const { connect } = require('./db');
const { seedIfEmpty } = require('./db/seed');

const router = new Router();

// Mount API route modules
const mount = (r) => { r.routes.forEach((route) => router.routes.push(route)); };
mount(require('./routes/auth'));
mount(require('./routes/sites'));
mount(require('./routes/tanks'));
mount(require('./routes/nozzles'));
mount(require('./routes/prices'));
mount(require('./routes/entries'));
mount(require('./routes/dashboard'));
mount(require('./routes/users'));
mount(require('./routes/reports'));

const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(FRONTEND_DIR, urlPath));
  if (!filePath.startsWith(FRONTEND_DIR)) { res.statusCode = 403; return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: unknown non-file routes go to index.html
      if (!path.extname(urlPath)) {
        return fs.readFile(path.join(FRONTEND_DIR, 'index.html'), (e2, d2) => {
          if (e2) { res.statusCode = 404; return res.end('Not found'); }
          res.setHeader('Content-Type', MIME['.html']);
          res.end(d2);
        });
      }
      res.statusCode = 404;
      return res.end('Not found');
    }
    res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      await router.handle(req, res);
      if (!res.writableEnded && !res.headersSent) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Not found' }));
      }
      return;
    }
    if (req.method !== 'GET') { res.statusCode = 405; return res.end('Method not allowed'); }
    serveStatic(req, res);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal server error');
  }
});

const PORT = process.env.PORT || 4000;

(async () => {
  console.log('Connecting to MongoDB...');
  await connect();
  console.log('Connected.');
  await seedIfEmpty();
  server.listen(PORT, () => {
    console.log(`Fuel Stock Manager running at http://localhost:${PORT}`);
  });
})();
