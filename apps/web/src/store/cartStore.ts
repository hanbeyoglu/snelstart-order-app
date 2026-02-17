import { create } from 'zustand';
import { CartItem } from '@snelstart-order-app/shared';

const CART_KEY_PREFIX = 'cart-user-';
const LEGACY_CART_KEY = 'cart-storage';

function loadCartForUser(userId: string): { items: CartItem[]; customerId: string | null } {
  try {
    let raw = localStorage.getItem(`${CART_KEY_PREFIX}${userId}`);
    // Eski tek sepet formatından kullanıcıya taşı (sadece ilk yüklemede)
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_CART_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        const state = parsed?.state ?? parsed;
        const items = state?.items ?? [];
        const customerId = state?.customerId ?? null;
        if (items.length > 0 || customerId) {
          saveCartForUser(userId, items, customerId);
          localStorage.removeItem(LEGACY_CART_KEY);
          return { items, customerId };
        }
      }
      return { items: [], customerId: null };
    }
    const parsed = JSON.parse(raw);
    return {
      items: parsed.items ?? [],
      customerId: parsed.customerId ?? null,
    };
  } catch {
    return { items: [], customerId: null };
  }
}

function saveCartForUser(userId: string, items: CartItem[], customerId: string | null) {
  try {
    localStorage.setItem(
      `${CART_KEY_PREFIX}${userId}`,
      JSON.stringify({ items, customerId }),
    );
  } catch (e) {
    console.error('[CartStore] Failed to save cart:', e);
  }
}

interface CartState {
  items: CartItem[];
  customerId: string | null;
  currentUserId: string | null;
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateUnitPrice: (productId: string, unitPrice: number) => void;
  resetToOriginalPrice: (productId: string) => void;
  removeItem: (productId: string) => void;
  setCustomer: (customerId: string | null) => void;
  clear: () => void;
  /** Kullanıcıya özel sepeti yükle. logout'ta null ile çağrılır. */
  setCurrentUser: (userId: string | null) => void;
  /** Çıkışta mevcut kullanıcının sepetini kaydedip temizle */
  saveAndClearForUser: (userId: string) => void;
}

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  customerId: null,
  currentUserId: null,

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId);
      const nextItems = existing
        ? state.items.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + item.quantity }
              : i,
          )
        : [...state.items, item];
      if (state.currentUserId) {
        saveCartForUser(state.currentUserId, nextItems, state.customerId);
      }
      return { items: nextItems };
    }),

  updateQuantity: (productId, quantity) =>
    set((state) => {
      const nextItems =
        quantity <= 0
          ? state.items.filter((i) => i.productId !== productId)
          : state.items.map((i) =>
              i.productId === productId ? { ...i, quantity } : i,
            );
      if (state.currentUserId) {
        saveCartForUser(state.currentUserId, nextItems, state.customerId);
      }
      return { items: nextItems };
    }),

  updateUnitPrice: (productId, unitPrice) =>
    set((state) => {
      const nextItems = state.items.map((i) =>
        i.productId === productId
          ? {
              ...i,
              customUnitPrice: unitPrice,
              totalPrice: unitPrice * i.quantity,
            }
          : i,
      );
      if (state.currentUserId) {
        saveCartForUser(state.currentUserId, nextItems, state.customerId);
      }
      return { items: nextItems };
    }),

  resetToOriginalPrice: (productId) =>
    set((state) => {
      const item = state.items.find((i) => i.productId === productId);
      if (!item) return state;
      const nextItems = state.items.map((i) =>
        i.productId === productId
          ? {
              ...i,
              customUnitPrice: undefined,
              totalPrice: i.unitPrice * i.quantity,
            }
          : i,
      );
      if (state.currentUserId) {
        saveCartForUser(state.currentUserId, nextItems, state.customerId);
      }
      return { items: nextItems };
    }),

  removeItem: (productId) =>
    set((state) => {
      const nextItems = state.items.filter((i) => i.productId !== productId);
      if (state.currentUserId) {
        saveCartForUser(state.currentUserId, nextItems, state.customerId);
      }
      return { items: nextItems };
    }),

  setCustomer: (customerId) =>
    set((state) => {
      if (state.currentUserId) {
        saveCartForUser(state.currentUserId, state.items, customerId);
      }
      return { customerId };
    }),

  clear: () =>
    set((state) => {
      if (state.currentUserId) {
        saveCartForUser(state.currentUserId, [], null);
      }
      return { items: [], customerId: null };
    }),

  setCurrentUser: (userId) =>
    set((state) => {
      if (userId) {
        const { items, customerId } = loadCartForUser(userId);
        return { currentUserId: userId, items, customerId };
      }
      return { currentUserId: null, items: [], customerId: null };
    }),

  saveAndClearForUser: (userId) => {
    const state = get();
    saveCartForUser(userId, state.items, state.customerId);
    set({ currentUserId: null, items: [], customerId: null });
  },
}));
