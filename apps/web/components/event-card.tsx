"use client";

import Link from "next/link";
import { useState } from "react";

import type { EventSummary } from "@go-fish/contracts";
import { Button, Card } from "@go-fish/ui";

export function EventCard({ event }: { event: EventSummary }) {
  const [copied, setCopied] = useState(false);
  const joinUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"}/join/${event.slug}`;
  const href = event.isOwner ? `/events/${event.id}/options` : `/join/${event.slug}`;

  async function copyJoinLink(e: React.MouseEvent) {
    e.preventDefault();
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <Card className="gf-event-card">
        <h3 className="gf-card-title">{event.title}</h3>
        {event.isOwner ? (
          <Button onClick={(e) => void copyJoinLink(e)} variant="ghost">
            {copied ? "Copied" : "Copy link"}
          </Button>
        ) : null}
      </Card>
    </Link>
  );
}
