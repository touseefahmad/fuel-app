// A tiny dependency-free HTTP router: register method+path handlers (paths
// may contain :params), get JSON body parsing and query-string parsing for
// free, and send JSON responses with a couple of helpers.

function pathToRegex(path) {
  const keys = [];
  const pattern = path
    .replace(/\/+$/, '')
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^${pattern}/?$`), keys };
}

class Router {
  constructor() {
    this.routes = [];
  }
  add(method, path, ...handlers) {
    const { regex, keys } = pathToRegex(path);
    this.routes.push({ method, regex, keys, handlers });
    return this;
  }
  get(path, ...h) { return this.add('GET', path, ...h); }
  post(path, ...h) { return this.add('POST', path, ...h); }
  put(path, ...h) { return this.add('PUT', path, ...h); }
  delete(path, ...h) { return this.add('DELETE', path, ...h); }

  async handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    req.query = Object.fromEntries(url.searchParams.entries());
    const pathname = decodeURIComponent(url.pathname);

    const matches = this.routes.filter((r) => r.method === req.method && r.regex.test(pathname));
    if (matches.length === 0) {
      const anyMethodMatch = this.routes.some((r) => r.regex.test(pathname));
      res.statusCode = anyMethodMatch ? 405 : 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: anyMethodMatch ? 'Method not allowed' : 'Not found' }));
      return;
    }
    const route = matches[0];
    const m = pathname.match(route.regex);
    req.params = {};
    route.keys.forEach((key, i) => { req.params[key] = decodeURIComponent(m[i + 1]); });

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      req.body = await parseBody(req);
    } else {
      req.body = {};
    }

    res.json = (data, status = 200) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };
    res.error = (message, status = 400) => res.json({ error: message }, status);

    let i = 0;
    const next = async (err) => {
      if (err) return sendError(res, err);
      const handler = route.handlers[i++];
      if (!handler) return;
      try {
        await handler(req, res, next);
      } catch (e) {
        sendError(res, e);
      }
    };
    await next();
  }
}

function sendError(res, err) {
  console.error(err);
  if (res.headersSent) return;
  const status = err.status || 500;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: err.publicMessage || err.message || 'Internal server error' }));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 10 * 1024 * 1024) { req.destroy(); reject(new Error('Payload too large')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

module.exports = { Router };
