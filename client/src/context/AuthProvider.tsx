import { useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "./auth-context";
import { getMe, login, register, tokenStore, type User } from "../lib/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => tokenStore.get() !== null);

  // ገጹ ሲከፈት የተቀመጠ token ካለ ተጠቃሚውን ይመልሳል
  useEffect(() => {
    if (!tokenStore.get()) return;
    getMe()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  async function signIn(email: string, password: string) {
    const res = await login(email, password);
    tokenStore.set(res.token);
    setUser(res.user);
  }

  async function signUp(input: { name: string; email: string; phone?: string; password: string }) {
    const res = await register(input);
    tokenStore.set(res.token);
    setUser(res.user);
  }

  function signOut() {
    tokenStore.clear();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>{children}</AuthContext.Provider>;
}