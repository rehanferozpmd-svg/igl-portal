import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import Profile from './pages/Profile';
import Leaves from './pages/Leaves';
import Attendance from './pages/Attendance';
import Payroll from './pages/Payroll';
import Payslips from './pages/Payslips';
import Holidays from './pages/Holidays';
import Feedback from './pages/Feedback';
import Notifications from './pages/Notifications';
import Documents from './pages/Documents';
import Reports from './pages/Reports';
import Organization from './pages/Organization';
import ActionCenter from './pages/ActionCenter';

function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/employees" element={<RoleRoute roles={['admin','manager']}><Employees /></RoleRoute>} />
        <Route path="/employees/:id" element={<EmployeeDetail />} />
        <Route path="/leaves" element={<Leaves />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/payroll" element={<RoleRoute roles={['admin']}><Payroll /></RoleRoute>} />
        <Route path="/payslips" element={<Payslips />} />
        <Route path="/holidays" element={<Holidays />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/reports" element={<RoleRoute roles={['admin','manager']}><Reports /></RoleRoute>} />
        <Route path="/organization" element={<RoleRoute roles={['admin']}><Organization /></RoleRoute>} />
        <Route path="/action-center" element={<RoleRoute roles={['manager']}><ActionCenter /></RoleRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
