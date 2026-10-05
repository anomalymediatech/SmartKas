import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SessionUser {
  id: number;
  username: string;
  role: string;
  token: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'smartkas.session_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hasStoredToken] = useState(() => localStorage.getItem(TOKEN_KEY) !== null);
  const [isLoading, setIsLoading] = useState(hasStoredToken);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return;
    }
    invoke<SessionUser>('check_session', { token })
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const u = await invoke<SessionUser>('login', { username, password });
    localStorage.setItem(TOKEN_KEY, u.token);
    setUser(u);
  };

  const logout = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      invoke('logout', { token }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
