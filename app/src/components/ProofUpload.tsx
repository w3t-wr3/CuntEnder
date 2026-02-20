"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface ProofResult {
  winner_name: string;
  winner_id: string | null;
  confidence: number;
  both_uploaded?: boolean;
  agreed?: boolean;
  waiting?: boolean;
  dispute?: string;
}

export function ProofUpload({
  challengeId,
  onUploaded,
}: {
  challengeId: string;
  onUploaded: () => void;
}) {
  const { publicKey } = useWallet();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProofResult | null>(null);
  const [alreadyUploaded, setAlreadyUploaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Check if this user already uploaded a proof
  useEffect(() => {
    if (!publicKey) return;
    fetch(`/api/challenges/${challengeId}/proof/status?wallet=${publicKey.toBase58()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.uploaded) setAlreadyUploaded(true);
      })
      .catch(() => {});
  }, [challengeId, publicKey]);

  const processAndUpload = useCallback(
    async (file: File) => {
      if (!publicKey) return;
      setUploading(true);
      setError(null);
      setResult(null);

      try {
        // Read file as base64
        const arrayBuffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);

        // Draw to canvas for resize + watermark
        const img = new Image();
        const blob = new Blob([uint8], { type: file.type });
        const url = URL.createObjectURL(blob);

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = url;
        });

        const canvas = canvasRef.current!;
        const maxWidth = 1024;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Watermark
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.font = "14px monospace";
        const timestamp = new Date().toISOString();
        ctx.fillText(`CNTNDR ${challengeId.slice(0, 8)} ${timestamp}`, 10, canvas.height - 10);

        URL.revokeObjectURL(url);

        // Convert canvas to base64
        const dataUrl = canvas.toDataURL("image/png");
        const base64 = dataUrl.split(",")[1];

        // Upload to proof endpoint
        const res = await fetch(`/api/challenges/${challengeId}/proof`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet_address: publicKey.toBase58(),
            image_base64: base64,
            media_type: "image/png",
          }),
        });

        const data = await res.json();

        if (data.error) {
          setError(data.error);
        } else if (data.result) {
          setResult(data.result);
          setAlreadyUploaded(true);
          onUploaded();
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setUploading(false);
      }
    },
    [challengeId, publicKey, onUploaded]
  );

  const showWaiting = alreadyUploaded && !result;

  return (
    <div>
      {!result && !showWaiting && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processAndUpload(file);
            }}
            className="hidden"
          />

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !publicKey}
            className="cn-btn-primary w-full py-3"
          >
            {uploading ? "Analyzing..." : "Upload Scoreboard"}
          </button>
        </>
      )}

      {showWaiting && (
        <div className="cn-card border-cn-accent/30 p-3">
          <p className="text-cn-accent text-sm text-center">
            Screenshot uploaded. Waiting for opponent...
          </p>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {error && <p className="text-cn-error text-sm mt-2">{error}</p>}

      {result && (
        <div className={`mt-3 p-3 cn-card ${
          result.both_uploaded && result.agreed
            ? "border-cn-success/30"
            : result.dispute
              ? "border-cn-error/30"
              : "border-cn-accent/30"
        }`}>
          {result.waiting && (
            <p className="text-cn-accent text-sm text-center">
              Screenshot uploaded. Waiting for opponent...
            </p>
          )}
          {result.both_uploaded && result.agreed && (
            <p className="text-cn-success text-sm text-center">
              Both screenshots verified. Winner: <strong>{result.winner_name}</strong>
            </p>
          )}
          {result.dispute && (
            <p className="text-cn-error text-sm text-center">
              {result.dispute}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
