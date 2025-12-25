import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Auth from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import '@/styles/global.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!role) return <Navigate to="/auth" replace />;
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
