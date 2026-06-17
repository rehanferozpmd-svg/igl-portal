import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  let state = req.query.state;
  if (!state && req.user.role === 'employee') state = req.user.employee?.state || null;
  let rows;
  if (state) {
    rows = db.prepare(`SELECT * FROM holidays WHERE strftime('%Y', date) = ? AND (state = 'ALL' OR state = ?) ORDER BY date`).all(String(year), state);
  } else {
    rows = db.prepare(`SELECT * FROM holidays WHERE strftime('%Y', date) = ? ORDER BY date`).all(String(year));
  }
  res.json(rows);
});

router.post('/', authorize('admin'), (req, res) => {
  const { name, date, state, is_optional } = req.body || {};
  if (!name || !date) return res.status(400).json({ error: 'name and date required' });
  const id = db.prepare('INSERT INTO holidays (name, date, state, is_optional) VALUES (?,?,?,?)').run(name, date, state || 'ALL', is_optional ? 1 : 0).lastInsertRowid;
  logAudit(req.user.id, 'create', 'holiday', id);
  res.status(201).json({ id });
});

router.put('/:id', authorize('admin'), (req, res) => {
  const { name, date, state, is_optional } = req.body || {};
  db.prepare('UPDATE holidays SET name = COALESCE(?, name), date = COALESCE(?, date), state = COALESCE(?, state), is_optional = COALESCE(?, is_optional) WHERE id = ?').run(name, date, state, is_optional, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM holidays WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
