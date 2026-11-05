import fs from 'fs';
import path from 'path';

const TMP_DB_PATH = path.join('/tmp', 'office_attendance_db.json');

export default function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if (fs.existsSync(TMP_DB_PATH)) {
        const raw = fs.readFileSync(TMP_DB_PATH, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(raw);
      }
      return res.status(200).json({ empty: true });
    }

    if (req.method === 'POST') {
      const bodyStr =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      fs.writeFileSync(TMP_DB_PATH, bodyStr, 'utf-8');
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
