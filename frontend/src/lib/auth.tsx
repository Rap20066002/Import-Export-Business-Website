"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Role =
  | "SUPER_ADMIN"
  | "SALES_MANAGER"
  | "LOGISTICS_MANAGER"
  | "BUYER";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  company?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerBuyer: (payload: {
    name: string;
    email: string;
    password: string;
    company?: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("qp_token")
        : null;

    if (stored) {
      setToken(stored);
      apiFetch<AuthUser>("/auth/me", { token: stored })
        .then((me) => setUser(me))
        .catch(() => {
          setToken(null);
          window.localStorage.removeItem("qp_token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(res.token);
    setUser(res.user);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("qp_token", res.token);
    }
  };

  const registerBuyer = async (payload: {
    name: string;
    email: string;
    password: string;
    company?: string;
  }) => {
    const res = await apiFetch<{ token: string; user: AuthUser }>("/auth/register-buyer", {
      method: "POST",
      body: payload,
    });
    setToken(res.token);
    setUser(res.user);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("qp_token", res.token);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("qp_token");
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, registerBuyer, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

