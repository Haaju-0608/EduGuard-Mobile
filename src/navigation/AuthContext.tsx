import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { loginApi, clearSession, loadSession } from '../api/auth';
import { setAuthToken, setOnAuthError } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  email: string;
  name: string;
  studentId: string;
  role: 'student' | 'lecturer' | 'schoolAdmin' | 'superAdmin';
  hasRegisteredFace: boolean;
}

interface AuthState {
  isLoggedIn: boolean;
  hasRegisteredFace: boolean;
  user: AppUser | null;
  booting: boolean;
}

interface AuthContextType {
  authState: AuthState;
  login: (email: string, password: string) => Promise<void>;
  completeFaceRegistration: () => void;
  logout: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_MAP: Record<string, AppUser['role']> = {
  Student:    'student',
  Lecturer:   'lecturer',
  SchoolAdmin: 'schoolAdmin',
  SuperAdmin: 'superAdmin',
};

function faceKey(email: string) {
  return `face_registered_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

async function isFaceRegistered(email: string): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(faceKey(email));
    return val === 'true';
  } catch {
    return false;
  }
}

async function saveFaceRegistered(email: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(faceKey(email), 'true');
  } catch { /* ignore */ }
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  authState: { isLoggedIn: false, hasRegisteredFace: false, user: null, booting: true },
  login: async () => {},
  completeFaceRegistration: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isLoggedIn: false,
    hasRegisteredFace: false,
    user: null,
    booting: true,
  });

  // ── Restore session on boot ────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const session = await loadSession();
      if (session) {
        setAuthToken(session.token);
        const alreadyRegistered = await isFaceRegistered(session.user.email);
        setAuthState({
          isLoggedIn: true,
          hasRegisteredFace: alreadyRegistered,
          booting: false,
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.fullName,
            studentId: session.user.studentCode ?? '',
            role: ROLE_MAP[session.user.role] ?? 'student',
            hasRegisteredFace: alreadyRegistered,
          },
        });
      } else {
        setAuthState((prev) => ({ ...prev, booting: false }));
      }
    })();
  }, []);

  // ── Auto-logout on 401 ─────────────────────────────────────────────────────

  useEffect(() => {
    setOnAuthError(() => {
      setAuthToken(null);
      clearSession();
      setAuthState({ isLoggedIn: false, hasRegisteredFace: false, user: null, booting: false });
    });
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────

  const login = async (email: string, password: string) => {
    const { me } = await loginApi(email, password);
    const alreadyRegistered = await isFaceRegistered(me.email);

    const user: AppUser = {
      id: me.id,
      email: me.email,
      name: me.fullName,
      studentId: me.studentCode ?? '',
      role: ROLE_MAP[me.role] ?? 'student',
      hasRegisteredFace: alreadyRegistered,
    };

    setAuthState({ isLoggedIn: true, hasRegisteredFace: alreadyRegistered, user, booting: false });
  };

  // ── Complete face registration ─────────────────────────────────────────────

  const completeFaceRegistration = () => {
    if (authState.user?.email) saveFaceRegistered(authState.user.email);
    setAuthState((prev) => ({ ...prev, hasRegisteredFace: true }));
  };

  // ── Logout ─────────────────────────────────────────────────────────────────

  const logout = () => {
    setAuthToken(null);
    clearSession();
    setAuthState({ isLoggedIn: false, hasRegisteredFace: false, user: null, booting: false });
  };

  return (
    <AuthContext.Provider value={{ authState, login, completeFaceRegistration, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
