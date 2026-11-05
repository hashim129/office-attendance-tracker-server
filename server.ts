import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.set('trust proxy', true);
app.use(express.json({ limit: '15mb' }));

// REST API: Return caller's observed Public/Network IP address
app.get('/api/my-ip', (req, res) => {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp =
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
    req.socket.remoteAddress ||
    req.ip ||
    'Unknown';
  const cleanIp = rawIp.replace(/^::ffff:/, '');
  res.json({ ip: cleanIp });
});

// Ensure data directory exists for shared LAN database
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbFilePath = path.resolve(dataDir, 'database.json');

// REST API: Get shared office attendance database
app.get('/api/db', (_req, res) => {
  try {
    if (fs.existsSync(dbFilePath)) {
      const raw = fs.readFileSync(dbFilePath, 'utf-8');
      res.setHeader('Content-Type', 'application/json');
      res.send(raw);
    } else {
      res.json({ empty: true });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// REST API: Save shared office attendance database
app.post('/api/db', (req, res) => {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(req.body, null, 2), 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Serve standalone Windows .exe installers under /downloads
const releaseDir = path.resolve(__dirname, 'release');
if (fs.existsSync(releaseDir)) {
  app.use('/downloads', express.static(releaseDir));
}

// Serve static assets from the dist folder if it exists
const distPath = path.resolve(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA fallback to index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
} else {
  app.get('*', (_req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Attendance Tracker Server</title>
          <style>
            body { font-family: sans-serif; padding: 40px; text-align: center; background: #0f172a; color: #fff; }
            h1 { color: #38bdf8; }
            code { background: #1e293b; padding: 4px 8px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>Attendance Tracker Windows Server</h1>
          <p>The production build is not yet generated.</p>
          <p>Run <code>npm run build</code> in the server terminal, then restart.</p>
        </body>
      </html>
    `);
  });
}

app.listen(Number(PORT), HOST, () => {
  console.log(`===================================================`);
  console.log(` Office Attendance Tracker Local Windows Server    `);
  console.log(`===================================================`);
  console.log(` Local URL:    http://localhost:${PORT}`);
  console.log(` LAN Network:  http://${HOST}:${PORT}`);
  console.log(` Database:     ${dbFilePath}`);
  console.log(` Ready for office employee and admin access.`);
  console.log(`===================================================`);
});
