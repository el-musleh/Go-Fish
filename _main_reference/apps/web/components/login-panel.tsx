"use client";

import { useState, type ChangeEvent } from "react";

import { Button, Card, Field, Input } from "@go-fish/ui";

import { authClient } from "../lib/auth-client";

export function LoginPanel({ callbackPath = "/dashboard" }: { callbackPath?: string }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  function normalizeIdentifier(value: string) {
    const trimmed = value.trim().toLowerCase();
    return trimmed.includes("@") ? trimmed : `${trimmed}@gofish.local`;
  }

  function handlePasswordLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPasswordLoading(true);

    void authClient.signIn
      .email(
        {
          email: normalizeIdentifier(identifier),
          password,
        },
        {
          onSuccess: () => {
            window.location.assign(callbackPath);
          },
          onError: (context) => {
            setError(context.error.message ?? "Could not sign in.");
          },
        },
      )
      .finally(() => setIsPasswordLoading(false));
  }

  return (
    <Card className="gf-auth-panel">
      <h2 className="gf-section-title">Sign in</h2>
      <div className="gf-auth-panel__grid">
        <form className="gf-stack" onSubmit={handlePasswordLogin}>
          <Field label="User or email">
            <Input autoComplete="username" onChange={(event: ChangeEvent<HTMLInputElement>) => setIdentifier(event.target.value)} placeholder="testuser" value={identifier} />
          </Field>
          <Field label="Password">
            <Input autoComplete="current-password" onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)} placeholder="testuser" type="password" value={password} />
          </Field>
          <Button loading={isPasswordLoading} type="submit">
            Sign in
          </Button>
        </form>
      </div>
      {error ? <p className="gf-feedback gf-feedback--error">{error}</p> : null}
    </Card>
  );
}
