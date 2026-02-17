import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../services/api';
import { useCartStore } from './cartStore';

interface User {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'sales_rep';
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
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
        useCartStore.getState().setCurrentUser(response.data.user.id);
      },
      logout: () => {
        const { user } = useAuthStore.getState();
        if (user?.id) {
          useCartStore.getState().saveAndClearForUser(user.id);
        } else {
          useCartStore.getState().setCurrentUser(null);
        }
        set({ isAuthenticated: false, user: null, token: null });
        delete api.defaults.headers.common['Authorization'];
      },
      setUser: (user: User) => {
        set({ user });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

