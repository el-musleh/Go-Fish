"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, Card } from "@go-fish/ui";
import type { JoinEventResponse } from "@go-fish/contracts";

import { DateSelector } from "../../../components/date-selector";
import { LoginPanel } from "../../../components/login-panel";
import { PreferenceBenchmark } from "../../../components/preference-benchmark";
import { authClient } from "../../../lib/auth-client";
import { api } from "../../../lib/api";
import { prettyDate } from "../../../lib/date";

const POLL_INTERVAL = 5000;

export default function JoinEventPage() {
  const params = useParams<{ slug: string }>();
  const { data: session, isPending } = authClient.useSession();
  const [data, setData] = useState<JoinEventResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session?.user || !params.slug) return;
    void api
      .getJoinEvent(params.slug)
      .then(setData)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load the invite."));
  }, [params.slug, session?.user]);

  // Live-sync: poll every 5s after user has responded (waiting for options or finalization)
  useEffect(() => {
    if (!session?.user || !params.slug) return;

    const hasResponded = data?.invitee?.responseStatus === "responded";
    const benchmarkDone = data?.viewerHasCompletedBenchmark;
    const isTerminal = data?.event.status === "finalized";

    // Poll when: user has finished their part and waiting for AI or organizer decision
    // Also poll when options exist but not yet finalized (waiting for organizer to choose)
    if (!benchmarkDone || !hasResponded || isTerminal) return;

    const interval = setInterval(() => {
      api.getJoinEvent(params.slug).then(setData).catch(() => {});
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [params.slug, session?.user, data?.viewerHasCompletedBenchmark, data?.invitee?.responseStatus, data?.event.status]);

  if (!session?.user && isPending) {
    return <p className="gf-muted">Checking sessionΓÇª</p>;
  }

  if (!session?.user) {
    return (
      <div className="gf-page-center">
        <LoginPanel callbackPath={`/join/${params.slug}`} />
      </div>
    );
  }

  if (error) {
    return <p className="gf-feedback gf-feedback--error">{error}</p>;
  }

  if (!data) {
    return <p className="gf-muted">Loading inviteΓÇª</p>;
  }

  const joinData = data;
  const joinUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"}/join/${joinData.event.slug}`;
  const hasResponded = joinData.invitee?.responseStatus === "responded";
  const selectedOption = joinData.event.options.find((option) => option.id === joinData.event.selectedOptionId) ?? null;

  async function copyJoinLink() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function renderContent() {
    if (joinData.event.isOwner) {
      return (
        <div className="gf-actions">
          <Button onClick={() => void copyJoinLink()} variant="secondary">
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Link href={`/events/${joinData.event.id}/options`}>
            <Button>Organizer view</Button>
          </Link>
        </div>
      );
    }

    if (!joinData.viewerHasCompletedBenchmark) {
      return (
        <PreferenceBenchmark
          initialValue={joinData.currentTasteProfile}
          onSubmit={async (payload) => {
            await api.submitBenchmark(joinData.event.id, payload);
            const refreshed = await api.getJoinEvent(params.slug);
            setData(refreshed);
          }}
          questions={joinData.benchmarkQuestions}
          submitLabel="Save preferences"
        />
      );
    }

    if (!hasResponded && joinData.event.status === "collecting_responses") {
      return (
        <DateSelector
          dateFrom={joinData.event.dateFrom}
          dateTo={joinData.event.dateTo}
          initialSelection={joinData.invitee?.availableDates ?? []}
          onSubmit={async (dates) => {
            const refreshed = await api.submitAvailability(joinData.event.id, { dates });
            setData(refreshed);
          }}
          submitLabel="Save dates"
        />
      );
    }

    // Finalized: show the selected option prominently
    if (selectedOption) {
      return (
        <div className="gf-stack gf-stack--xl">
          <h3 className="gf-card-title">Plan selected</h3>
          <Card className="gf-option-card">
            <h3 className="gf-card-title">{selectedOption.title}</h3>
            <p className="gf-muted">
              {prettyDate(selectedOption.recommendedDate)} ┬╖ {selectedOption.timeOfDay.replace("_", " ")}
            </p>
          </Card>
        </div>
      );
    }

    // Options exist but organizer hasn't chosen yet
    if (joinData.event.options.length > 0) {
      return (
        <div className="gf-stack gf-stack--xl">
          <h3 className="gf-card-title">Waiting for organizer</h3>
          <div className="gf-grid gf-grid--three">
            {joinData.event.options.map((option) => (
              <Card className="gf-option-card" key={option.id}>
                <h3 className="gf-card-title">{option.title}</h3>
                <p className="gf-muted">
                  {prettyDate(option.recommendedDate)} ┬╖ {option.timeOfDay.replace("_", " ")}
                </p>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    // Waiting for AI to generate options
    return (
      <Card>
        <h3 className="gf-card-title">
          {joinData.event.status === "generation_failed" ? "Offers delayed" : "Your answer is saved."}
        </h3>
      </Card>
    );
  }

  return (
    <div className="gf-stack gf-stack--xl">
      <h2 className="gf-section-title">{joinData.event.title}</h2>
      {renderContent()}
    </div>
  );
}