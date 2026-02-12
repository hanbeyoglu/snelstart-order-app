import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../services/api';

interface User {
  id: string;
  username: string;
  email?: string;
  role: 'admin' | 'sales_rep';
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      login: async (email: string, password: string) => {
        const response = await api.post('/auth/login', { email, password });
        set({
          isAuthenticated: true,
          user: response.data.user,
          token: response.data.access_token,
        });
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
      },
      logout: () => {
        set({ isAuthenticated: false, user: null, token: null });
        delete api.defaults.headers.common['Authorization'];
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

