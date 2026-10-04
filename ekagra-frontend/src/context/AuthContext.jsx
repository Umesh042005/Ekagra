import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const TOKEN_KEY = 'ekagra_token';
const ROLE_KEY  = 'ekagra_role';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [role,  setRole]  = useState(() => localStorage.getItem(ROLE_KEY)  || null);

  // Keep localStorage in sync whenever state changes
  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else        localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    if (role) localStorage.setItem(ROLE_KEY, role);
    else      localStorage.removeItem(ROLE_KEY);
  }, [role]);

  const login = ({ access_token, role: userRole }) => {
    setToken(access_token);
    setRole(userRole);
  };

  const logout = () => {
    setToken(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
