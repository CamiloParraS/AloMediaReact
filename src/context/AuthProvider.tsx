import { createContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { me, signout } from "../services/authService";
import type { MeResponse } from "../types/authTypes";
import type { User } from "../types/userTypes";

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Set the user after a successful login/register (token lives in httpOnly cookie). */
  login: (user: User) => void;
  /** Call the backend logout endpoint and clear local state. */
  logout: () => Promise<void>;
}

// Context

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider 

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Derived — never touches localStorage
  const isAuthenticated = user !== null;

  // On mount: verify the session via the httpOnly cookie
  useEffect(() => {
    let cancelled = false;

    async function verify() {
      try {
        const data: MeResponse = await me();

        if (!cancelled) {
          if (data.authenticated && data.user) {
            setUser(data.user);
          } else {
            setUser(null);
          }
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    verify();
    return () => { cancelled = true; };
  }, []);

  /** Called after loginRequest / registerRequest succeeds. */
  const login = useCallback((u: User) => {
    setUser(u);
  }, []);

  /** Logout: hit the backend then wipe local state. */
  const logout = useCallback(async () => {
    try {
      await signout();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
