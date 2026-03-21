"use client";

import { useEffect, useState } from "react";

import { Card } from "@go-fish/ui";
import type { DashboardResponse } from "@go-fish/contracts";

import { EventCard } from "../../components/event-card";
import { LoginPanel } from "../../components/login-panel";
import { authClient } from "../../lib/auth-client";
import { api } from "../../lib/api";

export default function DashboardPage() {
  const { data: session, isPending } = authClient.useSession();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    void api
      .getDashboard()
      .then(setData)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load the dashboard."));
  }, [session?.user]);

  if (!session?.user && !isPending) {
    return (
      <div className="gf-page-center">
        <LoginPanel />
      </div>
    );
  }

  return (
    <div className="gf-stack gf-stack--xl">
      {error ? <p className="gf-feedback gf-feedback--error">{error}</p> : null}
      <section className="gf-grid gf-grid--two">
        {data?.events.length ? (
          data.events.map((event) => <EventCard event={event} key={event.id} />)
        ) : (
          <Card>
            <h3 className="gf-card-title">No groups yet</h3>
          </Card>
        )}
      </section>
    </div>
  );
}
