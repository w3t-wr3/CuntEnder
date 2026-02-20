"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";

export function FundButton({
  challengeId,
  onFunded,
}: {
  challengeId: string;
  onFunded: () => void;
}) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funded, setFunded] = useState(false);

  async function handleFund() {
    if (!publicKey) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Get unsigned transaction from server
      const res = await fetch(`/api/challenges/${challengeId}/fund_tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: publicKey.toBase58() }),
      });

      const { transaction: txBase64, error: txError } = await res.json();
      if (txError) throw new Error(txError);

      // 2. Deserialize and sign
      const tx = Transaction.from(Buffer.from(txBase64, "base64"));
      const signature = await sendTransaction(tx, connection);

      // 3. Confirm
      await connection.confirmTransaction(signature, "confirmed");

      // 4. Report back to server
      const confirmRes = await fetch(
        `/api/challenges/${challengeId}/fund_tx`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet_address: publicKey.toBase58(),
            tx_signature: signature,
          }),
        }
      );

      const confirmData = await confirmRes.json();
      if (confirmData.error) throw new Error(confirmData.error);

      setFunded(true);
      onFunded();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  if (funded) {
    return (
      <div className="cn-card border-cn-success/30 p-3">
        <p className="text-cn-success text-sm font-medium text-center">
          Funded successfully! Waiting for opponent to fund.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <button
        onClick={handleFund}
        disabled={loading || !publicKey}
        className="cn-btn-accent w-full py-3"
      >
        {loading ? "Funding..." : "Fund $1 USDC"}
      </button>
      {error && <p className="text-cn-error text-sm mt-2">{error}</p>}
    </div>
  );
}
