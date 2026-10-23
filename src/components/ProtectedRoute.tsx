import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import WorkspaceLoader from '@/components/WorkspaceLoader';

const ProtectedRoute = ({ adminOnly = false }: { adminOnly?: boolean }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <WorkspaceLoader />;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && user?.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
};

export default ProtectedRoute;
