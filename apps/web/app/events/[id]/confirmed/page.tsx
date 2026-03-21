"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, Card } from "@go-fish/ui";

import { LoginPanel } from "../../../../components/login-panel";
import { authClient } from "../../../../lib/auth-client";
import { api } from "../../../../lib/api";
import { prettyDate } from "../../../../lib/date";

type EventPageData = Awaited<ReturnType<typeof api.getEvent>>;

export default function EventConfirmedPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [data, setData] = useState<EventPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session?.user || !params.id) return;
    void api
      .getEvent(params.id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the event."));
  }, [params.id, session?.user]);

  if (!session?.user && isPending) {
    return <p className="gf-muted">Checking session...</p>;
  }

  if (!session?.user) {
    return (
      <div className="gf-page-center">
        <LoginPanel />
      </div>
    );
  }

  if (error) {
    return <p className="gf-feedback gf-feedback--error">{error}</p>;
  }

  if (!data) {
    return <p className="gf-muted">Loading...</p>;
  }

  const { event } = data;
  const selected = event.options.find((o) => o.id === event.selectedOptionId) ?? null;
  const joinUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"}/join/${event.slug}`;

  async function copyJoinLink() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="gf-stack gf-stack--xl">
      <div className="gf-celebration">
        <h2 className="gf-celebration__heading">Event Confirmed</h2>
      </div>

      {selected ? (
        <Card className="gf-option-card gf-option-card--featured">
          <h3 className="gf-card-title">{selected.title}</h3>
          <p className="gf-muted">
            {prettyDate(selected.recommendedDate)} · {selected.timeOfDay.replace("_", " ")}
          </p>
          <p style={{ marginTop: 12 }}>{selected.whyItFits}</p>
        </Card>
      ) : null}

      <div className="gf-actions" style={{ justifyContent: "center" }}>
        <Button onClick={() => void copyJoinLink()} variant="secondary">
          {copied ? "Copied" : "Share link"}
        </Button>
        <Button onClick={() => router.push("/dashboard")} variant="ghost">
          Dashboard
        </Button>
      </div>
    </div>
  );
}
