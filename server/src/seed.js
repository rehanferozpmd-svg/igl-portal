import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db from './db.js';

const hash = (p) => bcrypt.hashSync(p, 10);

console.log('Seeding HRMS database...');

db.exec('DELETE FROM notifications; DELETE FROM feedback; DELETE FROM documents; DELETE FROM payroll; DELETE FROM attendance; DELETE FROM leaves; DELETE FROM leave_balances; DELETE FROM holidays; DELETE FROM leave_types; DELETE FROM employees; DELETE FROM teams; DELETE FROM departments; DELETE FROM users; DELETE FROM audit_logs;');

// Departments
const deptIds = {};
for (const d of [
  ['Engineering', 'Product development and infrastructure'],
  ['Human Resources', 'People operations'],
  ['Sales', 'Revenue and partnerships'],
  ['Marketing', 'Brand and growth'],
  ['Finance', 'Accounting and payroll'],
]) {
  deptIds[d[0]] = db.prepare('INSERT INTO departments (name, description) VALUES (?,?)').run(d[0], d[1]).lastInsertRowid;
}

// Leave types
const lt = (name, code, days, paid, gender) =>
  db.prepare('INSERT INTO leave_types (name, code, days_per_year, is_paid, gender_specific) VALUES (?,?,?,?,?)').run(name, code, days, paid, gender).lastInsertRowid;
const ltIds = {
  CL: lt('Casual Leave', 'CL', 12, 1, null),
  SL: lt('Sick Leave', 'SL', 10, 1, null),
  EL: lt('Earned Leave', 'EL', 15, 1, null),
  WFH: lt('Work From Home', 'WFH', 24, 1, null),
  ML: lt('Maternity Leave', 'ML', 180, 1, 'female'),
  PL: lt('Paternity Leave', 'PL', 10, 1, 'male'),
};

// Holidays — India 2026 examples (mixed national + state)
const holidays2026 = [
  ['New Year', '2026-01-01', 'ALL'],
  ['Republic Day', '2026-01-26', 'ALL'],
  ['Holi', '2026-03-04', 'ALL'],
  ['Good Friday', '2026-04-03', 'ALL'],
  ['Tamil New Year', '2026-04-14', 'TN'],
  ['Maharashtra Day', '2026-05-01', 'MH'],
  ['Independence Day', '2026-08-15', 'ALL'],
  ['Ganesh Chaturthi', '2026-09-14', 'MH'],
  ['Gandhi Jayanti', '2026-10-02', 'ALL'],
  ['Diwali', '2026-11-08', 'ALL'],
  ['Kannada Rajyotsava', '2026-11-01', 'KA'],
  ['Christmas', '2026-12-25', 'ALL'],
];
holidays2026.forEach(([n, d, s]) => db.prepare('INSERT INTO holidays (name, date, state) VALUES (?,?,?)').run(n, d, s));

// Users + Employees
function createEmployee(opts) {
  const { email, password, role, first_name, last_name, joining_date, designation, dept, state, gender, basic, hra, allowances, deductions, manager_id, phone } = opts;
  const userId = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)').run(email.toLowerCase(), hash(password), role).lastInsertRowid;
  const code = `IGN${String(userId).padStart(4,'0')}`;
  const empId = db.prepare(`INSERT INTO employees
    (user_id, employee_code, first_name, last_name, phone, dob, gender, address, state, joining_date, designation, department_id, manager_id, bank_name, bank_account, ifsc, pan, basic_salary, hra, allowances, deductions)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    userId, code, first_name, last_name, phone || '9000000000', '1992-06-15', gender, '123 Park Street', state,
    joining_date, designation, deptIds[dept], manager_id || null,
    'HDFC Bank', `XXXX${userId}1234`, 'HDFC0001234', `ABCDE${userId}234F`,
    basic, hra, allowances, deductions
  ).lastInsertRowid;
  return { userId, empId };
}

// Admin
const admin = createEmployee({
  email: 'admin@igenielabs.com', password: 'Admin@123', role: 'admin',
  first_name: 'Aanya', last_name: 'Sharma', joining_date: '2022-04-01',
  designation: 'HR Director', dept: 'Human Resources', state: 'KA', gender: 'female',
  basic: 80000, hra: 32000, allowances: 18000, deductions: 5000
});

// Managers
const mgrEng = createEmployee({
  email: 'manager@igenielabs.com', password: 'Manager@123', role: 'manager',
  first_name: 'Praneel', last_name: 'Kumar', joining_date: '2026-01-01',
  designation: 'Director, India Operations', dept: 'Engineering', state: 'AP', gender: 'male',
  basic: 90000, hra: 36000, allowances: 20000, deductions: 6000
});
const mgrSales = createEmployee({
  email: 'sales.manager@igenielabs.com', password: 'Manager@123', role: 'manager',
  first_name: 'Priya', last_name: 'Iyer', joining_date: '2022-11-01',
  designation: 'Sales Manager', dept: 'Sales', state: 'TN', gender: 'female',
  basic: 75000, hra: 30000, allowances: 15000, deductions: 5000
});

// Employees
const emp1 = createEmployee({
  email: 'employee@igenielabs.com', password: 'Employee@123', role: 'employee',
  first_name: 'Karthik', last_name: 'Rao', joining_date: '2024-02-10',
  designation: 'Software Engineer', dept: 'Engineering', state: 'KA', gender: 'male',
  basic: 50000, hra: 20000, allowances: 10000, deductions: 3000,
  manager_id: mgrEng.empId
});
const emp2 = createEmployee({
  email: 'meera@igenielabs.com', password: 'Employee@123', role: 'employee',
  first_name: 'Meera', last_name: 'Nair', joining_date: '2023-07-15',
  designation: 'Senior Software Engineer', dept: 'Engineering', state: 'KA', gender: 'female',
  basic: 65000, hra: 26000, allowances: 14000, deductions: 4000,
  manager_id: mgrEng.empId
});
const emp3 = createEmployee({
  email: 'arjun@igenielabs.com', password: 'Employee@123', role: 'employee',
  first_name: 'Arjun', last_name: 'Verma', joining_date: '2024-09-01',
  designation: 'Sales Executive', dept: 'Sales', state: 'MH', gender: 'male',
  basic: 40000, hra: 16000, allowances: 8000, deductions: 2500,
  manager_id: mgrSales.empId
});
const emp4 = createEmployee({
  email: 'ananya@igenielabs.com', password: 'Employee@123', role: 'employee',
  first_name: 'Ananya', last_name: 'Krishnan', joining_date: '2025-01-15',
  designation: 'Marketing Specialist', dept: 'Marketing', state: 'TN', gender: 'female',
  basic: 45000, hra: 18000, allowances: 9000, deductions: 3000
});

// Teams
const teamEng = db.prepare('INSERT INTO teams (name, department_id, manager_id) VALUES (?,?,?)').run('Platform Team', deptIds.Engineering, mgrEng.empId).lastInsertRowid;
const teamSales = db.prepare('INSERT INTO teams (name, department_id, manager_id) VALUES (?,?,?)').run('Enterprise Sales', deptIds.Sales, mgrSales.empId).lastInsertRowid;
db.prepare('UPDATE employees SET team_id = ? WHERE id IN (?,?)').run(teamEng, emp1.empId, emp2.empId);
db.prepare('UPDATE employees SET team_id = ? WHERE id = ?').run(teamSales, emp3.empId);

// Initialize leave balances for current year (full year, prorata for those joined this year)
const currentYear = new Date().getFullYear();
const types = db.prepare('SELECT * FROM leave_types').all();
const allEmps = db.prepare('SELECT * FROM employees').all();
for (const e of allEmps) {
  const joinedThisYear = new Date(e.joining_date).getFullYear() === currentYear;
  const monthsRemaining = joinedThisYear ? Math.max(1, 12 - new Date(e.joining_date).getMonth()) : 12;
  for (const t of types) {
    if (t.gender_specific && e.gender && t.gender_specific.toLowerCase() !== e.gender.toLowerCase()) continue;
    const total = Math.round((t.days_per_year * monthsRemaining / 12) * 10) / 10;
    db.prepare('INSERT OR IGNORE INTO leave_balances (employee_id, leave_type_id, year, total, used) VALUES (?,?,?,?,0)').run(e.id, t.id, currentYear, total);
  }
}

// Some leave history
const ltCL = ltIds.CL, ltSL = ltIds.SL, ltWFH = ltIds.WFH;
db.prepare("INSERT INTO leaves (employee_id, leave_type_id, start_date, end_date, days, reason, status, approver_id, approved_at) VALUES (?,?,?,?,?,?, 'approved', ?, datetime('now', '-20 days'))").run(emp1.empId, ltCL, '2026-04-15', '2026-04-16', 2, 'Family function', mgrEng.empId);
db.prepare("INSERT INTO leaves (employee_id, leave_type_id, start_date, end_date, days, reason, status) VALUES (?,?,?,?,?,?, 'pending')").run(emp1.empId, ltWFH, '2026-06-02', '2026-06-03', 2, 'Internet upgrade at home');
db.prepare("INSERT INTO leaves (employee_id, leave_type_id, start_date, end_date, days, reason, status) VALUES (?,?,?,?,?,?, 'pending')").run(emp2.empId, ltSL, '2026-05-28', '2026-05-28', 1, 'Fever');
db.prepare('UPDATE leave_balances SET used = 2 WHERE employee_id = ? AND leave_type_id = ? AND year = ?').run(emp1.empId, ltCL, currentYear);

// Attendance for past 20 days for all employees
const today = new Date();
for (const e of allEmps) {
  for (let i = 1; i <= 20; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const dateStr = d.toISOString().slice(0,10);
    const inT = new Date(d); inT.setHours(9, Math.floor(Math.random()*30), 0);
    const outT = new Date(d); outT.setHours(18, Math.floor(Math.random()*40), 0);
    const hours = Math.round(((outT - inT)/36e5)*100)/100;
    db.prepare('INSERT OR IGNORE INTO attendance (employee_id, date, check_in, check_out, working_hours, status) VALUES (?,?,?,?,?, ?)')
      .run(e.id, dateStr, inT.toISOString(), outT.toISOString(), hours, 'present');
  }
}

// Generate one payroll month for everyone (last month)
const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
const pMonth = lastMonth.getMonth() + 1, pYear = lastMonth.getFullYear();
for (const e of allEmps) {
  const gross = e.basic_salary + e.hra + e.allowances;
  const net = gross - e.deductions;
  db.prepare(`INSERT OR REPLACE INTO payroll (employee_id, month, year, basic, hra, allowances, deductions, gross_pay, net_pay, working_days, paid_days)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(e.id, pMonth, pYear, e.basic_salary, e.hra, e.allowances, e.deductions, gross, net, 22, 22);
}

// Feedback
db.prepare(`INSERT INTO feedback (employee_id, manager_id, period, strengths, improvements, goals, rating)
  VALUES (?,?,?,?,?,?,?)`).run(emp1.empId, mgrEng.empId, 'Q1 2026',
  'Strong technical contributor, excellent code reviews, mentors juniors well.',
  'Could improve cross-team communication and documentation habits.',
  'Lead the search service migration, complete AWS certification.', 4.2);
db.prepare(`INSERT INTO feedback (employee_id, manager_id, period, strengths, improvements, goals, rating)
  VALUES (?,?,?,?,?,?,?)`).run(emp2.empId, mgrEng.empId, 'Q1 2026',
  'Outstanding architecture skills, drives technical decisions.',
  'Take on more mentorship of junior engineers.',
  'Architect the new payments platform; hire 2 senior engineers.', 4.6);

// Notifications
db.prepare("INSERT INTO notifications (user_id, title, message, type, link) VALUES (?,?,?,?,?)")
  .run(emp1.userId, 'Welcome to IGL Portal', 'Your portal is ready. Explore your dashboard, leaves and payslips.', 'info', '/');
db.prepare("INSERT INTO notifications (user_id, title, message, type, link) VALUES (?,?,?,?,?)")
  .run(emp1.userId, 'Payslip available', `Your payslip for ${String(pMonth).padStart(2,'0')}/${pYear} is ready.`, 'payroll', '/payslips');
db.prepare("INSERT INTO notifications (user_id, title, message, type, link) VALUES (?,?,?,?,?)")
  .run(mgrEng.userId, 'New leave request', 'Karthik Rao requested 2 day(s) of WFH', 'leave', '/leaves');
db.prepare("INSERT INTO notifications (user_id, title, message, type, link) VALUES (?,?,?,?,?)")
  .run(admin.userId, 'New leave request', 'Meera Nair requested 1 day of Sick Leave', 'leave', '/leaves');

console.log('Seed complete!\n');
console.log('  Admin    : admin@igenielabs.com / Admin@123');
console.log('  Manager  : manager@igenielabs.com / Manager@123  (Engineering)');
console.log('  Manager  : sales.manager@igenielabs.com / Manager@123');
console.log('  Employee : employee@igenielabs.com / Employee@123');
console.log('  Employee : meera@igenielabs.com / Employee@123');
console.log('  Employee : arjun@igenielabs.com / Employee@123');
console.log('  Employee : ananya@igenielabs.com / Employee@123');
