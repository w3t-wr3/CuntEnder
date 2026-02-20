"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useUser } from "@/hooks/useUser";
import { useChallengeList } from "@/hooks/useChallenge";
import { ChallengeCard } from "@/components/ChallengeCard";
import { useState, useEffect } from "react";

export default function Home() {
  const { publicKey } = useWallet();
  const { user, identity, setUsername } = useUser();
  const { challenges, loading, refresh } = useChallengeList();
  const [creating, setCreating] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  // Trigger sweep on mount to expire stale challenges
  useEffect(() => {
    fetch("/api/sweep", { method: "POST" }).catch(() => {});
  }, []);

  async function handleCreate() {
    if (!publicKey) return;
    setCreating(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: publicKey.toBase58() }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        refresh();
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleSetUsername() {
    if (!usernameInput.trim()) return;
    await setUsername(usernameInput.trim());
    setShowSetup(false);
  }

  return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-8">

      {/* Username setup (no identity yet) */}
      {publicKey && !identity && (
        <div className="cn-card p-4 mb-6 border-cn-warning/30 animate-fade-in">
          <p className="text-cn-warning text-sm mb-3">
            Set your Rocket League username to get started
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="RL Username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="cn-input flex-1"
            />
            <button onClick={handleSetUsername} className="cn-btn-warning">
              Save
            </button>
          </div>
        </div>
      )}

      {/* Logged in with identity */}
      {publicKey && identity && (
        <div className="flex items-center justify-between mb-6 animate-fade-in">
          <div className="text-sm text-cn-text-muted">
            Playing as{" "}
            <span className="text-cn-text font-semibold">{identity.username}</span>
            {" "}
            <button
              onClick={() => setShowSetup(!showSetup)}
              className="text-cn-text-muted hover:text-cn-text ml-1 transition-colors"
            >
              (edit)
            </button>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="cn-btn-primary"
          >
            {creating ? "Creating..." : "Create Challenge"}
          </button>
        </div>
      )}

      {/* Edit username inline */}
      {showSetup && identity && (
        <div className="cn-card p-4 mb-6 animate-fade-in">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New RL Username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="cn-input flex-1"
            />
            <button onClick={handleSetUsername} className="cn-btn-warning">
              Update
            </button>
          </div>
        </div>
      )}

      {/* Not connected */}
      {!publicKey && (
        <div className="text-center text-cn-text-muted py-12">
          Connect your Phantom wallet to get started
        </div>
      )}

      {/* Challenge list */}
      <div className="space-y-3">
        {loading && (
          <div className="text-cn-text-muted text-center py-8">Loading...</div>
        )}
        {!loading && challenges.length === 0 && publicKey && (
          <div className="text-cn-text-muted text-center py-8">
            No active challenges. Create one!
          </div>
        )}
        {challenges.map((c) => (
          <div key={c.id} className="animate-fade-in">
            <ChallengeCard challenge={c} userId={user?.id} />
          </div>
        ))}
      </div>
    </main>

  );
}
