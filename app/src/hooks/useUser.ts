"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface User {
  id: string;
  wallet_address: string;
  display_name: string | null;
}

interface GameIdentity {
  id: string;
  username: string;
  platform: string;
}

export function useUser() {
  const { publicKey, connected } = useWallet();
  const [user, setUser] = useState<User | null>(null);
  const [identity, setIdentity] = useState<GameIdentity | null>(null);
  const [loading, setLoading] = useState(false);

  const connect = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: publicKey.toBase58() }),
      });
      const data = await res.json();
      if (data.user) setUser(data.user);
      if (data.identity) setIdentity(data.identity);
    } catch (e) {
      console.error("Connect error:", e);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      connect();
    } else {
      setUser(null);
      setIdentity(null);
    }
  }, [connected, publicKey, connect]);

  const setUsername = useCallback(
    async (username: string) => {
      if (!publicKey) return;
      const res = await fetch("/api/profile/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: publicKey.toBase58(),
          username,
        }),
      });
      const data = await res.json();
      if (data.identity) setIdentity(data.identity);
      return data;
    },
    [publicKey]
  );

  return { user, identity, loading, connected, publicKey, setUsername };
}
