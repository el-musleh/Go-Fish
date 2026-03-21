"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { EventCard } from "@/components/event-card"
import { AIDialog } from "@/components/ai-dialog"
import { Empty } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Fish, Calendar } from "lucide-react"
import type { Event } from "@/lib/types"

async function fetchEvents(): Promise<Event[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true })

  if (error) throw error
  return data || []
}

export default function HomePage() {
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const supabase = createClient()

  const { data: events, error, isLoading, mutate } = useSWR("events", fetchEvents)

  const handleStatusChange = useCallback(
    async (eventId: string, status: Event["status"]) => {
      await supabase.from("events").update({ status }).eq("id", eventId)
      mutate()
    },
    [supabase, mutate]
  )

  const handleDelete = useCallback(
    async (eventId: string) => {
      await supabase.from("events").delete().eq("id", eventId)
      mutate()
    },
    [supabase, mutate]
  )

  const handleEventCreated = useCallback(() => {
    mutate()
  }, [mutate])

  const upcomingEvents = events?.filter(
    (e) => e.status === "planning" || e.status === "confirmed"
  )
  const pastEvents = events?.filter(
    (e) => e.status === "completed" || e.status === "cancelled"
  )

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="border-b bg-card px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your Events</h1>
            <p className="mt-1 text-muted-foreground">
              Plan and track your social gatherings
            </p>
          </div>
          <Button onClick={() => setAiDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Event</span>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-8">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : error ? (
            <Empty
              icon={Calendar}
              title="Unable to load events"
              description="There was an error loading your events. Please try again."
            />
          ) : events?.length === 0 ? (
            <Empty
              icon={Fish}
              title="No events yet"
              description="Start planning your first event with Go Fish!"
              action={
                <Button onClick={() => setAiDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Plan your first event
                </Button>
              }
            />
          ) : (
            <>
              {upcomingEvents && upcomingEvents.length > 0 && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold">Upcoming Events</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {upcomingEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </section>
              )}

              {pastEvents && pastEvents.length > 0 && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold text-muted-foreground">
                    Past Events
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {pastEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <AIDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        onEventCreated={handleEventCreated}
      />
    </div>
  )
}
