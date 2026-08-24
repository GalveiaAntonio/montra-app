import { Router } from 'express';
import { pool } from '../db.js';

export const transactionsRouter = Router();

transactionsRouter.get('/', async (req, res) => {
  const result = await pool.query(
    'select * from transactions where user_id = $1 order by date desc, created_at desc',
    [req.userId]
  );
  res.json(result.rows);
});

transactionsRouter.post('/', async (req, res) => {
  const { date, type, category, description, amount } = req.body || {};
  if (!date || !['income', 'expense'].includes(type) || !category || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid entry data.' });
  }
  const result = await pool.query(
    `insert into transactions (user_id, date, type, category, description, amount)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [req.userId, date, type, category, description || '', amount]
  );
  res.status(201).json(result.rows[0]);
});

transactionsRouter.delete('/:id', async (req, res) => {
  await pool.query('delete from transactions where id = $1 and user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
});
