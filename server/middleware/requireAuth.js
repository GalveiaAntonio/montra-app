import { readToken } from '../auth.js';

export function requireAuth(req, res, next) {
  const userId = readToken(req);
  if (!userId) {
    return res.status(401).json({ error: 'Your session is invalid or expired.' });
  }
  req.userId = userId;
  next();
}
