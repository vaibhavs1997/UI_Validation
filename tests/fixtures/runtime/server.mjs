import http from 'node:http';

const port = Number(process.env.RUNTIME_FIXTURE_PORT ?? 4100);
const html = (body, extra = '') => `<!doctype html><html><head><meta charset="utf-8"><title>VisionQA runtime fixture</title><link rel="stylesheet" href="/assets/good.css">${extra}</head><body>${body}<script src="/assets/good.js"></script></body></html>`;
const send = (response, status, body, type = 'text/html; charset=utf-8', headers = {}) => { response.writeHead(status, { 'content-type': type, ...headers }); response.end(body); };

const server = http.createServer((request, response) => {
  const path = new URL(request.url ?? '/', `http://127.0.0.1:${port}`).pathname;
  if (path === '/health') return send(response, 200, JSON.stringify({ status: 'ok', service: 'visionqa-runtime-fixture' }), 'application/json');
  if (path === '/robots.txt') return send(response, 200, 'User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n');
  if (path === '/sitemap.xml') return send(response, 200, '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://127.0.0.1:4100/</loc></url><url><loc>http://127.0.0.1:4100/page-a</loc></url><url><loc>http://127.0.0.1:4100/page-b</loc></url></urlset>', 'application/xml');
  if (path === '/assets/good.css') return send(response, 200, 'body { font-family: Arial, sans-serif; }', 'text/css');
  if (path === '/assets/good.js') return send(response, 200, 'window.runtimeFixture = true;', 'application/javascript');
  if (path === '/assets/good.png') return send(response, 200, Buffer.from('runtime-fixture-image'), 'image/png');
  if (path === '/assets/missing.png' || path === '/assets/missing.js') return send(response, 404, 'missing');
  if (path === '/redirect') return send(response, 302, '', 'text/plain', { location: '/page-a' });
  if (path === '/slow') return setTimeout(() => send(response, 200, html('<h1>Slow page</h1>')), 1200);
  if (path === '/missing') return send(response, 404, html('<h1>Missing page</h1>'));
  if (path === '/browser/console-error') return send(response, 200, html('<h1>Console error</h1>', '<script>console.error("runtime fixture console error")</script>'));
  if (path === '/browser/js-error') return send(response, 200, html('<h1>JavaScript error</h1>', '<script>throw new Error("runtime fixture page error")</script>'));
  if (path === '/browser/network-errors') return send(response, 200, html('<h1>Network errors</h1><img src="/assets/missing.png"><script src="/assets/missing.js"></script>'));
  if (path === '/browser/slow') return setTimeout(() => send(response, 200, html('<h1>Slow browser page</h1>')), 1200);
  if (path === '/visual/text-overlap') return send(response, 200, html('<main><h1 style="position:absolute;left:10px;top:10px">Overlap A</h1><h2 style="position:absolute;left:10px;top:10px">Overlap B</h2></main>'));
  if (path === '/visual/element-overlap') return send(response, 200, html('<main><button style="position:absolute;left:10px;top:10px">A</button><button style="position:absolute;left:10px;top:10px">B</button></main>'));
  if (path === '/visual/horizontal-overflow') return send(response, 200, html('<main><div style="width:2400px;height:40px;background:#ad08d1">Overflow fixture</div></main>'));
  if (path === '/visual/viewport-overflow') return send(response, 200, html('<main><div style="height:1800px;background:#eadcf0">Viewport fixture</div></main>'));
  if (path === '/page-a') return send(response, 200, html('<h1>Page A</h1><a href="/page-b">Working internal link</a><a href="/missing">Broken internal link</a><img src="/assets/good.png"><img src="/assets/missing.png"><script src="/assets/missing.js"></script>'));
  if (path === '/page-b') return send(response, 200, html('<h1>Page B</h1><a href="/redirect">Redirect link</a><link rel="stylesheet" href="/assets/good.css">'));
  return send(response, 200, html('<h1>Runtime fixture</h1><a href="/page-a">Page A</a><a href="/page-b">Page B</a><a href="/missing">Missing</a><a href="/redirect">Redirect</a><img src="/assets/good.png"><img src="/assets/missing.png"><script src="/assets/missing.js"></script>'));
});

server.listen(port, '0.0.0.0', () => console.log(`VisionQA runtime fixture ready on http://127.0.0.1:${port}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
