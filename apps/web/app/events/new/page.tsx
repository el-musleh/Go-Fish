"use client";

import { startTransition, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, Field, Input, TextArea } from "@go-fish/ui";

import { LoginPanel } from "../../../components/login-panel";
import { authClient } from "../../../lib/auth-client";
import { api } from "../../../lib/api";

export default function NewEventPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!session?.user && isPending) {
    return <p className="gf-muted">Checking session...</p>;
  }

  if (!session?.user) {
    return (
      <div className="gf-page-center">
        <LoginPanel callbackPath="/events/new" />
      </div>
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    startTransition(() => {
      void api
        .createEvent({ title, description })
        .then(({ event: created }) => {
          router.push(`/events/${created.id}`);
        })
        .catch((submitError) => {
          setError(submitError instanceof Error ? submitError.message : "Could not create the group.");
        })
        .finally(() => setIsSaving(false));
    });
  }

  return (
    <div className="gf-stack gf-stack--xl">
      <h2 className="gf-section-title">Create group</h2>
      <Card>
        <form className="gf-form" onSubmit={handleSubmit}>
          <Field hint="A short, clear title works best." label="Title">
            <Input onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="Sunday dinner in Berlin" value={title} />
          </Field>
          <Field hint="Optional context for the AI and the group." label="Description">
            <TextArea
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="Keep it flexible, social, and not too expensive."
              rows={4}
              value={description}
            />
          </Field>
          {error ? <p className="gf-feedback gf-feedback--error">{error}</p> : null}
          <Button loading={isSaving} type="submit">
            Create group
          </Button>
        </form>
      </Card>
    </div>
  );
}
