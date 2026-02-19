"use client";

import { use } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useChallenge } from "@/hooks/useChallenge";
import { useUser } from "@/hooks/useUser";
import { FundButton } from "@/components/FundButton";
import { CountdownTimer } from "@/components/CountdownTimer";
import { ProofUpload } from "@/components/ProofUpload";
import Link from "next/link";
import { useState } from "react";

export default function ChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { publicKey } = useWallet();
  const { user } = useUser();
  const { challenge, loading, refresh } = useChallenge(id);
  const [accepting, setAccepting] = useState(false);

  async function handleAccept() {
    if (!publicKey) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/challenges/${id}/accept`, {
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
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <p className="text-gray-500">Loading challenge...</p>
      </main>
    );
  }

  if (!challenge) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <p className="text-red-400">Challenge not found</p>
        <Link href="/" className="text-blue-400 text-sm mt-2 inline-block">
          Back to lobby
        </Link>
      </main>
    );
  }

  const isMaker = user?.id === challenge.maker_id;
  const isTaker = user?.id === challenge.taker_id;
  const isParticipant = isMaker || isTaker;

  return (
    <main className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm">
          &larr; Back
        </Link>
        <WalletMultiButton />
      </div>

      <div className="border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Challenge</h2>
          <span className="text-xs px-2 py-1 rounded bg-gray-800">
            {challenge.status}
          </span>
        </div>

        <div className="text-sm text-gray-400 mb-1">
          ID: <span className="font-mono text-xs">{challenge.id}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 my-6">
          <div className="bg-gray-800 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Maker</div>
            <div className="text-sm font-mono truncate">
              {challenge.maker?.wallet_address?.slice(0, 8)}...
            </div>
            {challenge.maker?.display_name && (
              <div className="text-xs text-gray-400">
                {challenge.maker.display_name}
              </div>
            )}
          </div>
          <div className="bg-gray-800 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Taker</div>
            {challenge.taker ? (
              <>
                <div className="text-sm font-mono truncate">
                  {challenge.taker.wallet_address?.slice(0, 8)}...
                </div>
                {challenge.taker.display_name && (
                  <div className="text-xs text-gray-400">
                    {challenge.taker.display_name}
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-500 text-sm">Waiting...</div>
            )}
          </div>
        </div>

        <div className="text-center text-lg font-bold mb-4">
          ${(challenge.usdc_amount_minor / 1_000_000).toFixed(2)} USDC
        </div>

        {/* Timers */}
        {challenge.status === "ACCEPTED" && challenge.funding_expires_at && (
          <CountdownTimer
            expiresAt={challenge.funding_expires_at}
            label="Funding deadline"
          />
        )}
        {challenge.status === "FUNDED" && challenge.play_expires_at && (
          <CountdownTimer
            expiresAt={challenge.play_expires_at}
            label="Play deadline"
          />
        )}
        {challenge.status === "PROOF_PENDING" && challenge.proof_expires_at && (
          <CountdownTimer
            expiresAt={challenge.proof_expires_at}
            label="Proof deadline"
          />
        )}

        {/* Actions */}
        <div className="mt-6 space-y-3">
          {/* OPEN: taker can accept */}
          {challenge.status === "OPEN" && publicKey && !isMaker && (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-bold py-3 rounded transition-colors"
            >
              {accepting ? "Accepting..." : "Accept Challenge"}
            </button>
          )}

          {challenge.status === "OPEN" && isMaker && (
            <div className="text-center text-gray-500 text-sm">
              Waiting for an opponent to accept...
            </div>
          )}

          {/* ACCEPTED: participants can fund */}
          {challenge.status === "ACCEPTED" && isParticipant && (
            <FundButton challengeId={id} onFunded={refresh} />
          )}

          {/* FUNDED: play the game */}
          {challenge.status === "FUNDED" && isParticipant && (
            <div className="text-center text-green-400 font-medium">
              Both funded! Go play your Rocket League match.
            </div>
          )}

          {/* PROOF_PENDING: upload proof */}
          {challenge.status === "PROOF_PENDING" && isParticipant && (
            <ProofUpload challengeId={id} onUploaded={refresh} />
          )}

          {/* RESOLVED */}
          {challenge.status === "RESOLVED" && (
            <div className="text-center text-green-400 font-medium">
              Challenge resolved! Winner has been paid.
            </div>
          )}

          {/* CANCELLED */}
          {challenge.status === "CANCELLED_OR_FORFEIT" && (
            <div className="text-center text-red-400 font-medium">
              Challenge cancelled or forfeited.
              {challenge.cancelled_reason && (
                <span className="block text-xs text-gray-500 mt-1">
                  {challenge.cancelled_reason}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
