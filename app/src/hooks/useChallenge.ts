"use client";

import { useEffect, useState, useCallback } from "react";

interface Challenge {
  id: string;
  maker_id: string;
  taker_id: string | null;
  status: string;
  usdc_amount_minor: number;
  funding_expires_at: string | null;
  play_expires_at: string | null;
  proof_expires_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  maker?: { id: string; wallet_address: string; display_name: string | null };
  taker?: { id: string; wallet_address: string; display_name: string | null } | null;
}

export function useChallenge(challengeId: string) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/challenges?id=${challengeId}`);
      const data = await res.json();
      if (data.challenges?.[0]) {
        setChallenge(data.challenges[0]);
      }
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { challenge, loading, error, refresh };
}

export function useChallengeList() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/challenges");
      const data = await res.json();
      if (data.challenges) setChallenges(data.challenges);
    } catch (e) {
      console.error("Failed to fetch challenges:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { challenges, loading, refresh };
}
