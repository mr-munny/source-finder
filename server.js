const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const PROXY_ALLOWED = ['www.loc.gov', 'api.dp.la'];

function proxyRequest(targetUrl, res) {
  https.get(targetUrl, { headers: { 'Accept': 'application/json', 'User-Agent': 'SourceFinder/1.0' } }, (upstream) => {
    res.writeHead(upstream.statusCode, {
      'Content-Type': upstream.headers['content-type'] || 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    upstream.pipe(res);
  }).on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: e.message }));
  });
}

http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  // Proxy endpoint: /proxy?url=https://...
  if (parsed.pathname === '/proxy') {
    const target = parsed.searchParams.get('url');
    if (!target) { res.writeHead(400); return res.end('Missing ?url= parameter'); }
    try {
      const targetHost = new URL(target).hostname;
      if (!PROXY_ALLOWED.includes(targetHost)) { res.writeHead(403); return res.end('Host not allowed'); }
    } catch { res.writeHead(400); return res.end('Invalid URL'); }
    return proxyRequest(target, res);
  }

  // Static file serving
  let filePath = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
  filePath = path.join(__dirname, filePath);
  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Source Finder running at http://localhost:${PORT}`));
