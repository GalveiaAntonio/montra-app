import { Router } from 'express';
import { pool } from '../db.js';

export const goalsRouter = Router();

goalsRouter.get('/', async (req, res) => {
  const result = await pool.query('select * from goals where user_id = $1 order by created_at asc', [req.userId]);
  res.json(result.rows);
});

goalsRouter.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const target = Number(req.body?.target);
  const current = Number(req.body?.current ?? 0);

  if (
    !name ||
    !Number.isFinite(target) ||
    target <= 0 ||
    !Number.isFinite(current) ||
    current < 0
  ) {
    return res.status(400).json({ error: 'The name and the goal are mandatory.' });
  }
  const result = await pool.query(
    'insert into goals (user_id, name, target, current) values ($1,$2,$3,$4) returning *',
    [req.userId, name, target, current]
  );
  res.status(201).json(result.rows[0]);
});

// Contribui para a meta: soma "amount" ao valor já poupado.
goalsRouter.patch('/:id/contribute', async (req, res) => {
  const amount = Number(req.body?.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Provide a valid value.' });
  }

  const result = await pool.query(
    `update goals set current = current + $1
     where id = $2 and user_id = $3
     returning *`,
    [amount, req.params.id, req.userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Goal was not found.' });
  }

  res.json(result.rows[0]);
});

goalsRouter.delete('/:id', async (req, res) => {
  await pool.query('delete from goals where id = $1 and user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
});
