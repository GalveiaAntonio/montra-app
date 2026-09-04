import { Router } from 'express';
import { pool } from '../db.js';
import { hashPassword, verifyPassword, signToken, setAuthCookie, clearAuthCookie, readToken } from '../auth.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Please, provide a valid email and a password with 6 characters, at least.' });
  }
  try {
    const existing = await pool.query('select id from users where email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'There is already an account registered with that email.' });
    }
    const hash = await hashPassword(password);
    const result = await pool.query(
      'insert into users (email, password_hash) values ($1, $2) returning id, email',
      [email.toLowerCase(), hash]
    );
    const user = result.rows[0];
    setAuthCookie(res, signToken(user.id));
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'There was an error when creating the account.' });
  }
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Provide an email and a password.' });
  }
  try {
    const result = await pool.query('select id, email, password_hash from users where email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email or password incorrect.' });
    }
    setAuthCookie(res, signToken(user.id));
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'There was an error when logging in.' });
  }
});

authRouter.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', async (req, res) => {
  const userId = readToken(req);
    if (!userId) return res.status(401).json({ error: 'No session.' });

    try {
        const result = await pool.query(
            'select id, email from users where id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'No session.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'There was an error checking the session.' });
    }
});
