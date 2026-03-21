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

  // Auto-poll every 30s while waiting for AI options
  useEffect(() => {
    if (!session?.user || !params.slug) return;
    const done = data?.viewerHasCompletedBenchmark && data?.invitee?.responseStatus === "responded";
    const waiting = !data?.event.options.length && data?.event.status !== "finalized";
    if (!done || !waiting) return;

    const interval = setInterval(() => {
      api.getJoinEvent(params.slug).then(setData).catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, [params.slug, session?.user, data?.viewerHasCompletedBenchmark, data?.invitee?.responseStatus, data?.event.status, data?.event.options.length]);

  if (!session?.user && isPending) {
    return <p className="gf-muted">Checking session…</p>;
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
    return <p className="gf-muted">Loading invite…</p>;
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

    if (joinData.event.options.length > 0) {
      return (
        <div className="gf-stack gf-stack--xl">
          <h3 className="gf-card-title">{selectedOption ? "Plan selected" : "Waiting for organizer"}</h3>
          <div className="gf-grid gf-grid--three">
            {joinData.event.options.map((option) => (
              <Card className="gf-option-card" key={option.id}>
                <h3 className="gf-card-title">{option.title}</h3>
                <p className="gf-muted">
                  {prettyDate(option.recommendedDate)} · {option.timeOfDay.replace("_", " ")}
                </p>
              </Card>
            ))}
          </div>
        </div>
      );
    }

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
