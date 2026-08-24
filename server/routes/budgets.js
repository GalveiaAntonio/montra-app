import { Router } from 'express';
import { pool } from '../db.js';

export const budgetsRouter = Router();

budgetsRouter.get('/', async (req, res) => {
  const result = await pool.query('select * from budgets where user_id = $1', [req.userId]);
  res.json(result.rows);
});

budgetsRouter.post('/', async (req, res) => {
  const { category, limit_amount } = req.body || {};
  if (!category || !limit_amount || limit_amount <= 0) {
    return res.status(400).json({ error: 'The category and limit are mandatory.' });
  }
  const result = await pool.query(
    `insert into budgets (user_id, category, limit_amount) values ($1,$2,$3)
     on conflict (user_id, category) do update set limit_amount = excluded.limit_amount
     returning *`,
    [req.userId, category, limit_amount]
  );
  res.status(201).json(result.rows[0]);
});

budgetsRouter.delete('/:id', async (req, res) => {
  await pool.query('delete from budgets where id = $1 and user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
});
