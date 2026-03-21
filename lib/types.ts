export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  user_id: string
  title: string
  description: string | null
  location: string | null
  event_date: string
  event_time: string | null
  status: "planning" | "confirmed" | "completed" | "cancelled"
  created_at: string
  updated_at: string
}

export interface Memory {
  id: string
  event_id: string
  user_id: string
  content: string
  image_url: string | null
  created_at: string
}

export interface Preference {
  id: string
  user_id: string
  category: string
  value: string
  created_at: string
}

export interface AIEventSuggestion {
  title: string
  description: string
  location: string
  suggestedDate: string
  suggestedTime: string
}
