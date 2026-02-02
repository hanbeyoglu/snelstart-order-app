import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem } from '@snelstart-order-app/shared';

interface CartState {
  items: CartItem[];
  customerId: string | null;
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateUnitPrice: (productId: string, unitPrice: number) => void;
  resetToOriginalPrice: (productId: string) => void;
  removeItem: (productId: string) => void;
  setCustomer: (customerId: string | null) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      customerId: null,
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i,
              ),
            };
          }
          return { items: [...state.items, item] };
        }),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.productId !== productId)
              : state.items.map((i) =>
                  i.productId === productId ? { ...i, quantity } : i,
                ),
        })),
      updateUnitPrice: (productId, unitPrice) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId
              ? {
                  ...i,
                  customUnitPrice: unitPrice,
                  totalPrice: unitPrice * i.quantity,
                }
              : i,
          ),
        })),
      resetToOriginalPrice: (productId) =>
        set((state) => {
          const item = state.items.find((i) => i.productId === productId);
          if (!item) return state;
          return {
            items: state.items.map((i) =>
              i.productId === productId
                ? {
                    ...i,
                    customUnitPrice: undefined,
                    totalPrice: i.unitPrice * i.quantity,
                  }
                : i,
            ),
          };
        }),
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),
      setCustomer: (customerId) => set({ customerId }),
      clear: () => set({ items: [], customerId: null }),
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

