"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button, Card } from "@go-fish/ui";

import { CountdownTimer } from "../../../components/countdown-timer";
import { LoginPanel } from "../../../components/login-panel";
import { RespondentList } from "../../../components/respondent-list";
import { authClient } from "../../../lib/auth-client";
import { api } from "../../../lib/api";
import { prettyDate } from "../../../lib/date";

type EventPageData = Awaited<ReturnType<typeof api.getEvent>>;

const POLL_INTERVAL = 5000;
const RANK_CLASS: Record<number, string> = {
  1: "gf-option-card--rank-1",
  2: "gf-option-card--rank-2",
  3: "gf-option-card--rank-3",
};

export default function EventDetailPage() {
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
    if (!session?.user || !params.id || !data) return;
    if (data.event.status === "finalized") return;
    const interval = setInterval(() => {
      if (isSelectingRef.current) return;
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

  async function choose(optionId: string) {
    isSelectingRef.current = true;
    setIsWorking(true);
    try {
      await api.selectOption(event.id, { optionId });
      router.push(`/events/${event.id}/confirmed`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finalize the event.");
    } finally {
      setIsWorking(false);
      isSelectingRef.current = false;
    }
  }

  // Finalized → show confirmation link
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

  // Options ready → show ranked cards inline
  if (event.options.length > 0) {
    return (
      <div className="gf-stack gf-stack--xl">
        <div className="gf-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="gf-section-title">{event.title}</h2>
          <Button onClick={() => void copyJoinLink()} variant="ghost">
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>

        {event.status === "generation_failed" ? (
          <Button loading={isWorking} onClick={generateNow}>
            Retry generation
          </Button>
        ) : null}

        <div className="gf-grid gf-grid--three">
          {event.options.map((option) => (
            <Card className={`gf-option-card ${RANK_CLASS[option.rank] ?? ""}`} key={option.id}>
              {option.rank === 1 ? <span className="gf-top-pick">Top Pick</span> : null}
              <h3 className="gf-card-title">{option.title}</h3>
              <p className="gf-muted">
                {prettyDate(option.recommendedDate)} · {option.timeOfDay.replace("_", " ")}
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
