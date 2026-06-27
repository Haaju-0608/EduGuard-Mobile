import React, { createContext, useContext, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────────
export interface MockUser {
  email: string;
  name: string;
  studentId: string;
  class: string;
  hasRegisteredFace: boolean;
  role: 'student' | 'lecturer';
}

interface AuthState {
  isLoggedIn: boolean;
  hasRegisteredFace: boolean;
  user: MockUser | null;
}

interface AuthContextType {
  authState: AuthState;
  login: (user: MockUser) => void;
  completeFaceRegistration: () => void;
  logout: () => void;
}

// ── Mock user database ───────────────────────────────────────────────────────────
export const MOCK_USERS: Record<string, MockUser> = {
  'student@edu.vn': {
    email: 'student@edu.vn',
    name: 'Tran Nguyen Khanh',
    studentId: '20227183',
    class: 'IT-K66-A2',
    hasRegisteredFace: false,
    role: 'student',
  },
  'lecturer@edu.vn': {
    email: 'lecturer@edu.vn',
    name: 'Nguyen Van An',
    studentId: '20215678',
    class: 'IT-K65-B1',
    hasRegisteredFace: true,
    role: 'lecturer',
  },
};

// Persists within the app session: once a user registers their face, they won't
// be prompted again on subsequent logins (until the app is fully restarted).
const faceRegisteredCache = new Set<string>();

export function resolveUser(email: string): MockUser {
  const base =
    MOCK_USERS[email.trim().toLowerCase()] ?? {
      email: email.trim().toLowerCase(),
      name: 'Student User',
      studentId: '20229999',
      class: 'IT-K67-A1',
      hasRegisteredFace: false,
      role: 'student' as const,
    };

  return {
    ...base,
    hasRegisteredFace: base.hasRegisteredFace || faceRegisteredCache.has(base.email),
  };
}

// ── Context ──────────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType>({
  authState: { isLoggedIn: false, hasRegisteredFace: false, user: null },
  login: () => {},
  completeFaceRegistration: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isLoggedIn: false,
    hasRegisteredFace: false,
    user: null,
  });

  const login = (user: MockUser) => {
    setAuthState({ isLoggedIn: true, hasRegisteredFace: user.hasRegisteredFace, user });
  };

  const completeFaceRegistration = () => {
    // Cache so this email skips face registration on future logins this session
    if (authState.user?.email) {
      faceRegisteredCache.add(authState.user.email);
    }
    setAuthState((prev) => ({ ...prev, hasRegisteredFace: true }));
  };

  const logout = () => {
    setAuthState({ isLoggedIn: false, hasRegisteredFace: false, user: null });
  };

  return (
    <AuthContext.Provider value={{ authState, login, completeFaceRegistration, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
