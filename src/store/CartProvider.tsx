"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { EMPTY_TOTALS, itemCount, optimisticTotals } from "@/lib/cart";
import { api, errorMessage } from "@/lib/api/client";
import type { CartItem, Coupon, CouponState, OrderTotals, ShippingMethod, ShippingMethodId } from "@/types";

const STORAGE_KEY = "loran:cart";

/**
 * Cart state.
 *
 * localStorage holds the cart across reloads, but only as a *snapshot*: which
 * variants, and how many. It is never trusted for price, stock or totals.
 *
 * `POST /api/v1/cart/validate` is the authority. It is called on hydration and
 * whenever the cart changes, and its response replaces the local prices, the
 * quantity caps and every total. Anything that changed in the meantime comes
 * back as an `issue` the UI shows the customer — so a price move or a sold-out
 * size is surfaced, never silently applied.
 */

/** What the server reports about a line that changed under the customer. */
export interface CartIssue {
  variantId: string;
  code: "unavailable" | "out_of_stock" | "reduced_quantity" | "price_changed";
  message: string;
}

interface ValidateResponse {
  items: (CartItem & { lineTotal: number })[];
  removed: { variantId: string; name: string; reason: string }[];
  issues: CartIssue[];
  totals: OrderTotals;
  coupon: { code: string; discount: number; description: string } | null;
  couponError: string | null;
  shipping: {
    selected: string;
    cost: number;
    paidOnDelivery: boolean;
    freeShippingApplied: boolean;
    methods: ShippingMethod[];
  };
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  totals: OrderTotals;
  /** The applied coupon, as the server validated it. Null when none applies. */
  coupon: Coupon | null;
  couponState: CouponState;
  shippingMethodId: ShippingMethodId;
  shippingMethods: ShippingMethod[];
  /** True until the persisted cart has been read — avoids flashing "empty". */
  hydrating: boolean;
  /** True while the server is repricing. */
  validating: boolean;
  /** Anything the customer should be told about before paying. */
  issues: CartIssue[];
  dismissIssues: () => void;
  miniCartOpen: boolean;
  setMiniCartOpen: (open: boolean) => void;
  addItem: (item: CartItem) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => CartItem | undefined;
  restoreItem: (item: CartItem) => void;
  clear: () => void;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => void;
  setShippingMethodId: (id: ShippingMethodId) => void;
  /** Forces a fresh repricing — called before opening checkout. */
  revalidate: () => Promise<ValidateResponse | null>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponState, setCouponState] = useState<CouponState>({ status: "idle" });
  const [shippingMethodId, setShippingMethodIdState] = useState<ShippingMethodId>("tipax");
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [serverTotals, setServerTotals] = useState<OrderTotals | null>(null);
  const [issues, setIssues] = useState<CartIssue[]>([]);
  const [hydrating, setHydrating] = useState(true);
  const [validating, setValidating] = useState(false);
  const [miniCartOpen, setMiniCartOpen] = useState(false);

  /** Guards against an older in-flight validation overwriting a newer one. */
  const requestSeq = useRef(0);

  /* ------------------------------------------------------------ hydrate -- */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          items?: CartItem[];
          couponCode?: string;
          shippingMethodId?: ShippingMethodId;
        };
        if (Array.isArray(parsed.items)) setItems(parsed.items);
        if (parsed.couponCode) setCouponCode(parsed.couponCode);
        if (parsed.shippingMethodId) setShippingMethodIdState(parsed.shippingMethodId);
      }
    } catch {
      // A corrupted cart should never block the shop — start clean instead.
    }
    setHydrating(false);
  }, []);

  useEffect(() => {
    if (hydrating) return;
    try {
      // Only identifiers and quantities need to survive; prices are re-fetched.
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ items, couponCode, shippingMethodId })
      );
    } catch {
      // Storage can be full or blocked (private mode); the cart still works.
    }
  }, [items, couponCode, shippingMethodId, hydrating]);

  /* --------------------------------------------------------- validation -- */

  const runValidation = useCallback(
    async (
      lines: CartItem[],
      code: string | null,
      shipping: ShippingMethodId
    ): Promise<ValidateResponse | null> => {
      if (!lines.length) {
        setServerTotals(null);
        setIssues([]);
        if (code) setCouponState({ status: "idle" });
        return null;
      }

      const seq = ++requestSeq.current;
      setValidating(true);
      try {
        const data = await api.post<ValidateResponse>("/api/v1/cart/validate", {
          items: lines.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            displayedPrice: i.price,
          })),
          couponCode: code ?? undefined,
          shippingMethodCode: shipping,
        });

        // A newer request has already landed; discard this stale answer.
        if (seq !== requestSeq.current) return data;

        // The server's view of the cart replaces ours wholesale: its prices,
        // its quantity caps, its idea of what still exists.
        setItems(data.items.map(stripServerOnly));
        setServerTotals(data.totals);
        setIssues(data.issues);
        setShippingMethods(data.shipping.methods);

        if (data.coupon) {
          setCouponState({
            status: "applied",
            coupon: {
              code: data.coupon.code,
              type: "fixed",
              value: data.coupon.discount,
              description: data.coupon.description,
            },
            discount: data.coupon.discount,
          });
        } else if (data.couponError) {
          setCouponCode(null);
          setCouponState({ status: "invalid", message: data.couponError });
        } else {
          setCouponState({ status: "idle" });
        }

        return data;
      } catch (error) {
        if (seq === requestSeq.current) {
          // Keep showing the optimistic totals rather than blanking the cart —
          // the checkout revalidates anyway and will refuse if anything is off.
          setIssues([
            {
              variantId: "_",
              code: "price_changed",
              message: errorMessage(error),
            },
          ]);
        }
        return null;
      } finally {
        if (seq === requestSeq.current) setValidating(false);
      }
    },
    []
  );

  // Reprice whenever the cart, the coupon or the shipping choice changes.
  useEffect(() => {
    if (hydrating) return;
    const id = setTimeout(() => {
      void runValidation(items, couponCode, shippingMethodId);
    }, 150);
    return () => clearTimeout(id);
    // `items` is compared by the quantity/variant signature below so a
    // server response echoing the same cart doesn't loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature(items), couponCode, shippingMethodId, hydrating]);

  const revalidate = useCallback(
    () => runValidation(items, couponCode, shippingMethodId),
    [items, couponCode, shippingMethodId, runValidation]
  );

  /* ------------------------------------------------------------ actions -- */

  const addItem = useCallback((item: CartItem) => {
    setItems((list) => {
      const existing = list.find((i) => i.variantId === item.variantId);
      if (!existing) return [...list, item];
      // Adding an already-present variant tops it up, capped at its stock.
      return list.map((i) =>
        i.variantId === item.variantId
          ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.maxQuantity) }
          : i
      );
    });
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    setItems((list) =>
      list.map((i) =>
        i.variantId === variantId
          ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxQuantity)) }
          : i
      )
    );
  }, []);

  const removeItem = useCallback((variantId: string) => {
    let removed: CartItem | undefined;
    setItems((list) => {
      removed = list.find((i) => i.variantId === variantId);
      return list.filter((i) => i.variantId !== variantId);
    });
    return removed;
  }, []);

  const restoreItem = useCallback((item: CartItem) => {
    setItems((list) => (list.some((i) => i.variantId === item.variantId) ? list : [...list, item]));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setCouponCode(null);
    setCouponState({ status: "idle" });
    setServerTotals(null);
    setIssues([]);
  }, []);

  const applyCoupon = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      setCouponState({ status: "loading" });
      setCouponCode(trimmed);
      // The validation effect picks the new code up and the server decides
      // whether it is valid and what it is worth — never this component.
      await runValidation(items, trimmed, shippingMethodId);
    },
    [items, shippingMethodId, runValidation]
  );

  const removeCoupon = useCallback(() => {
    setCouponCode(null);
    setCouponState({ status: "idle" });
  }, []);

  const setShippingMethodId = useCallback((id: ShippingMethodId) => {
    setShippingMethodIdState(id);
  }, []);

  const dismissIssues = useCallback(() => setIssues([]), []);

  /* ------------------------------------------------------------- totals -- */

  const totals = useMemo(() => {
    if (!items.length) return EMPTY_TOTALS;
    // The server's figures win whenever we have them; the optimistic ones only
    // cover the gap while a request is in flight.
    if (serverTotals) return serverTotals;
    const method = shippingMethods.find((m) => m.id === shippingMethodId);
    return optimisticTotals(items, {
      couponDiscount: couponState.status === "applied" ? couponState.discount : 0,
      shipping: method,
    });
  }, [items, serverTotals, shippingMethods, shippingMethodId, couponState]);

  const coupon = couponState.status === "applied" ? couponState.coupon : null;

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: itemCount(items),
    totals,
    coupon,
    couponState,
    shippingMethodId,
    shippingMethods,
    hydrating,
    validating,
    issues,
    dismissIssues,
    miniCartOpen,
    setMiniCartOpen,
    addItem,
    updateQuantity,
    removeItem,
    restoreItem,
    clear,
    applyCoupon,
    removeCoupon,
    setShippingMethodId,
    revalidate,
  }), [items, totals, coupon, couponState, shippingMethodId, shippingMethods, hydrating, validating,
       issues, dismissIssues, miniCartOpen, addItem, updateQuantity, removeItem, restoreItem,
       clear, applyCoupon, removeCoupon, setShippingMethodId, revalidate]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Drops fields the server adds that the client shape doesn't carry. */
function stripServerOnly({ lineTotal, ...rest }: CartItem & { lineTotal?: number }): CartItem {
  void lineTotal;
  return rest;
}

/** A stable key for "the cart changed in a way the server needs to see". */
function cartSignature(items: CartItem[]): string {
  return items.map((i) => `${i.variantId}:${i.quantity}`).sort().join("|");
}
