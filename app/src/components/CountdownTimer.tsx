"use client";

import { useEffect, useState } from "react";

export function CountdownTimer({
  expiresAt,
  label,
}: {
  expiresAt: string;
  label: string;
}) {
  const [remaining, setRemaining] = useState("");
  const [expired, setExpired] = useState(false);
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    function tick() {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("0:00");
        setExpired(true);
        setUrgent(false);
        return;
      }
      setUrgent(diff < 60_000);
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div
      className={`cn-timer ${expired ? "cn-timer-urgent" : urgent ? "cn-timer-urgent" : "cn-timer-normal"}`}
    >
      <span className="text-cn-text-muted text-xs uppercase tracking-wider">{label}</span>
      <span className="font-bold tabular-nums">{remaining}</span>
    </div>
  );
}
