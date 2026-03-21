"use client"

import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { Empty } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, MapPin } from "lucide-react"
import type { Event } from "@/lib/types"
import { format, parseISO, isToday, isTomorrow, isPast, isFuture, startOfDay, addDays } from "date-fns"
import { cn } from "@/lib/utils"

async function fetchEvents(): Promise<Event[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .in("status", ["planning", "confirmed", "completed"])
    .order("event_date", { ascending: true })

  if (error) throw error
  return data || []
}

function getDateLabel(date: Date): string {
  if (isToday(date)) return "Today"
  if (isTomorrow(date)) return "Tomorrow"
  return format(date, "EEEE, MMMM d")
}

interface GroupedEvents {
  [key: string]: Event[]
}

export default function TimelinePage() {
  const { data: events, error, isLoading } = useSWR("timeline-events", fetchEvents)

  // Group events by date
  const groupedEvents = events?.reduce<GroupedEvents>((acc, event) => {
    const dateKey = event.event_date
    if (!acc[dateKey]) {
      acc[dateKey] = []
    }
    acc[dateKey].push(event)
    return acc
  }, {})

  const sortedDates = groupedEvents
    ? Object.keys(groupedEvents).sort((a, b) => parseISO(a).getTime() - parseISO(b).getTime())
    : []

  // Separate upcoming and past dates
  const today = startOfDay(new Date())
  const upcomingDates = sortedDates.filter((date) => parseISO(date) >= today)
  const pastDates = sortedDates.filter((date) => parseISO(date) < today).reverse()

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="border-b bg-card px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight">Timeline</h1>
          <p className="mt-1 text-muted-foreground">
            Your events at a glance
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl">
          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <Empty
              icon={Calendar}
              title="Unable to load timeline"
              description="There was an error loading your events. Please try again."
            />
          ) : events?.length === 0 ? (
            <Empty
              icon={Calendar}
              title="No events scheduled"
              description="Your timeline will show upcoming and past events once you create some."
            />
          ) : (
            <div className="space-y-8">
              {/* Upcoming Events */}
              {upcomingDates.length > 0 && (
                <section>
                  <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Upcoming
                  </h2>
                  <div className="relative space-y-0">
                    {/* Timeline line */}
                    <div className="absolute left-3 top-3 bottom-3 w-px bg-border" />
                    
                    {upcomingDates.map((dateKey, dateIndex) => {
                      const date = parseISO(dateKey)
                      const dateEvents = groupedEvents?.[dateKey] || []
                      const isFirst = dateIndex === 0

                      return (
                        <div key={dateKey} className="relative pb-6 last:pb-0">
                          {/* Timeline dot */}
                          <div
                            className={cn(
                              "absolute left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-background",
                              isFirst ? "bg-primary" : "bg-muted-foreground"
                            )}
                          />

                          <div className="ml-8">
                            <h3
                              className={cn(
                                "mb-3 text-sm font-medium",
                                isFirst ? "text-primary" : "text-foreground"
                              )}
                            >
                              {getDateLabel(date)}
                            </h3>
                            <div className="space-y-3">
                              {dateEvents.map((event) => (
                                <TimelineEventCard key={event.id} event={event} />
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Past Events */}
              {pastDates.length > 0 && (
                <section>
                  <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Past
                  </h2>
                  <div className="relative space-y-0">
                    {/* Timeline line */}
                    <div className="absolute left-3 top-3 bottom-3 w-px bg-border opacity-50" />
                    
                    {pastDates.map((dateKey) => {
                      const date = parseISO(dateKey)
                      const dateEvents = groupedEvents?.[dateKey] || []

                      return (
                        <div key={dateKey} className="relative pb-6 last:pb-0 opacity-70">
                          {/* Timeline dot */}
                          <div className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-background bg-muted" />

                          <div className="ml-8">
                            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                              {format(date, "EEEE, MMMM d")}
                            </h3>
                            <div className="space-y-3">
                              {dateEvents.map((event) => (
                                <TimelineEventCard key={event.id} event={event} isPast />
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function TimelineEventCard({ event, isPast }: { event: Event; isPast?: boolean }) {
  const formattedTime = event.event_time
    ? format(parseISO(`2000-01-01T${event.event_time}`), "h:mm a")
    : null

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-shadow",
        !isPast && "hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium">{event.title}</h4>
        <Badge
          variant="secondary"
          className={cn(
            "shrink-0 text-xs",
            event.status === "confirmed" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
            event.status === "completed" && "bg-slate-100 text-slate-800 dark:bg-slate-800/30 dark:text-slate-400"
          )}
        >
          {event.status === "planning" ? "Planning" : event.status === "confirmed" ? "Confirmed" : "Completed"}
        </Badge>
      </div>
      {event.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {event.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {formattedTime && (
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{formattedTime}</span>
          </div>
        )}
        {event.location && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
        )}
      </div>
    </div>
  )
}
