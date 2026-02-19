"use client";

import { useState, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

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
  const [result, setResult] = useState<{
    winner_name: string;
    confidence: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  return (
    <div>
      <h3 className="text-sm font-medium mb-2">Upload Match History Screenshot</h3>
      <p className="text-xs text-gray-500 mb-3">
        Take a screenshot of your Rocket League Match History showing the completed game.
      </p>

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
        className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded transition-colors"
      >
        {uploading ? "Analyzing screenshot..." : "Upload Match History Screenshot"}
      </button>

      <canvas ref={canvasRef} className="hidden" />

      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

      {result && (
        <div className="mt-3 p-3 bg-green-900/30 border border-green-700 rounded">
          <p className="text-green-300 text-sm">
            Winner: <strong>{result.winner_name}</strong> (confidence:{" "}
            {(result.confidence * 100).toFixed(0)}%)
          </p>
        </div>
      )}
    </div>
  );
}
