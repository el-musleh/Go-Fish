"use client";

import Link from "next/link";
import { useState } from "react";

import type { EventSummary } from "@go-fish/contracts";
import { Button, Card } from "@go-fish/ui";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  collecting_responses: { label: "Collecting", className: "gf-status-chip--collecting" },
  generating_options: { label: "Generating", className: "gf-status-chip--generating" },
  awaiting_selection: { label: "Pick activity", className: "gf-status-chip--ready" },
  finalized: { label: "Confirmed", className: "gf-status-chip--finalized" },
  generation_failed: { label: "Retry needed", className: "gf-status-chip--collecting" },
};

export function EventCard({ event }: { event: EventSummary }) {
  const [copied, setCopied] = useState(false);
  const joinUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"}/join/${event.slug}`;
  const href = event.isOwner ? `/events/${event.id}` : `/join/${event.slug}`;
  const statusInfo = STATUS_LABELS[event.status];

  async function copyJoinLink(e: React.MouseEvent) {
    e.preventDefault();
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <Card className="gf-event-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="gf-card-title">{event.title}</h3>
          {statusInfo ? (
            <span className={`gf-status-chip ${statusInfo.className}`}>{statusInfo.label}</span>
          ) : null}
        </div>
        {event.isOwner ? (
          <Button onClick={(e) => void copyJoinLink(e)} variant="ghost">
            {copied ? "Copied" : "Copy link"}
          </Button>
        ) : null}
      </Card>
    </Link>
  );
}
