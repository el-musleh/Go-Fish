"use client";

import { useEffect, useState } from "react";

import type { PreferencesResponse } from "@go-fish/contracts";

import { LoginPanel } from "../../../components/login-panel";
import { PreferenceBenchmark } from "../../../components/preference-benchmark";
import { authClient } from "../../../lib/auth-client";
import { api } from "../../../lib/api";

export default function PreferencesPage() {
  const { data: session, isPending } = authClient.useSession();
  const [data, setData] = useState<PreferencesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    void api
      .getPreferences()
      .then(setData)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load your preferences."));
  }, [session?.user]);

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
    return <p className="gf-muted">Loading preferences…</p>;
  }

  return (
    <PreferenceBenchmark
      initialValue={data.tasteProfile}
      onSubmit={async (payload) => {
        const refreshed = await api.updatePreferences(payload);
        setData(refreshed);
      }}
      questions={data.benchmarkQuestions}
    />
  );
}
