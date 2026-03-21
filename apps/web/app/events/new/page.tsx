"use client";

import { startTransition, useState, type ChangeEvent } from "react";
import Link from "next/link";

import { Button, Card, Field, Input, TextArea } from "@go-fish/ui";

import { LoginPanel } from "../../../components/login-panel";
import { authClient } from "../../../lib/auth-client";
import { api } from "../../../lib/api";

export default function NewEventPage() {
  const { data: session, isPending } = authClient.useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationHint, setLocationHint] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createdEvent, setCreatedEvent] = useState<Awaited<ReturnType<typeof api.createEvent>>["event"] | null>(null);

  if (!session?.user && isPending) {
    return <p className="gf-muted">Checking session…</p>;
  }

  if (!session?.user) {
    return (
      <div className="gf-page-center">
        <LoginPanel callbackPath="/events/new" />
      </div>
    );
  }

  const joinUrl = createdEvent ? `${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"}/join/${createdEvent.slug}` : null;

  async function copyJoinLink() {
    if (!joinUrl) {
      return;
    }

    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    startTransition(() => {
      void api
        .createEvent({
          title,
          description,
          locationHint,
          dateFrom,
          dateTo,
        })
        .then(({ event: nextEvent }) => {
          setCreatedEvent(nextEvent);
        })
        .catch((submitError) => {
          setError(submitError instanceof Error ? submitError.message : "Could not create the group.");
        })
        .finally(() => setIsSaving(false));
    });
  }

  if (createdEvent && joinUrl) {
    return (
      <div className="gf-stack gf-stack--xl">
        <h2 className="gf-section-title">Group created</h2>
        <div className="gf-actions">
          <Button onClick={() => void copyJoinLink()}>
            {copied ? "Copied!" : "Copy link"}
          </Button>
          <Link href={`/events/${createdEvent.id}/options`}>
            <Button variant="secondary">View group</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="gf-stack gf-stack--xl">
      <h2 className="gf-section-title">Create group</h2>
      <Card>
        <form className="gf-form" onSubmit={handleSubmit}>
          <Field hint="A short, clear title works best." label="Title">
            <Input onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)} placeholder="Sunday dinner in Berlin" value={title} />
          </Field>
          <Field hint="Optional context for Gemini and the group." label="Description">
            <TextArea
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDescription(event.target.value)}
              placeholder="Keep it flexible, social, and not too expensive."
              rows={4}
              value={description}
            />
          </Field>
          <Field hint="City, district, or region." label="Location">
            <Input onChange={(event: ChangeEvent<HTMLInputElement>) => setLocationHint(event.target.value)} placeholder="Berlin Mitte" value={locationHint} />
          </Field>
          <div className="gf-form__row">
            <Field label="Date from">
              <Input onChange={(event: ChangeEvent<HTMLInputElement>) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
            </Field>
            <Field label="Date to">
              <Input onChange={(event: ChangeEvent<HTMLInputElement>) => setDateTo(event.target.value)} type="date" value={dateTo} />
            </Field>
          </div>
          {error ? <p className="gf-feedback gf-feedback--error">{error}</p> : null}
          <Button loading={isSaving} type="submit">
            Create group
          </Button>
        </form>
      </Card>
    </div>
  );
}
