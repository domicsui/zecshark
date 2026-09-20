const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'zeckshark-secret-key-arcade-2026-production';

function requireAdmin(req, res, next) {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.zeckshark_token) {
    token = req.cookies.zeckshark_token;
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Access denied.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Invalid or expired session token.' });
  }
}

module.exports = {
  requireAdmin,
  JWT_SECRET
};
