"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, Card } from "@go-fish/ui";

import { LoginPanel } from "../../../../components/login-panel";
import { authClient } from "../../../../lib/auth-client";
import { api } from "../../../../lib/api";

type EventPageData = Awaited<ReturnType<typeof api.getEvent>>;

export default function EventOptionsPage() {
  const params = useParams<{ id: string }>();
  const { data: session, isPending } = authClient.useSession();
  const [data, setData] = useState<EventPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session?.user || !params.id) return;
    void api
      .getEvent(params.id)
      .then(setData)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load the event."));
  }, [params.id, session?.user]);

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
      {data.event.options.length ? (
        <div className="gf-grid gf-grid--three">
          {data.event.options.map((option) => (
            <Card className="gf-option-card" key={option.id}>
              <h3 className="gf-card-title">{option.title}</h3>
              <p className="gf-muted">
                {option.recommendedDate} · {option.timeOfDay.replace("_", " ")}
              </p>
              <Button
                loading={isWorking}
                onClick={() => choose(option.id)}
                variant={data.event.selectedOptionId === option.id ? "secondary" : "primary"}
              >
                {data.event.selectedOptionId === option.id ? "Selected" : "Choose"}
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <p className="gf-muted">Waiting for responses.</p>
        </Card>
      )}
    </div>
  );
}
