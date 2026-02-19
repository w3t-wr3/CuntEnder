"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useUser } from "@/hooks/useUser";
import { useChallengeList } from "@/hooks/useChallenge";
import { ChallengeCard } from "@/components/ChallengeCard";
import { useState } from "react";
import Link from "next/link";

export default function Home() {
  const { publicKey } = useWallet();
  const { user, identity, setUsername } = useUser();
  const { challenges, loading, refresh } = useChallengeList();
  const [creating, setCreating] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [showSetup, setShowSetup] = useState(false);

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
    <main className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">CNTNDR</h1>
        <WalletMultiButton />
      </div>

      {publicKey && !identity && (
        <div className="border border-yellow-700 bg-yellow-900/20 rounded-lg p-4 mb-6">
          <p className="text-yellow-300 text-sm mb-3">
            Set your Rocket League username to get started
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="RL Username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm flex-1"
            />
            <button
              onClick={handleSetUsername}
              className="bg-yellow-600 hover:bg-yellow-500 text-white text-sm px-4 py-1.5 rounded"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {publicKey && identity && (
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-gray-400">
            Playing as{" "}
            <span className="text-white font-medium">{identity.username}</span>
            {" "}
            <button
              onClick={() => setShowSetup(!showSetup)}
              className="text-gray-500 hover:text-gray-300 ml-1"
            >
              (edit)
            </button>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            {creating ? "Creating..." : "Create Challenge"}
          </button>
        </div>
      )}

      {showSetup && identity && (
        <div className="border border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New RL Username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm flex-1"
            />
            <button
              onClick={handleSetUsername}
              className="bg-yellow-600 hover:bg-yellow-500 text-white text-sm px-4 py-1.5 rounded"
            >
              Update
            </button>
          </div>
        </div>
      )}

      {!publicKey && (
        <div className="text-center text-gray-400 py-12">
          Connect your Phantom wallet to get started
        </div>
      )}

      <div className="space-y-3">
        {loading && (
          <div className="text-gray-500 text-center py-8">Loading...</div>
        )}
        {!loading && challenges.length === 0 && publicKey && (
          <div className="text-gray-500 text-center py-8">
            No active challenges. Create one!
          </div>
        )}
        {challenges.map((c) => (
          <ChallengeCard key={c.id} challenge={c} />
        ))}
      </div>

      {publicKey && (
        <div className="mt-8 text-center">
          <Link
            href="/profile"
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            Profile
          </Link>
        </div>
      )}
    </main>
  );
}
