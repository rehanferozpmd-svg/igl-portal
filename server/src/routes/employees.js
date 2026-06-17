import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { logAudit, createNotification } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const employeeSelect = `
  SELECT e.*,
    u.email, u.role, u.is_active,
    d.name as department_name,
    t.name as team_name,
    m.first_name || ' ' || m.last_name as manager_name
  FROM employees e
  LEFT JOIN users u ON u.id = e.user_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN teams t ON t.id = e.team_id
  LEFT JOIN employees m ON m.id = e.manager_id
`;

router.get('/', (req, res) => {
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare(`${employeeSelect} ORDER BY e.first_name`).all();
  } else if (req.user.role === 'manager') {
    rows = db.prepare(`${employeeSelect} WHERE e.manager_id = ? OR e.id = ? ORDER BY e.first_name`).all(req.user.employee.id, req.user.employee.id);
  } else {
    rows = db.prepare(`${employeeSelect} WHERE e.id = ?`).all(req.user.employee.id);
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`${employeeSelect} WHERE e.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'employee' && row.id !== req.user.employee.id) return res.status(403).json({ error: 'Forbidden' });
  res.json(row);
});

router.post('/', authorize('admin'), (req, res) => {
  const b = req.body || {};
  if (!b.email || !b.first_name || !b.last_name || !b.joining_date) {
    return res.status(400).json({ error: 'email, first_name, last_name, joining_date required' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(b.email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Email already exists' });
  const password = b.password || 'Password@123';
  const hash = bcrypt.hashSync(password, 10);
  const role = b.role || 'employee';
  const userId = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)').run(b.email.toLowerCase(), hash, role).lastInsertRowid;
  const code = b.employee_code || `IGN${String(userId).padStart(4, '0')}`;
  const result = db.prepare(`INSERT INTO employees
    (user_id, employee_code, first_name, last_name, phone, dob, gender, address, state, joining_date, designation, department_id, team_id, manager_id, bank_name, bank_account, ifsc, pan, basic_salary, hra, allowances, deductions)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    userId, code, b.first_name, b.last_name, b.phone, b.dob, b.gender, b.address, b.state, b.joining_date, b.designation,
    b.department_id || null, b.team_id || null, b.manager_id || null,
    b.bank_name, b.bank_account, b.ifsc, b.pan,
    b.basic_salary || 0, b.hra || 0, b.allowances || 0, b.deductions || 0
  );
  // initialize leave balances for current year prorata
  initLeaveBalances(result.lastInsertRowid, b.joining_date, b.gender);
  logAudit(req.user.id, 'create', 'employee', result.lastInsertRowid, { email: b.email });
  res.status(201).json({ id: result.lastInsertRowid, defaultPassword: password });
});

router.put('/:id', authorize('admin'), (req, res) => {
  const b = req.body || {};
  const fields = ['first_name','last_name','phone','dob','gender','address','state','joining_date','designation','department_id','team_id','manager_id','employment_status','bank_name','bank_account','ifsc','pan','basic_salary','hra','allowances','deductions'];
  const set = fields.filter(f => f in b).map(f => `${f} = @${f}`).join(', ');
  if (!set) return res.json({ ok: true });
  const data = { id: req.params.id };
  fields.forEach(f => { if (f in b) data[f] = b[f]; });
  db.prepare(`UPDATE employees SET ${set} WHERE id = @id`).run(data);
  if (b.email || b.role) {
    const emp = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(req.params.id);
    if (b.email) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(b.email.toLowerCase(), emp.user_id);
    if (b.role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(b.role, emp.user_id);
  }
  logAudit(req.user.id, 'update', 'employee', req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', authorize('admin'), (req, res) => {
  const emp = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(emp.user_id);
  db.prepare("UPDATE employees SET employment_status = 'inactive' WHERE id = ?").run(req.params.id);
  logAudit(req.user.id, 'deactivate', 'employee', req.params.id);
  res.json({ ok: true });
});

router.post('/:id/reset-password', authorize('admin'), (req, res) => {
  const emp = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Not found' });
  const newPass = req.body.password || 'Password@123';
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPass, 10), emp.user_id);
  createNotification(emp.user_id, 'Password reset', 'Your password was reset by HR. Please log in and change it.', 'security');
  logAudit(req.user.id, 'reset_password', 'user', emp.user_id);
  res.json({ ok: true, password: newPass });
});

function initLeaveBalances(employeeId, joiningDate, gender) {
  const year = new Date().getFullYear();
  const types = db.prepare('SELECT * FROM leave_types').all();
  const joinedThisYear = new Date(joiningDate).getFullYear() === year;
  const monthsRemaining = joinedThisYear ? Math.max(1, 12 - new Date(joiningDate).getMonth()) : 12;
  for (const t of types) {
    if (t.gender_specific && gender && t.gender_specific.toLowerCase() !== gender.toLowerCase()) continue;
    const total = Math.round((t.days_per_year * monthsRemaining / 12) * 10) / 10;
    db.prepare('INSERT OR IGNORE INTO leave_balances (employee_id, leave_type_id, year, total, used) VALUES (?,?,?,?,0)').run(employeeId, t.id, year, total);
  }
}

export default router;
export { initLeaveBalances };
