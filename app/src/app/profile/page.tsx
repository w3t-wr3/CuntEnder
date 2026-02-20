"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useUser } from "@/hooks/useUser";
import { useState, useEffect } from "react";
import Link from "next/link";

interface HistoryEntry {
  id: string;
  status: string;
  outcome: "win" | "loss" | "cancelled";
  amount: number;
  opponent: string;
  created_at: string;
  cancelled_reason: string | null;
}

export default function ProfilePage() {
  const { publicKey } = useWallet();
  const { user, identity, setUsername } = useUser();
  const [usernameInput, setUsernameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) return;
    setHistoryLoading(true);
    fetch(`/api/profile/history?wallet=${publicKey.toBase58()}`)
      .then((r) => r.json())
      .then((data) => setHistory(data.history ?? []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [publicKey]);

  async function handleSave() {
    if (!usernameInput.trim()) return;
    setSaving(true);
    await setUsername(usernameInput.trim());
    setUsernameInput("");
    setSaving(false);
  }

  return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-8">
      <h1 className="cn-heading text-2xl mb-6">Profile</h1>

      {!publicKey && (
        <p className="text-cn-text-muted">Connect your wallet to view profile</p>
      )}

      {publicKey && user && (
        <div className="space-y-4 animate-fade-in">
          <div className="cn-panel">
            <div className="cn-panel-label">Wallet</div>
            <div className="font-mono text-sm break-all text-cn-text">
              {publicKey.toBase58()}
            </div>
          </div>

          <div className="cn-panel">
            <div className="cn-panel-label">User ID</div>
            <div className="font-mono text-sm text-cn-text-secondary">{user.id}</div>
          </div>

          <div className="cn-panel">
            <div className="cn-panel-label">Rocket League Username</div>
            {identity ? (
              <div className="text-cn-accent font-semibold">{identity.username}</div>
            ) : (
              <div className="text-cn-text-muted text-sm">Not set</div>
            )}
          </div>

          <div className="cn-card p-4">
            <h3 className="text-sm font-medium mb-3 text-cn-text">
              {identity ? "Update" : "Set"} RL Username
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={identity?.username ?? "Your RL username"}
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="cn-input flex-1"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="cn-btn-primary"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* Challenge History */}
          <div className="mt-8">
            <h2 className="cn-heading text-lg mb-4">Challenge History</h2>
            {historyLoading && (
              <p className="text-cn-text-muted text-sm">Loading...</p>
            )}
            {!historyLoading && history.length === 0 && (
              <p className="text-cn-text-muted text-sm">No completed challenges yet.</p>
            )}
            <div className="space-y-2">
              {history.map((h) => (
                <Link
                  key={h.id}
                  href={`/challenge/${h.id}`}
                  className="cn-card p-3 flex items-center justify-between hover:border-cn-border-light transition-colors block"
                >
                  <div>
                    <div className="text-sm text-cn-text">
                      vs <span className="font-medium">{h.opponent}</span>
                    </div>
                    <div className="text-xs text-cn-text-muted mt-0.5">
                      {new Date(h.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    {h.outcome === "win" && (
                      <span className="text-cn-success font-semibold text-sm">
                        +${h.amount.toFixed(2)} USDC
                      </span>
                    )}
                    {h.outcome === "loss" && (
                      <span className="text-cn-error font-semibold text-sm">
                        -${h.amount.toFixed(2)} USDC
                      </span>
                    )}
                    {h.outcome === "cancelled" && (
                      <span className="text-cn-text-muted text-sm">
                        Cancelled
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
