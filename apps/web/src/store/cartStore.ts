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
          saveCartForUser(userId, syncChildItems(items), customerId);
          localStorage.removeItem(LEGACY_CART_KEY);
          return { items: syncChildItems(items), customerId };
        }
      }
      return { items: [], customerId: null };
    }
    const parsed = JSON.parse(raw);
    return {
      items: syncChildItems(parsed.items ?? []),
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

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createChildCartItem(parent: CartItem, subArticle: NonNullable<CartItem['subArticles']>[number]): CartItem {
  const child = subArticle.childProduct;
  const quantityPerParent = positiveNumber(subArticle.quantityPerParent, 1);
  const quantity = positiveNumber(parent.quantity, 1) * quantityPerParent;
  const unitPrice = positiveNumber(child?.verkoopprijs, 0);
  const vatRate = positiveNumber(child?.vatRate, 0);

  return {
    productId: `${parent.productId}::child::${subArticle.childSnelstartId}`,
    productName: child?.omschrijving || '',
    sku: child?.artikelcode || subArticle.childArtikelcode || subArticle.childSnelstartId,
    quantity,
    unitPrice,
    basePrice: unitPrice,
    totalPrice: unitPrice * quantity,
    vatPercentage: vatRate,
    vatType: child?.vatType ?? null,
    vatRate,
    vatGroupId: child?.vatGroupId,
    vatGroupName: child?.vatGroupName,
    isChildItem: true,
    lineType: 'recipe_child',
    parentProductId: parent.productId,
    childSnelstartId: subArticle.childSnelstartId,
    childArtikelcode: subArticle.childArtikelcode,
    quantityPerParent,
    childUri: subArticle.childUri,
    isMissingChild: !child,
    ...(child?.inkoopprijs !== undefined && child.inkoopprijs !== null && { inkoopprijs: child.inkoopprijs }),
    ...(child?.eenheid && { eenheid: child.eenheid }),
    ...(child?.coverImageUrl && { coverImageUrl: child.coverImageUrl }),
    ...(child?.voorraad !== undefined && child.voorraad !== null && { voorraad: child.voorraad }),
  };
}

function syncChildItems(items: CartItem[]) {
  const nextItems: CartItem[] = [];

  for (const item of items) {
    if (item.isChildItem) {
      continue;
    }

    nextItems.push(item);

    if (item.subArticles?.length) {
      nextItems.push(...item.subArticles.map((subArticle) => createChildCartItem(item, subArticle)));
    }
  }

  return nextItems;
}

function mergeParentCartItem(existing: CartItem, incoming: CartItem): CartItem {
  return {
    ...existing,
    productName: incoming.productName || existing.productName,
    sku: incoming.sku || existing.sku,
    categoryId: incoming.categoryId ?? existing.categoryId,
    quantity: existing.quantity + incoming.quantity,
    unitPrice: incoming.unitPrice ?? existing.unitPrice,
    basePrice: incoming.basePrice ?? existing.basePrice,
    totalPrice: (existing.customUnitPrice ?? incoming.customUnitPrice ?? incoming.unitPrice ?? existing.unitPrice) * (existing.quantity + incoming.quantity),
    vatPercentage: incoming.vatPercentage ?? existing.vatPercentage,
    vatType: incoming.vatType ?? existing.vatType,
    vatRate: incoming.vatRate ?? existing.vatRate,
    vatGroupId: incoming.vatGroupId ?? existing.vatGroupId,
    vatGroupName: incoming.vatGroupName ?? existing.vatGroupName,
    inkoopprijs: incoming.inkoopprijs ?? existing.inkoopprijs,
    eenheid: incoming.eenheid ?? existing.eenheid,
    coverImageUrl: incoming.coverImageUrl ?? existing.coverImageUrl,
    voorraad: incoming.voorraad ?? existing.voorraad,
    isParentArticle: incoming.isParentArticle ?? existing.isParentArticle,
    subArticles: incoming.subArticles ?? existing.subArticles,
  };
}

interface CartState {
  items: CartItem[];
  customerId: string | null;
  currentUserId: string | null;
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateUnitPrice: (
    productId: string,
    unitPrice: number,
    options?: {
      adminOverride?: boolean;
      adminPriceOverrideConfirmed?: boolean;
      adminOverrideReason?: string;
    },
  ) => void;
  resetToOriginalPrice: (productId: string) => void;
  removeItem: (productId: string) => void;
  removeItemsByCategory: (categoryId: string) => void;
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
      const nextItems = syncChildItems(existing
        ? state.items.map((i) =>
            i.productId === item.productId
              ? mergeParentCartItem(i, item)
              : i,
          )
        : [...state.items, item]);
      if (state.currentUserId) {
        saveCartForUser(state.currentUserId, nextItems, state.customerId);
      }
      return { items: nextItems };
    }),

  updateQuantity: (productId, quantity) =>
    set((state) => {
      const target = state.items.find((i) => i.productId === productId);
      if (target?.isChildItem) {
        return state;
      }
      const nextItems =
        quantity <= 0
          ? state.items.filter((i) => i.productId !== productId && i.parentProductId !== productId)
          : state.items.map((i) =>
              i.productId === productId
                ? { ...i, quantity, totalPrice: (i.customUnitPrice ?? i.unitPrice) * quantity }
                : i,
            );
      const syncedItems = syncChildItems(nextItems);
      if (state.currentUserId) {
        saveCartForUser(state.currentUserId, syncedItems, state.customerId);
      }
      return { items: syncedItems };
    }),

  updateUnitPrice: (productId, unitPrice, options) =>
    set((state) => {
      const target = state.items.find((i) => i.productId === productId);
      if (target?.isChildItem) {
        return state;
      }
      const nextItems = state.items.map((i) =>
        i.productId === productId
          ? {
              ...i,
              customUnitPrice: unitPrice,
              totalPrice: unitPrice * i.quantity,
              adminOverride: options?.adminOverride || undefined,
              adminPriceOverrideConfirmed:
                options?.adminPriceOverrideConfirmed ?? i.adminPriceOverrideConfirmed,
              adminOverrideReason: options?.adminOverrideReason,
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
      if (!item || item.isChildItem) return state;
      const nextItems = state.items.map((i) =>
        i.productId === productId
          ? {
              ...i,
              customUnitPrice: undefined,
              adminOverride: undefined,
              adminOverrideReason: i.adminPriceOverrideConfirmed
                ? i.adminOverrideReason
                : undefined,
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
      const target = state.items.find((i) => i.productId === productId);
      if (target?.isChildItem) {
        return state;
      }
      const nextItems = state.items.filter((i) => i.productId !== productId && i.parentProductId !== productId);
      if (state.currentUserId) {
        saveCartForUser(state.currentUserId, nextItems, state.customerId);
      }
      return { items: nextItems };
    }),

  removeItemsByCategory: (categoryId) =>
    set((state) => {
      const removedParentIds = new Set(
        state.items
          .filter((i) => !i.isChildItem && (i as CartItem & { categoryId?: string }).categoryId === categoryId)
          .map((i) => i.productId),
      );
      const nextItems = state.items.filter(
        (i) =>
          (i.isChildItem || (i as CartItem & { categoryId?: string }).categoryId !== categoryId) &&
          (!i.parentProductId || !removedParentIds.has(i.parentProductId)),
      );
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
