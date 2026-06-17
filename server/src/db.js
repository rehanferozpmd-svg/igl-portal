import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'hrms.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','manager','employee')),
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  manager_id INTEGER
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE REFERENCES users(id),
  employee_code TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  dob TEXT,
  gender TEXT,
  address TEXT,
  state TEXT,
  joining_date TEXT NOT NULL,
  designation TEXT,
  department_id INTEGER REFERENCES departments(id),
  team_id INTEGER REFERENCES teams(id),
  manager_id INTEGER REFERENCES employees(id),
  employment_status TEXT DEFAULT 'active',
  bank_name TEXT,
  bank_account TEXT,
  ifsc TEXT,
  pan TEXT,
  basic_salary REAL DEFAULT 0,
  hra REAL DEFAULT 0,
  allowances REAL DEFAULT 0,
  deductions REAL DEFAULT 0,
  photo_url TEXT
);

CREATE TABLE IF NOT EXISTS leave_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  days_per_year INTEGER DEFAULT 0,
  is_paid INTEGER DEFAULT 1,
  gender_specific TEXT
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER REFERENCES employees(id),
  leave_type_id INTEGER REFERENCES leave_types(id),
  year INTEGER NOT NULL,
  total REAL DEFAULT 0,
  used REAL DEFAULT 0,
  UNIQUE(employee_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER REFERENCES employees(id),
  leave_type_id INTEGER REFERENCES leave_types(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days REAL NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
  approver_id INTEGER REFERENCES employees(id),
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  comments TEXT
);

CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  state TEXT DEFAULT 'ALL',
  is_optional INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER REFERENCES employees(id),
  date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  working_hours REAL DEFAULT 0,
  status TEXT DEFAULT 'present',
  UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS payroll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER REFERENCES employees(id),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  basic REAL DEFAULT 0,
  hra REAL DEFAULT 0,
  allowances REAL DEFAULT 0,
  deductions REAL DEFAULT 0,
  gross_pay REAL DEFAULT 0,
  net_pay REAL DEFAULT 0,
  working_days INTEGER DEFAULT 0,
  paid_days INTEGER DEFAULT 0,
  generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, month, year)
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER REFERENCES employees(id),
  manager_id INTEGER REFERENCES employees(id),
  period TEXT NOT NULL,
  strengths TEXT,
  improvements TEXT,
  goals TEXT,
  rating REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER REFERENCES employees(id),
  name TEXT NOT NULL,
  type TEXT,
  file_path TEXT NOT NULL,
  size INTEGER,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT,
  type TEXT,
  is_read INTEGER DEFAULT 0,
  link TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

export default db;

export function logAudit(userId, action, entity, entityId, details) {
  try {
    db.prepare(
      'INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES (?,?,?,?,?)'
    ).run(userId || null, action, entity || null, entityId || null, details ? JSON.stringify(details) : null);
  } catch {}
}

export function createNotification(userId, title, message, type, link) {
  db.prepare(
    'INSERT INTO notifications (user_id, title, message, type, link) VALUES (?,?,?,?,?)'
  ).run(userId, title, message, type || 'info', link || null);
}
