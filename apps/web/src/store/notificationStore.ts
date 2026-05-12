import { create } from 'zustand';
import api from '../services/api';
import type { AppNotification } from '@snelstart-order-app/shared';

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  total: number;
  isLoading: boolean;
  isOpen: boolean;

  fetchNotifications: (page?: number) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  setOpen: (open: boolean) => void;
  startPolling: () => () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  total: 0,
  isLoading: false,
  isOpen: false,

  fetchNotifications: async (page = 1) => {
    set({ isLoading: true });
    try {
      const res = await api.get('/notifications', { params: { page, limit: 20 } });
      const { data, total, unreadCount } = res.data;
      set({ notifications: data, total, unreadCount, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      set({ unreadCount: res.data.count });
    } catch {
      // silent
    }
  },

  markAsRead: async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n._id === id ? { ...n, isRead: true } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // silent
    }
  },

  markAllAsRead: async () => {
    try {
      await api.put('/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch {
      // silent
    }
  },

  setOpen: (open: boolean) => {
    set({ isOpen: open });
    if (open) {
      void get().fetchNotifications();
    }
  },

  startPolling: () => {
    void get().fetchUnreadCount();
    const interval = setInterval(() => {
      void get().fetchUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  },
}));
