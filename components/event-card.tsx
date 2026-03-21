"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, MapPin, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Event } from "@/lib/types"
import { format, parseISO } from "date-fns"

interface EventCardProps {
  event: Event
  onStatusChange?: (eventId: string, status: Event["status"]) => void
  onDelete?: (eventId: string) => void
}

const statusColors: Record<Event["status"], string> = {
  planning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  confirmed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-slate-100 text-slate-800 dark:bg-slate-800/30 dark:text-slate-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

const statusLabels: Record<Event["status"], string> = {
  planning: "Planning",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
}

export function EventCard({ event, onStatusChange, onDelete }: EventCardProps) {
  const eventDate = parseISO(event.event_date)
  const formattedDate = format(eventDate, "EEE, MMM d, yyyy")
  const formattedTime = event.event_time
    ? format(parseISO(`2000-01-01T${event.event_time}`), "h:mm a")
    : null

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1 text-lg">{event.title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={statusColors[event.status]}>
              {statusLabels[event.status]}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Event options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {event.status === "planning" && (
                  <DropdownMenuItem onClick={() => onStatusChange?.(event.id, "confirmed")}>
                    Mark as Confirmed
                  </DropdownMenuItem>
                )}
                {event.status === "confirmed" && (
                  <DropdownMenuItem onClick={() => onStatusChange?.(event.id, "completed")}>
                    Mark as Completed
                  </DropdownMenuItem>
                )}
                {(event.status === "planning" || event.status === "confirmed") && (
                  <DropdownMenuItem onClick={() => onStatusChange?.(event.id, "cancelled")}>
                    Cancel Event
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete?.(event.id)}
                >
                  Delete Event
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {event.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {event.description}
          </p>
        )}
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>{formattedDate}</span>
          </div>
          {formattedTime && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{formattedTime}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
