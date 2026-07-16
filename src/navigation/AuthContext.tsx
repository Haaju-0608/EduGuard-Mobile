import React, { createContext, useContext, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { loginApi } from '../api/auth';
import { setAuthToken } from '../api/client';

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
}

interface AuthContextType {
  authState: AuthState;
  login: (email: string, password: string) => Promise<void>;
  completeFaceRegistration: () => void;
  logout: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  } catch {
    // Ignore — worst case user re-registers once
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  authState: { isLoggedIn: false, hasRegisteredFace: false, user: null },
  login: async () => {},
  completeFaceRegistration: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isLoggedIn: false,
    hasRegisteredFace: false,
    user: null,
  });

  const login = async (email: string, password: string) => {
    const { me } = await loginApi(email, password);

    const roleMap: Record<string, AppUser['role']> = {
      Student: 'student',
      Lecturer: 'lecturer',
      SchoolAdmin: 'schoolAdmin',
      SuperAdmin: 'superAdmin',
    };

    const alreadyRegistered = await isFaceRegistered(me.email);

    const user: AppUser = {
      id: me.id,
      email: me.email,
      name: me.fullName,
      studentId: me.studentCode ?? '',
      role: roleMap[me.role] ?? 'student',
      hasRegisteredFace: alreadyRegistered,
    };

    setAuthState({
      isLoggedIn: true,
      hasRegisteredFace: alreadyRegistered,
      user,
    });
  };

  const completeFaceRegistration = () => {
    if (authState.user?.email) {
      saveFaceRegistered(authState.user.email);
    }
    setAuthState((prev) => ({ ...prev, hasRegisteredFace: true }));
  };

  const logout = () => {
    setAuthToken(null);
    setAuthState({ isLoggedIn: false, hasRegisteredFace: false, user: null });
  };

  return (
    <AuthContext.Provider value={{ authState, login, completeFaceRegistration, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
