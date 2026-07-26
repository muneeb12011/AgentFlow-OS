import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  user_id: string;
  email: string;
  name: string;
  tenant_id: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  isTokenExpired: () => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => set({ user, token, isAuthenticated: true }),

      logout: () => set({ user: null, token: null, isAuthenticated: false }),

      isTokenExpired: () => {
        const token = get().token;
        if (!token) return true;
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          return payload.exp * 1000 < Date.now();
        } catch {
          return true;
        }
      },
    }),
    { name: "agentflow-auth" }
  )
);