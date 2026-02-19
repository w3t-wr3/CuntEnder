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

      onFunded();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleFund}
        disabled={loading || !publicKey}
        className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-2 px-6 rounded transition-colors"
      >
        {loading ? "Funding..." : "Fund $1 USDC"}
      </button>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
