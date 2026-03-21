"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button, Card } from "@go-fish/ui";

import { CountdownTimer } from "../../../components/countdown-timer";
import { LoginPanel } from "../../../components/login-panel";
import { RespondentList } from "../../../components/respondent-list";
import { authClient } from "../../../lib/auth-client";
import { api } from "../../../lib/api";

type EventPageData = Awaited<ReturnType<typeof api.getEvent>>;

const POLL_INTERVAL = 5000;

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the event."));
  }, [params.id, session?.user]);

  // Poll every 5s while collecting/generating
  useEffect(() => {
    if (!session?.user || !params.id || !data) return;
    const status = data.event.status;
    if (status === "finalized") return;
    const interval = setInterval(() => {
      api.getEvent(params.id).then(setData).catch(() => {});
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [params.id, session?.user, data?.event.status]);

  const handleExpire = useCallback(() => {
    if (!params.id) return;
    api.getEvent(params.id).then(setData).catch(() => {});
  }, [params.id]);

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
    return <p className="gf-muted">Loading event...</p>;
  }

  const { event, invitees } = data;
  const joinUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"}/join/${event.slug}`;
  const total = event.pendingInvitees + event.respondedInvitees;

  async function copyJoinLink() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function generateNow() {
    setIsWorking(true);
    try {
      await api.retryGeneration(event.id);
      const refreshed = await api.getEvent(event.id);
      setData(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not trigger generation.");
    } finally {
      setIsWorking(false);
    }
  }

  // Finalized → redirect to confirmation
  if (event.status === "finalized") {
    return (
      <div className="gf-stack gf-stack--xl">
        <h2 className="gf-section-title">{event.title}</h2>
        <Card>
          <p className="gf-muted">This event has been finalized.</p>
        </Card>
        <div className="gf-actions">
          <Link href={`/events/${event.id}/confirmed`}>
            <Button>View confirmation</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Options ready → go pick
  if (event.status === "awaiting_selection" && event.options.length > 0) {
    return (
      <div className="gf-stack gf-stack--xl">
        <h2 className="gf-section-title">{event.title}</h2>
        <Card>
          <h3 className="gf-card-title">Options ready</h3>
          <p className="gf-muted">{event.options.length} options generated. Pick your favorite.</p>
        </Card>
        <div className="gf-actions">
          <Link href={`/events/${event.id}/options`}>
            <Button>Choose an option</Button>
          </Link>
          <Button onClick={() => void copyJoinLink()} variant="ghost">
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </div>
    );
  }

  // Generating
  if (event.status === "generating_options") {
    return (
      <div className="gf-stack gf-stack--xl">
        <h2 className="gf-section-title">{event.title}</h2>
        <Card>
          <h3 className="gf-card-title">Generating options...</h3>
          <p className="gf-muted">The AI is creating activity suggestions. This usually takes a moment.</p>
        </Card>
      </div>
    );
  }

  // Collecting responses (main state)
  return (
    <div className="gf-stack gf-stack--xl">
      <h2 className="gf-section-title">{event.title}</h2>

      <div className="gf-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <Button onClick={() => void copyJoinLink()} variant="secondary">
          {copied ? "Copied" : "Copy invite link"}
        </Button>
        <CountdownTimer deadline={event.responseDeadlineAt} onExpire={handleExpire} />
      </div>

      <Card>
        <div className="gf-stack">
          <h3 className="gf-card-title">
            Respondents {total > 0 ? `(${event.respondedInvitees}/${total})` : ""}
          </h3>
          <RespondentList invitees={invitees} />
        </div>
      </Card>

      {event.status === "generation_failed" ? (
        <p className="gf-feedback gf-feedback--error">Generation failed. You can retry below.</p>
      ) : null}

      <div className="gf-actions">
        <Button
          loading={isWorking}
          onClick={() => void generateNow()}
          variant="primary"
        >
          Generate options{total > 0 ? ` (${event.respondedInvitees} responded)` : ""}
        </Button>
      </div>
    </div>
  );
}
