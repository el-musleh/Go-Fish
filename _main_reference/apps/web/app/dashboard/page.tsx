"use client";

import { useEffect, useState } from "react";

import { Card } from "@go-fish/ui";
import type { DashboardResponse } from "@go-fish/contracts";

import { EventCard } from "../../components/event-card";
import { LoginPanel } from "../../components/login-panel";
import { authClient } from "../../lib/auth-client";
import { api } from "../../lib/api";

const POLL_INTERVAL = 5000;

export default function DashboardPage() {
  const { data: session, isPending } = authClient.useSession();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    void api
      .getDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the dashboard."));
  }, [session?.user]);

  // Poll every 5s
  useEffect(() => {
    if (!session?.user) return;
    const interval = setInterval(() => {
      api.getDashboard().then(setData).catch(() => {});
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [session?.user]);

  if (!session?.user && !isPending) {
    return (
      <div className="gf-page-center">
        <LoginPanel />
      </div>
    );
  }

  async function handleDelete(eventId: string) {
    try {
      await api.deleteEvent(eventId);
      setData((prev) =>
        prev ? { ...prev, events: prev.events.filter((e) => e.id !== eventId) } : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete event.");
    }
  }

  const myEvents = data?.events.filter((e) => e.isOwner) ?? [];
  const joinedEvents = data?.events.filter((e) => !e.isOwner) ?? [];
  const hasAny = myEvents.length > 0 || joinedEvents.length > 0;

  return (
    <div className="gf-stack gf-stack--xl">
      {error ? <p className="gf-feedback gf-feedback--error">{error}</p> : null}

      {myEvents.length > 0 ? (
        <section className="gf-stack">
          <h2 className="gf-section-title">My Events</h2>
          <div className="gf-grid gf-grid--two">
            {myEvents.map((event) => (
              <EventCard event={event} key={event.id} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      ) : null}

      {joinedEvents.length > 0 ? (
        <section className="gf-stack">
          <h2 className="gf-section-title">Joined Events</h2>
          <div className="gf-grid gf-grid--two">
            {joinedEvents.map((event) => (
              <EventCard event={event} key={event.id} />
            ))}
          </div>
        </section>
      ) : null}

      {!hasAny && data ? (
        <Card>
          <h3 className="gf-card-title">No groups yet</h3>
        </Card>
      ) : null}
    </div>
  );
}
