"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number) {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

export function CountdownTimer({
  deadline,
  onExpire,
}: {
  deadline: string;
  onExpire?: () => void;
}) {
  const [remaining, setRemaining] = useState(() => new Date(deadline).getTime() - Date.now());

  useEffect(() => {
    const target = new Date(deadline).getTime();
    const tick = () => {
      const diff = target - Date.now();
      setRemaining(diff);
      if (diff <= 0) {
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, onExpire]);

  const expired = remaining <= 0;

  return (
    <div className="gf-stack gf-stack--sm" style={{ alignItems: "center" }}>
      <span className={`gf-countdown${expired ? " gf-countdown--expired" : ""}`}>
        {expired ? "Expired" : formatRemaining(remaining)}
      </span>
      <span className="gf-countdown__label">
        {expired ? "Response window closed" : "remaining"}
      </span>
    </div>
  );
}
