"use client";

import { use } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useChallenge } from "@/hooks/useChallenge";
import { useUser } from "@/hooks/useUser";
import { FundButton } from "@/components/FundButton";
import { CountdownTimer } from "@/components/CountdownTimer";
import { ProofUpload } from "@/components/ProofUpload";
import { STATUS_BADGES } from "@/components/ChallengeCard";
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
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

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

  async function handleClaim() {
    if (!publicKey) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await fetch(`/api/challenges/${id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: publicKey.toBase58() }),
      });
      const data = await res.json();
      if (data.error) {
        setClaimError(data.error);
      } else {
        refresh();
      }
    } catch (e) {
      setClaimError(String(e));
    } finally {
      setClaiming(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-cn-text-muted">Loading challenge...</p>
      </main>
    );
  }

  if (!challenge) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-cn-error">Challenge not found</p>
        <Link href="/lobby" className="text-cn-accent text-sm mt-2 inline-block hover:underline">
          Back to lobby
        </Link>
      </main>
    );
  }

  const isMaker = user?.id === challenge.maker_id;
  const isTaker = user?.id === challenge.taker_id;
  const isParticipant = isMaker || isTaker;
  const badge = STATUS_BADGES[challenge.status];

  const hasWinner = !!challenge.verified_winner_id;
  const isWinner = hasWinner && user?.id === challenge.verified_winner_id;
  const isLoser = hasWinner && isParticipant && !isWinner;
  const potAmount = ((challenge.usdc_amount_minor * 2) / 1_000_000).toFixed(2);

  return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-8">
      <Link href="/lobby" className="text-cn-accent text-sm hover:underline inline-flex items-center gap-1 mb-4">
        <span>&larr;</span> Back to Lobby
      </Link>
      <div className="cn-card p-6 sm:p-8 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="cn-heading text-xl">Challenge</h2>
          <span className={badge?.className ?? "cn-badge"}>
            {badge?.label ?? challenge.status}
          </span>
        </div>

        <div className="text-sm text-cn-text-muted mb-1">
          ID: <span className="font-mono text-xs text-cn-text-secondary">{challenge.id}</span>
        </div>

        {/* Player panels */}
        <div className="grid grid-cols-2 gap-4 my-6">
          <div className={`cn-panel ${hasWinner && challenge.verified_winner_id === challenge.maker_id ? "border-cn-success/50" : ""}`}>
            <div className="cn-panel-label">Maker</div>
            <div className="text-sm font-mono truncate text-cn-text">
              {challenge.maker?.wallet_address?.slice(0, 8)}...
            </div>
            {challenge.maker?.display_name && (
              <div className="text-xs text-cn-text-secondary mt-0.5">
                {challenge.maker.display_name}
              </div>
            )}
            {hasWinner && challenge.verified_winner_id === challenge.maker_id && (
              <div className="text-xs text-cn-success font-semibold mt-1">WINNER</div>
            )}
          </div>
          <div className={`cn-panel ${hasWinner && challenge.verified_winner_id === challenge.taker_id ? "border-cn-success/50" : ""}`}>
            <div className="cn-panel-label">Taker</div>
            {challenge.taker ? (
              <>
                <div className="text-sm font-mono truncate text-cn-text">
                  {challenge.taker.wallet_address?.slice(0, 8)}...
                </div>
                {challenge.taker.display_name && (
                  <div className="text-xs text-cn-text-secondary mt-0.5">
                    {challenge.taker.display_name}
                  </div>
                )}
                {hasWinner && challenge.verified_winner_id === challenge.taker_id && (
                  <div className="text-xs text-cn-success font-semibold mt-1">WINNER</div>
                )}
              </>
            ) : (
              <div className="text-cn-text-muted text-sm">Waiting...</div>
            )}
          </div>
        </div>

        {/* USDC Amount */}
        <div className="text-center text-2xl mb-4">
          <span className="cn-amount">
            ${(challenge.usdc_amount_minor / 1_000_000).toFixed(2)} USDC
          </span>
        </div>

        <hr className="cn-divider" />

        {/* Timers */}
        {challenge.status === "ACCEPTED" && challenge.funding_expires_at && (
          <div className="mb-4">
            <CountdownTimer
              expiresAt={challenge.funding_expires_at}
              label="Funding deadline"
            />
          </div>
        )}
        {challenge.status === "FUNDED" && challenge.play_expires_at && (
          <div className="mb-4">
            <CountdownTimer
              expiresAt={challenge.play_expires_at}
              label="Play deadline"
            />
          </div>
        )}
        {challenge.status === "PROOF_PENDING" && challenge.proof_expires_at && !hasWinner && (
          <div className="mb-4">
            <CountdownTimer
              expiresAt={challenge.proof_expires_at}
              label="Proof deadline"
            />
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 space-y-3">
          {/* OPEN: taker can accept */}
          {challenge.status === "OPEN" && publicKey && !isMaker && (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="cn-btn-primary w-full py-3"
            >
              {accepting ? "Accepting..." : "Accept Challenge"}
            </button>
          )}

          {challenge.status === "OPEN" && isMaker && (
            <div className="text-center text-cn-text-muted text-sm">
              Waiting for an opponent to accept...
            </div>
          )}

          {/* ACCEPTED: participants can fund */}
          {challenge.status === "ACCEPTED" && isParticipant && (
            <FundButton challengeId={id} onFunded={refresh} />
          )}

          {/* FUNDED / PROOF_PENDING: upload proof (no winner yet) */}
          {(challenge.status === "FUNDED" || challenge.status === "PROOF_PENDING") && isParticipant && !hasWinner && (
            <ProofUpload challengeId={id} onUploaded={refresh} />
          )}

          {/* Winner determined but not yet claimed */}
          {hasWinner && challenge.status !== "RESOLVED" && isWinner && (
            <div>
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="cn-btn-primary w-full py-3 text-lg"
              >
                {claiming ? "Claiming..." : `Claim $${potAmount}!`}
              </button>
              {claimError && <p className="text-cn-error text-sm mt-2">{claimError}</p>}
            </div>
          )}

          {hasWinner && challenge.status !== "RESOLVED" && isLoser && (
            <div className="text-center text-cn-error font-medium">
              You lost this challenge.
            </div>
          )}

          {/* RESOLVED */}
          {challenge.status === "RESOLVED" && isWinner && (
            <div className="text-center text-cn-success font-medium">
              You won! ${potAmount} USDC has been sent to your wallet.
            </div>
          )}

          {challenge.status === "RESOLVED" && isLoser && (
            <div className="text-center text-cn-error font-medium">
              You lost this challenge.
            </div>
          )}

          {challenge.status === "RESOLVED" && !isParticipant && (
            <div className="text-center text-cn-text-muted font-medium">
              Challenge resolved.
            </div>
          )}

          {/* CANCELLED */}
          {challenge.status === "CANCELLED_OR_FORFEIT" && (
            <div className="text-center text-cn-error font-medium">
              Challenge cancelled or forfeited.
              {challenge.cancelled_reason && (
                <span className="block text-xs text-cn-text-muted mt-1">
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
