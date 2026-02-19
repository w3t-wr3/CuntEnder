"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useUser } from "@/hooks/useUser";
import { useState } from "react";
import Link from "next/link";

export default function ProfilePage() {
  const { publicKey } = useWallet();
  const { user, identity, setUsername } = useUser();
  const [usernameInput, setUsernameInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!usernameInput.trim()) return;
    setSaving(true);
    await setUsername(usernameInput.trim());
    setUsernameInput("");
    setSaving(false);
  }

  return (
    <main className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm">
          &larr; Back to lobby
        </Link>
        <WalletMultiButton />
      </div>

      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      {!publicKey && (
        <p className="text-gray-400">Connect your wallet to view profile</p>
      )}

      {publicKey && user && (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">Wallet</div>
            <div className="font-mono text-sm break-all">
              {publicKey.toBase58()}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">User ID</div>
            <div className="font-mono text-sm">{user.id}</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">
              Rocket League Username
            </div>
            {identity ? (
              <div className="text-sm font-medium">{identity.username}</div>
            ) : (
              <div className="text-gray-500 text-sm">Not set</div>
            )}
          </div>

          <div className="border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">
              {identity ? "Update" : "Set"} RL Username
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={identity?.username ?? "Your RL username"}
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm flex-1"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm px-4 py-1.5 rounded"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
