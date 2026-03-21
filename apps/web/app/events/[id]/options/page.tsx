"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, Card } from "@go-fish/ui";

import { LoginPanel } from "../../../../components/login-panel";
import { authClient } from "../../../../lib/auth-client";
import { api } from "../../../../lib/api";

type EventPageData = Awaited<ReturnType<typeof api.getEvent>>;

export default function EventOptionsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [data, setData] = useState<EventPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session?.user || !params.id) return;
    void api
      .getEvent(params.id)
      .then(setData)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load the event."));
  }, [params.id, session?.user]);

  // Auto-poll every 30s while waiting for options
  useEffect(() => {
    if (!session?.user || !params.id) return;
    if (
      data &&
      data.event.options.length > 0 &&
      (data.event.status === "awaiting_selection" || data.event.status === "finalized")
    )
      return;

    const interval = setInterval(() => {
      api.getEvent(params.id).then(setData).catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, [params.id, session?.user, data?.event.status, data?.event.options.length]);

  if (!session?.user && !isPending) {
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
    return <p className="gf-muted">Loading event…</p>;
  }

  async function choose(optionId: string) {
    if (!data) return;

    setIsWorking(true);
    try {
      const refreshed = await api.selectOption(data.event.id, { optionId });
      const full = await api.getEvent(refreshed.event.id);
      setData(full);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "Could not finalize the event.");
    } finally {
      setIsWorking(false);
    }
  }

  async function retry() {
    if (!data) return;

    setIsWorking(true);
    try {
      await api.retryGeneration(data.event.id);
      const refreshed = await api.getEvent(data.event.id);
      setData(refreshed);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Could not requeue generation.");
    } finally {
      setIsWorking(false);
    }
  }

  const joinUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"}/join/${data.event.slug}`;

  async function copyJoinLink() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function dismiss(optionId: string) {
    setDismissed((prev) => new Set(prev).add(optionId));
  }

  const options = data.event.options;
  const visibleOptions = options.filter((o) => !dismissed.has(o.id));
  const isFinalized = data.event.status === "finalized" || data.event.selectedOptionId;

  // Post-selection confirmation
  if (isFinalized) {
    const selected = options.find((o) => o.id === data.event.selectedOptionId);
    return (
      <div className="gf-stack gf-stack--xl">
        <h2 className="gf-section-title">Event finalized</h2>
        {selected ? (
          <Card className="gf-option-card">
            <h3 className="gf-card-title">{selected.title}</h3>
            <p className="gf-muted">
              {selected.recommendedDate} · {selected.timeOfDay.replace("_", " ")}
            </p>
          </Card>
        ) : null}
        <div className="gf-actions">
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

  return (
    <div className="gf-stack gf-stack--xl">
      <div className="gf-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="gf-section-title">{data.event.title}</h2>
        <Button onClick={() => void copyJoinLink()} variant="ghost">
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      {data.event.status === "generation_failed" ? (
        <Button loading={isWorking} onClick={retry}>
          Retry generation
        </Button>
      ) : null}
      {visibleOptions.length > 0 ? (
        <div className="gf-grid gf-grid--three">
          {visibleOptions.map((option) => (
            <Card className="gf-option-card gf-option-card--dismissible" key={option.id}>
              <button
                className="gf-option-card__dismiss"
                onClick={() => dismiss(option.id)}
                type="button"
                aria-label="Dismiss"
              >
                ×
              </button>
              <h3 className="gf-card-title">{option.title}</h3>
              <p className="gf-muted">
                {option.recommendedDate} · {option.timeOfDay.replace("_", " ")}
              </p>
              <Button
                loading={isWorking}
                onClick={() => choose(option.id)}
                variant="primary"
              >
                Choose
              </Button>
            </Card>
          ))}
        </div>
      ) : options.length > 0 ? (
        <div className="gf-stack">
          <p className="gf-muted">All options dismissed.</p>
          <Button onClick={() => setDismissed(new Set())} variant="ghost">
            Show again
          </Button>
        </div>
      ) : (
        <Card>
          <p className="gf-muted">Waiting for responses.</p>
        </Card>
      )}
    </div>
  );
}
