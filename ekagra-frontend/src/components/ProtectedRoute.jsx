import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../utils/roles';

/**
 * Wraps a route to:
 *  1. Redirect unauthenticated users to /login
 *  2. Redirect authenticated users to the correct dashboard based on role
 */
export default function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user is authenticated but hits the wrong role's route, redirect them
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  return children;
}
