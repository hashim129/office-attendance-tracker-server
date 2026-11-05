export default function handler(req, res) {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp =
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
    req.socket?.remoteAddress ||
    'Unknown';
  const cleanIp = String(rawIp).replace(/^::ffff:/, '');
  res.status(200).json({ ip: cleanIp });
}
