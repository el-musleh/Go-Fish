"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button, Card } from "@go-fish/ui";

import { LoginPanel } from "../../../../components/login-panel";
import { authClient } from "../../../../lib/auth-client";
import { api } from "../../../../lib/api";
import { prettyDate } from "../../../../lib/date";

type EventPageData = Awaited<ReturnType<typeof api.getEvent>>;

const POLL_INTERVAL = 5000;
const RANK_CLASS: Record<number, string> = {
  1: "gf-option-card--rank-1",
  2: "gf-option-card--rank-2",
  3: "gf-option-card--rank-3",
};

export default function EventOptionsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [data, setData] = useState<EventPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const isSelectingRef = useRef(false);

  useEffect(() => {
    if (!session?.user || !params.id) return;
    void api
      .getEvent(params.id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the event."));
  }, [params.id, session?.user]);

  // Poll every 5s until finalized
  useEffect(() => {
    if (!session?.user || !params.id) return;
    if (data?.event.status === "finalized") return;

    const interval = setInterval(() => {
      if (isSelectingRef.current) return;
      api.getEvent(params.id).then(setData).catch(() => {});
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [params.id, session?.user, data?.event.status]);

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
    return <p className="gf-muted">Loading event...</p>;
  }

  async function choose(optionId: string) {
    if (!data) return;
    isSelectingRef.current = true;
    setIsWorking(true);
    try {
      await api.selectOption(data.event.id, { optionId });
      router.push(`/events/${data.event.id}/confirmed`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finalize the event.");
    } finally {
      setIsWorking(false);
      isSelectingRef.current = false;
    }
  }

  async function retry() {
    if (!data) return;
    setIsWorking(true);
    try {
      await api.retryGeneration(data.event.id);
      const refreshed = await api.getEvent(data.event.id);
      setData(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not requeue generation.");
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

  const options = data.event.options;
  const total = data.event.pendingInvitees + data.event.respondedInvitees;

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

      {options.length > 0 ? (
        <div className="gf-grid gf-grid--three">
          {options.map((option) => (
            <Card className={`gf-option-card ${RANK_CLASS[option.rank] ?? ""}`} key={option.id}>
              {option.rank === 1 ? <span className="gf-top-pick">Top Pick</span> : null}
              <h3 className="gf-card-title">{option.title}</h3>
              <p className="gf-muted">
                {prettyDate(option.recommendedDate)} · {option.timeOfDay.replace("_", " ")}
              </p>
              {option.description ? <p>{option.description}</p> : null}
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
      ) : (
        <Card>
          <p className="gf-muted">
            {total > 0
              ? `${data.event.respondedInvitees} of ${total} responded`
              : "Waiting for responses."}
          </p>
        </Card>
      )}
    </div>
  );
}
