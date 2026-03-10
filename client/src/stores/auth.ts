import { create } from "zustand";
import { api } from "../api/client";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions?: { module: string; action: string; resource: string }[];
  tenantId: string;
  tenantName: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string; tenantSlug: string }) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (module: string, action: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem("erp_token"),
  isLoading: true,
  error: null,

  login: async (email, password, tenantSlug) => {
    try {
      set({ error: null, isLoading: true });
      const res = await api.post("/auth/login", { email, password, tenantSlug });
      localStorage.setItem("erp_token", res.token);
      api.setToken(res.token);
      set({ token: res.token, user: res.user, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  register: async (data) => {
    try {
      set({ error: null, isLoading: true });
      await api.post("/auth/register", data);
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem("erp_token");
    api.setToken(null);
    set({ user: null, token: null, error: null });
  },

  loadUser: async () => {
    const token = get().token;
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      api.setToken(token);
      const user = await api.get("/auth/me");
      set({ user, isLoading: false });
    } catch {
      localStorage.removeItem("erp_token");
      api.setToken(null);
      set({ user: null, token: null, isLoading: false });
    }
  },

  hasRole: (role: string) => {
    const user = get().user;
    return user?.roles.includes(role) ?? false;
  },

  hasPermission: (module: string, action: string) => {
    const user = get().user;
    if (!user) return false;
    if (user.roles.includes("admin")) return true;
    return user.permissions?.some((p) => p.module === module && p.action === action) ?? false;
  },
}));
