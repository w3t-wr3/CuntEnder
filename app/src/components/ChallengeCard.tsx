"use client";

import Link from "next/link";

interface ChallengeCardProps {
  challenge: {
    id: string;
    status: string;
    usdc_amount_minor: number;
    created_at: string;
    maker?: { display_name: string | null; wallet_address: string };
    taker?: { display_name: string | null; wallet_address: string } | null;
  };
}

function shortWallet(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-green-900 text-green-300",
  ACCEPTED: "bg-yellow-900 text-yellow-300",
  FUNDED: "bg-blue-900 text-blue-300",
  PROOF_PENDING: "bg-purple-900 text-purple-300",
  RESOLVED: "bg-gray-700 text-gray-300",
  CANCELLED_OR_FORFEIT: "bg-red-900 text-red-300",
};

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const maker = challenge.maker;
  const makerLabel = maker?.display_name ?? shortWallet(maker?.wallet_address ?? "");

  return (
    <Link href={`/challenge/${challenge.id}`}>
      <div className="border border-gray-700 rounded-lg p-4 hover:border-gray-500 transition-colors cursor-pointer">
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[challenge.status] ?? "bg-gray-800"}`}
          >
            {challenge.status}
          </span>
          <span className="text-sm text-gray-400">
            ${(challenge.usdc_amount_minor / 1_000_000).toFixed(2)} USDC
          </span>
        </div>
        <div className="text-sm">
          <span className="text-gray-300">{makerLabel}</span>
          {challenge.taker && (
            <>
              <span className="text-gray-500 mx-2">vs</span>
              <span className="text-gray-300">
                {challenge.taker.display_name ??
                  shortWallet(challenge.taker.wallet_address)}
              </span>
            </>
          )}
          {!challenge.taker && (
            <span className="text-gray-500 ml-2">— waiting for opponent</span>
          )}
        </div>
      </div>
    </Link>
  );
}
