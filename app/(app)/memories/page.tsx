"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field"
import { Camera, Plus, Heart, Loader2 } from "lucide-react"
import type { Event, Memory } from "@/lib/types"
import { format, parseISO } from "date-fns"

interface MemoryWithEvent extends Memory {
  events?: Event | null
}

async function fetchMemories(): Promise<MemoryWithEvent[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("memories")
    .select("*, events(*)")
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

async function fetchCompletedEvents(): Promise<Event[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "completed")
    .order("event_date", { ascending: false })

  if (error) throw error
  return data || []
}

export default function MemoriesPage() {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string>("")
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const { data: memories, error, isLoading, mutate } = useSWR("memories", fetchMemories)
  const { data: completedEvents } = useSWR("completed-events", fetchCompletedEvents)

  const handleAddMemory = useCallback(async () => {
    if (!selectedEventId || !content.trim()) return

    setIsSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setIsSubmitting(false)
      return
    }

    await supabase.from("memories").insert({
      event_id: selectedEventId,
      user_id: user.id,
      content: content.trim(),
    })

    mutate()
    setAddDialogOpen(false)
    setSelectedEventId("")
    setContent("")
    setIsSubmitting(false)
  }, [selectedEventId, content, supabase, mutate])

  const handleCloseDialog = () => {
    setAddDialogOpen(false)
    setSelectedEventId("")
    setContent("")
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="border-b bg-card px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Memories</h1>
            <p className="mt-1 text-muted-foreground">
              Cherish moments from your events
            </p>
          </div>
          {completedEvents && completedEvents.length > 0 && (
            <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Memory</span>
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : error ? (
            <Empty
              icon={Camera}
              title="Unable to load memories"
              description="There was an error loading your memories. Please try again."
            />
          ) : memories?.length === 0 ? (
            <Empty
              icon={Heart}
              title="No memories yet"
              description={
                completedEvents && completedEvents.length > 0
                  ? "Add your first memory from a completed event!"
                  : "Complete an event to start adding memories."
              }
              action={
                completedEvents && completedEvents.length > 0 ? (
                  <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add your first memory
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {memories?.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Memory Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a Memory</DialogTitle>
            <DialogDescription>
              Capture a special moment from one of your completed events.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="event">Event</FieldLabel>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger id="event">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {completedEvents?.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title} - {format(parseISO(event.event_date), "MMM d, yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="content">Your Memory</FieldLabel>
              <Textarea
                id="content"
                placeholder="What made this event special? Share a moment, a feeling, or a funny story..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleAddMemory}
              disabled={!selectedEventId || !content.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Memory"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MemoryCard({ memory }: { memory: MemoryWithEvent }) {
  const event = memory.events
  const createdAt = parseISO(memory.created_at)

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Heart className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            {event && (
              <p className="truncate text-sm font-medium">{event.title}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {format(createdAt, "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-foreground">{memory.content}</p>
      </CardContent>
    </Card>
  )
}
