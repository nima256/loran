"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiClientError, errorMessage } from "@/lib/api/client";
import { normalizeIranMobile } from "@/lib/persian";
import type { Address, User } from "@/types";

/**
 * Customer authentication, backed by the real API.
 *
 * The session itself lives in an HttpOnly cookie the browser cannot read, so
 * this provider holds only the *profile*, and treats `GET /auth/me` as the
 * single source of truth for whether anyone is signed in. Nothing about the
 * session is persisted to localStorage — a stale flag there could otherwise
 * claim a signed-in user after the server session had expired.
 *
 * The context surface is unchanged from the pre-backend version, so every
 * screen that consumed it keeps working.
 */

interface OtpRequestResult {
  resendAfterSeconds: number;
  expiresInSeconds: number;
  /** Returned only when the server runs in explicit mock-OTP mode. */
  devCode?: string;
}

interface VerifyResult {
  ok: boolean;
  isNewUser: boolean;
  message?: string;
}

interface AuthContextValue {
  user: User | null;
  addresses: Address[];
  isAuthenticated: boolean;
  hydrating: boolean;
  /** Phone currently going through verification. */
  pendingPhone: string | null;
  /**
   * The code for the challenge in flight, set only when the server runs in
   * explicit mock-OTP mode. `env` refuses to boot production with that mode on,
   * so this is always null in a real deployment.
   */
  pendingDevCode: string | null;
  /** Server-dictated resend cooldown for the challenge in flight, in seconds. */
  pendingResendAfter: number;
  requestOtp: (phone: string) => Promise<OtpRequestResult>;
  verifyOtp: (code: string) => Promise<VerifyResult>;
  completeProfile: (data: { firstName: string; lastName: string; email?: string }) => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  addAddress: (address: Omit<Address, "id">) => Promise<Address>;
  updateAddress: (id: string, data: Partial<Address>) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

interface SessionPayload {
  user: User | null;
  addresses: Address[];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [pendingDevCode, setPendingDevCode] = useState<string | null>(null);
  const [pendingResendAfter, setPendingResendAfter] = useState(60);
  const [hydrating, setHydrating] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<SessionPayload>("/api/v1/auth/me");
      setUser(data.user);
      setAddresses(data.addresses);
    } catch {
      // A failed bootstrap means "not signed in" as far as the UI is concerned.
      setUser(null);
      setAddresses([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setHydrating(false);
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const requestOtp = useCallback(async (phone: string): Promise<OtpRequestResult> => {
    const normalized = normalizeIranMobile(phone);
    const data = await api.post<{
      phone: string;
      expiresInSeconds: number;
      resendAfterSeconds: number;
      devCode?: string;
    }>("/api/v1/auth/request-otp", { phone: normalized || phone });
    setPendingPhone(data.phone);
    setPendingDevCode(data.devCode ?? null);
    setPendingResendAfter(data.resendAfterSeconds);
    return {
      expiresInSeconds: data.expiresInSeconds,
      resendAfterSeconds: data.resendAfterSeconds,
      devCode: data.devCode,
    };
  }, []);

  const verifyOtp = useCallback(async (code: string): Promise<VerifyResult> => {
    if (!pendingPhone) {
      return { ok: false, isNewUser: false, message: "ابتدا شماره موبایل خود را وارد کنید." };
    }
    try {
      const data = await api.post<{ user: User; addresses: Address[]; needsProfile: boolean }>(
        "/api/v1/auth/verify-otp",
        { phone: pendingPhone, code }
      );
      setUser(data.user);
      setAddresses(data.addresses);
      // The challenge is spent; drop anything still referring to it.
      setPendingDevCode(null);
      return { ok: true, isNewUser: data.needsProfile };
    } catch (error) {
      return { ok: false, isNewUser: false, message: errorMessage(error) };
    }
  }, [pendingPhone]);

  const completeProfile = useCallback(
    async (data: { firstName: string; lastName: string; email?: string }) => {
      const updated = await api.patch<{ user: User }>("/api/v1/account/profile", data);
      setUser(updated.user);
    },
    []
  );

  const updateUser = useCallback(async (data: Partial<User>) => {
    const updated = await api.patch<{ user: User }>("/api/v1/account/profile", data);
    setUser(updated.user);
  }, []);

  const addAddress = useCallback(async (address: Omit<Address, "id">) => {
    const result = await api.post<{ address: Address; addresses: Address[] }>(
      "/api/v1/account/addresses",
      address
    );
    setAddresses(result.addresses);
    return result.address;
  }, []);

  const updateAddress = useCallback(async (id: string, data: Partial<Address>) => {
    const result = await api.patch<{ addresses: Address[] }>(
      `/api/v1/account/addresses/${id}`,
      data
    );
    setAddresses(result.addresses);
  }, []);

  const removeAddress = useCallback(async (id: string) => {
    const result = await api.delete<{ addresses: Address[] }>(`/api/v1/account/addresses/${id}`);
    setAddresses(result.addresses);
  }, []);

  const setDefaultAddress = useCallback(async (id: string) => {
    const result = await api.post<{ addresses: Address[] }>(
      `/api/v1/account/addresses/${id}/default`
    );
    setAddresses(result.addresses);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/v1/auth/logout");
    } catch (error) {
      // The cookie may already be gone; clearing local state is still correct.
      if (!(error instanceof ApiClientError)) throw error;
    }
    setUser(null);
    setAddresses([]);
    setPendingPhone(null);
    setPendingDevCode(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user, addresses, isAuthenticated: !!user, hydrating,
    pendingPhone, pendingDevCode, pendingResendAfter,
    requestOtp, verifyOtp, completeProfile, updateUser,
    addAddress, updateAddress, removeAddress, setDefaultAddress, refresh, logout,
  }), [user, addresses, hydrating, pendingPhone, pendingDevCode, pendingResendAfter,
       requestOtp, verifyOtp, completeProfile,
       updateUser, addAddress, updateAddress, removeAddress, setDefaultAddress, refresh, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
