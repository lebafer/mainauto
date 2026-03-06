import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { createContext, useContext } from "react";

export const TOKEN_KEY = "ba_token";
const AUTH_BASE_URL = import.meta.env.VITE_BACKEND_URL || "";

// Production defaults to relative URLs; in development VITE_BACKEND_URL can target backend directly.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BACKEND_URL || undefined,
  plugins: [usernameClient()],
  fetchOptions: {
    credentials: "include",
  },
});

// Session type
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  username: string;
  image: string | null;
}

export interface SessionData {
  session: { token: string; userId: string; expiresAt: string };
  user: SessionUser;
}

// Direct session fetch that bypasses Better Auth's useSession hook
export async function fetchSession(): Promise<SessionData | null> {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${AUTH_BASE_URL}/api/auth/get-session`, {
      method: "GET",
      credentials: "include",
      headers,
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.session || !data.user) return null;
    return data as SessionData;
  } catch {
    return null;
  }
}

// React context for session
export interface AuthContextType {
  session: SessionData | null;
  isPending: boolean;
  refetch: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  isPending: true,
  refetch: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export async function signOut() {
  localStorage.removeItem(TOKEN_KEY);
  try {
    await authClient.signOut();
  } catch {
    // ignore
  }
  window.location.replace("/login");
}
