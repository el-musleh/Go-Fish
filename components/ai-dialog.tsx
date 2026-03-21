"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Fish, Send, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface AIDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEventCreated?: () => void
}

export function AIDialog({ open, onOpenChange, onEventCreated }: AIDialogProps) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const isLoading = status === "streaming" || status === "submitted"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Check for successful event creation in tool calls
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === "assistant" && lastMessage.parts) {
      for (const part of lastMessage.parts) {
        if (part.type === "tool-invocation" && part.toolInvocation?.state === "output-available") {
          const result = part.toolInvocation.output as { success?: boolean }
          if (result?.success) {
            onEventCreated?.()
          }
        }
      }
    }
  }, [messages, onEventCreated])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput("")
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setMessages([])
    }
    onOpenChange(isOpen)
  }

  const suggestedPrompts = [
    "Plan a game night with friends",
    "Organize a picnic in the park",
    "Set up a movie marathon",
    "Plan a dinner party",
  ]

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Fish className="h-4 w-4 text-primary-foreground" />
            </div>
            <span>Plan with Go Fish</span>
          </DialogTitle>
          <DialogDescription>
            {"Tell me about the event you'd like to plan and I'll help make it happen!"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea ref={scrollRef} className="flex-1 pr-4" style={{ maxHeight: "400px" }}>
          <div className="flex flex-col gap-4 py-4">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>Quick suggestions</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedPrompts.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        size="sm"
                        className="h-auto whitespace-normal py-2 text-left text-xs"
                        onClick={() => {
                          sendMessage({ text: prompt })
                        }}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                      <Fish className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-lg px-4 py-2.5 text-sm",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        return <span key={index}>{part.text}</span>
                      }
                      if (part.type === "tool-invocation") {
                        const toolInvocation = part.toolInvocation
                        if (toolInvocation?.state === "output-available") {
                          const result = toolInvocation.output as { success?: boolean; event?: { title: string } }
                          if (result?.success && result.event) {
                            return (
                              <div key={index} className="mt-2 rounded-md border bg-card p-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                                  <Sparkles className="h-4 w-4" />
                                  Event created: {result.event.title}
                                </div>
                              </div>
                            )
                          }
                        }
                        if (toolInvocation?.state === "input-streaming" || toolInvocation?.state === "input-available") {
                          return (
                            <div key={index} className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Creating your event...
                            </div>
                          )
                        }
                      }
                      return null
                    })}
                  </div>
                </div>
              ))
            )}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                  <Fish className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <form onSubmit={handleSubmit} className="flex gap-2 border-t pt-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your event idea..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
