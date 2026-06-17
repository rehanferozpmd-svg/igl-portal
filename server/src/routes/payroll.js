import { Router } from 'express';
import PDFDocument from 'pdfkit';
import db, { logAudit, createNotification } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  const base = `
    SELECT p.*, e.first_name || ' ' || e.last_name as employee_name, e.employee_code, e.designation
    FROM payroll p JOIN employees e ON e.id = p.employee_id
  `;
  const filters = [];
  const params = [];
  if (month) { filters.push('p.month = ?'); params.push(month); }
  if (year) { filters.push('p.year = ?'); params.push(year); }
  if (req.user.role === 'employee') { filters.push('p.employee_id = ?'); params.push(req.user.employee.id); }
  else if (req.user.role === 'manager') { filters.push('(e.manager_id = ? OR e.id = ?)'); params.push(req.user.employee.id, req.user.employee.id); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  res.json(db.prepare(`${base} ${where} ORDER BY p.year DESC, p.month DESC`).all(...params));
});

router.post('/generate', authorize('admin'), (req, res) => {
  const month = Number(req.body.month) || new Date().getMonth() + 1;
  const year = Number(req.body.year) || new Date().getFullYear();
  const employees = db.prepare("SELECT * FROM employees WHERE employment_status = 'active'").all();
  const monthStr = String(month).padStart(2, '0');
  const from = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  let generated = 0;
  for (const e of employees) {
    const attendance = db.prepare(`SELECT COUNT(*) as c FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?`).get(e.id, from, to);
    const approvedLeave = db.prepare(`SELECT COALESCE(SUM(days),0) as d FROM leaves WHERE employee_id = ? AND status = 'approved' AND ((start_date BETWEEN ? AND ?) OR (end_date BETWEEN ? AND ?))`).get(e.id, from, to, from, to);
    const workingDays = lastDay;
    const paidDays = Math.min(workingDays, attendance.c + approvedLeave.d);
    const ratio = workingDays > 0 ? paidDays / workingDays : 1;
    const basic = Math.round(e.basic_salary * ratio);
    const hra = Math.round(e.hra * ratio);
    const allowances = Math.round(e.allowances * ratio);
    const deductions = e.deductions;
    const gross = basic + hra + allowances;
    const net = gross - deductions;
    db.prepare(`INSERT OR REPLACE INTO payroll (employee_id, month, year, basic, hra, allowances, deductions, gross_pay, net_pay, working_days, paid_days)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(e.id, month, year, basic, hra, allowances, deductions, gross, net, workingDays, paidDays);
    createNotification(e.user_id, 'Payslip available', `Your payslip for ${monthStr}/${year} has been generated`, 'payroll', '/payslips');
    generated++;
  }
  logAudit(req.user.id, 'generate_payroll', 'payroll', null, { month, year, generated });
  res.json({ ok: true, generated });
});

router.get('/:id/payslip', (req, res) => {
  const pay = db.prepare(`SELECT p.*, e.* FROM payroll p JOIN employees e ON e.id = p.employee_id WHERE p.id = ?`).get(req.params.id);
  if (!pay) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'employee' && pay.employee_id !== req.user.employee.id) return res.status(403).json({ error: 'Forbidden' });

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="payslip-${pay.employee_code}-${pay.month}-${pay.year}.pdf"`);
  doc.pipe(res);

  // Header bar
  doc.rect(0, 0, doc.page.width, 80).fill('#0f2748');
  doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text('IGL Portal', 50, 28);
  doc.fontSize(10).font('Helvetica').text('Human Resource Management System', 50, 56);
  doc.fillColor('#0f2748');

  doc.moveDown(4);
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f2748').text(`Payslip for ${String(pay.month).padStart(2,'0')}/${pay.year}`, 50, 110);

  doc.moveDown(1.5);
  doc.fontSize(10).fillColor('#222').font('Helvetica');
  const y0 = 150;
  doc.text(`Employee: ${pay.first_name} ${pay.last_name}`, 50, y0);
  doc.text(`Code: ${pay.employee_code}`, 50, y0 + 16);
  doc.text(`Designation: ${pay.designation || '-'}`, 50, y0 + 32);
  doc.text(`Bank: ${pay.bank_name || '-'}`, 300, y0);
  doc.text(`Account: ${pay.bank_account || '-'}`, 300, y0 + 16);
  doc.text(`PAN: ${pay.pan || '-'}`, 300, y0 + 32);

  // Earnings / Deductions table
  const tableY = y0 + 70;
  doc.rect(50, tableY, 495, 24).fill('#0f2748');
  doc.fillColor('white').font('Helvetica-Bold').fontSize(11);
  doc.text('Earnings', 60, tableY + 7);
  doc.text('Amount (INR)', 230, tableY + 7);
  doc.text('Deductions', 320, tableY + 7);
  doc.text('Amount (INR)', 470, tableY + 7);

  doc.fillColor('#222').font('Helvetica').fontSize(10);
  const rows = [
    ['Basic Pay', pay.basic, 'Professional Tax', 0],
    ['HRA', pay.hra, 'PF / Other', pay.deductions],
    ['Allowances', pay.allowances, '', ''],
  ];
  rows.forEach((r, i) => {
    const y = tableY + 24 + i * 22;
    if (i % 2 === 0) doc.rect(50, y, 495, 22).fill('#f4f7fb').fillColor('#222');
    doc.fillColor('#222').text(r[0], 60, y + 6);
    doc.text(r[1] !== '' ? `INR ${Number(r[1]).toLocaleString('en-IN')}` : '', 230, y + 6);
    doc.text(r[2], 320, y + 6);
    doc.text(r[3] !== '' ? `INR ${Number(r[3]).toLocaleString('en-IN')}` : '', 470, y + 6);
  });

  const totalsY = tableY + 24 + rows.length * 22 + 10;
  doc.rect(50, totalsY, 495, 24).fill('#e6efff');
  doc.fillColor('#0f2748').font('Helvetica-Bold').fontSize(11);
  doc.text(`Gross: INR ${pay.gross_pay.toLocaleString('en-IN')}`, 60, totalsY + 7);
  doc.text(`Deductions: INR ${pay.deductions.toLocaleString('en-IN')}`, 250, totalsY + 7);

  const netY = totalsY + 36;
  doc.rect(50, netY, 495, 32).fill('#0f2748');
  doc.fillColor('white').fontSize(14).text(`Net Pay: INR ${pay.net_pay.toLocaleString('en-IN')}`, 60, netY + 9);

  doc.fillColor('#888').font('Helvetica').fontSize(9);
  doc.text(`Working Days: ${pay.working_days}  |  Paid Days: ${pay.paid_days}`, 50, netY + 50);
  doc.text('This is a system-generated payslip and does not require a signature.', 50, netY + 65);

  doc.end();
});

export default router;
