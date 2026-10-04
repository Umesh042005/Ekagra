import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import StudentDashboard from './pages/StudentDashboard';
import CoachDashboard from './pages/CoachDashboard';
import SessionsPage from './pages/SessionsPage';
import StudentsPage from './pages/StudentsPage';
import ProgressPage from './pages/ProgressPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import ProtectedRoute from './components/ProtectedRoute';
import { homePathForRole } from './utils/roles';

/** Redirect "/" to the right home page (or login if not authenticated) */
function RootRedirect() {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={homePathForRole(role)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Student Dedicated Routes */}
          <Route
            path="/student"
            element={<Navigate to="/student/home" replace />}
          />
          <Route
            path="/student/home"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/sessions"
            element={
              <ProtectedRoute requiredRole="student">
                <SessionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/progress"
            element={
              <ProtectedRoute requiredRole="student">
                <ProgressPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/profile"
            element={
              <ProtectedRoute requiredRole="student">
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Mentor Dedicated Routes (role is stored as 'coach' internally) */}
          <Route
            path="/mentor"
            element={<Navigate to="/mentor/home" replace />}
          />
          <Route
            path="/mentor/home"
            element={
              <ProtectedRoute requiredRole="coach">
                <CoachDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mentor/sessions"
            element={
              <ProtectedRoute requiredRole="coach">
                <SessionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mentor/students"
            element={
              <ProtectedRoute requiredRole="coach">
                <StudentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mentor/progress"
            element={
              <ProtectedRoute requiredRole="coach">
                <ProgressPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mentor/profile"
            element={
              <ProtectedRoute requiredRole="coach">
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Admin Route */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPage />
              </ProtectedRoute>
            }
          />

          {/* Old /coach/* links now live under /mentor */}
          <Route path="/coach/*" element={<Navigate to="/mentor/home" replace />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
