import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
  Output,
  tool,
} from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 30

const eventSchema = z.object({
  title: z.string().describe("The title of the event"),
  description: z.string().describe("A brief description of the event"),
  location: z.string().describe("Where the event will take place"),
  suggestedDate: z.string().describe("Suggested date in YYYY-MM-DD format"),
  suggestedTime: z.string().describe("Suggested time in HH:MM format"),
})

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Get user preferences to personalize suggestions
  let userPreferences = ""
  if (user) {
    const { data: preferences } = await supabase
      .from("preferences")
      .select("category, value")
      .eq("user_id", user.id)
    
    if (preferences && preferences.length > 0) {
      userPreferences = `User preferences: ${preferences.map(p => `${p.category}: ${p.value}`).join(", ")}`
    }
  }

  const result = streamText({
    model: "openai/gpt-5",
    system: `You are Go Fish, a friendly and enthusiastic social event coordinator assistant. Your personality is warm, encouraging, and creative. You help users plan memorable social events with friends.

When users describe what kind of event or activity they want, you should:
1. Ask clarifying questions about preferences (indoor/outdoor, time of day, budget, group size)
2. Suggest creative and fun event ideas that match their interests
3. Help them refine the details (location, date, time)
4. When they're ready, use the createEvent tool to create the event

${userPreferences}

Always be supportive and make planning feel fun, not like a chore. Use a conversational tone and occasionally add playful suggestions.`,
    messages: await convertToModelMessages(messages),
    tools: {
      createEvent: tool({
        description: "Create a new event when the user confirms they want to plan it. Only use this when the user has agreed to the event details.",
        inputSchema: eventSchema,
        execute: async (params) => {
          if (!user) {
            return { success: false, error: "User not authenticated" }
          }
          
          const { error } = await supabase.from("events").insert({
            user_id: user.id,
            title: params.title,
            description: params.description,
            location: params.location,
            event_date: params.suggestedDate,
            event_time: params.suggestedTime,
            status: "planning",
          })
          
          if (error) {
            return { success: false, error: error.message }
          }
          
          return { success: true, event: params }
        },
      }),
    },
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
