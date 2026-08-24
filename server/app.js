import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

import { authRouter } from './routes/auth.js';
import { transactionsRouter } from './routes/transactions.js';
import { budgetsRouter } from './routes/budgets.js';
import { goalsRouter } from './routes/goals.js';
import { requireAuth } from './middleware/requireAuth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRouter);
app.use('/api/transactions', requireAuth, transactionsRouter);
app.use('/api/budgets', requireAuth, budgetsRouter);
app.use('/api/goals', requireAuth, goalsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));
