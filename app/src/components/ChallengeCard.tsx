"use client";

import Link from "next/link";

interface ChallengeCardProps {
  challenge: {
    id: string;
    status: string;
    usdc_amount_minor: number;
    created_at: string;
    funding_expires_at?: string | null;
    play_expires_at?: string | null;
    proof_expires_at?: string | null;
    maker?: { id: string; display_name: string | null; wallet_address: string };
    taker?: { id: string; display_name: string | null; wallet_address: string } | null;
    verified_winner_id?: string | null;
  };
  userId?: string | null;
}

function shortWallet(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "cn-badge cn-badge-open" },
  ACCEPTED: { label: "Accepted", className: "cn-badge cn-badge-accepted" },
  FUNDED: { label: "Funded", className: "cn-badge cn-badge-funded" },
  PROOF_PENDING: { label: "Proof", className: "cn-badge cn-badge-proof" },
  RESOLVED: { label: "Resolved", className: "cn-badge cn-badge-resolved" },
  CANCELLED_OR_FORFEIT: { label: "Cancelled", className: "cn-badge cn-badge-cancelled" },
};

function isExpired(challenge: ChallengeCardProps["challenge"]): boolean {
  const now = Date.now();
  if (challenge.status === "ACCEPTED" && challenge.funding_expires_at) {
    return new Date(challenge.funding_expires_at).getTime() < now;
  }
  if (challenge.status === "FUNDED" && challenge.play_expires_at) {
    return new Date(challenge.play_expires_at).getTime() < now;
  }
  if (challenge.status === "PROOF_PENDING" && challenge.proof_expires_at) {
    return new Date(challenge.proof_expires_at).getTime() < now;
  }
  return false;
}

export function ChallengeCard({ challenge, userId }: ChallengeCardProps) {
  const maker = challenge.maker;
  const makerLabel = maker?.display_name ?? shortWallet(maker?.wallet_address ?? "");
  const expired = isExpired(challenge);
  const badge = expired
    ? { label: "Expired", className: "cn-badge cn-badge-cancelled" }
    : STATUS_BADGES[challenge.status];

  const stake = challenge.usdc_amount_minor / 1_000_000;
  const pot = stake * 2;
  const isResolved = challenge.status === "RESOLVED" && challenge.verified_winner_id;
  const isParticipant = userId && (userId === challenge.maker?.id || userId === challenge.taker?.id);
  const isWinner = isResolved && userId === challenge.verified_winner_id;
  const isLoser = isResolved && isParticipant && !isWinner;

  return (
    <Link href={`/challenge/${challenge.id}`}>
      <div className="cn-card cn-card-glow p-4 cursor-pointer">
        <div className="flex items-center justify-between mb-2">
          <span className={badge?.className ?? "cn-badge"}>
            {badge?.label ?? challenge.status}
          </span>
          {isWinner ? (
            <span className="font-mono text-sm font-semibold text-cn-success">
              +${(pot * 0.95 - stake).toFixed(2)} USDC
            </span>
          ) : isLoser ? (
            <span className="font-mono text-sm font-semibold text-cn-error">
              -${stake.toFixed(2)} USDC
            </span>
          ) : (
            <span className="font-mono text-sm text-cn-text-secondary">
              ${stake.toFixed(2)} USDC
            </span>
          )}
        </div>
        <div className="text-sm">
          <span className="text-cn-text">{makerLabel}</span>
          {challenge.taker && (
            <>
              <span className="cn-vs">VS</span>
              <span className="text-cn-text">
                {challenge.taker.display_name ??
                  shortWallet(challenge.taker.wallet_address)}
              </span>
            </>
          )}
          {!challenge.taker && (
            <span className="text-cn-text-muted ml-2">— waiting for opponent</span>
          )}
        </div>
      </div>
    </Link>
  );
}
