import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Fish, Calendar, Users, Heart, Sparkles } from "lucide-react"

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect("/home")
  }

  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg">
          <Fish className="h-10 w-10 text-primary-foreground" />
        </div>
        
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          <span className="text-balance">Plan memorable moments</span>
          <br />
          <span className="text-primary">with friends</span>
        </h1>
        
        <p className="mx-auto mb-8 max-w-lg text-lg text-muted-foreground text-balance">
          Go Fish is your AI-powered social event coordinator. Plan game nights, 
          picnics, dinner parties, and more with ease.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="gap-2">
            <Link href="/auth/sign-up">
              <Sparkles className="h-4 w-4" />
              Get Started
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/login">Sign In</Link>
          </Button>
        </div>
      </div>

      {/* Features Section */}
      <section className="border-t bg-card px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-2xl font-bold sm:text-3xl">
            Everything you need to plan the perfect event
          </h2>
          
          <div className="grid gap-8 sm:grid-cols-3">
            <FeatureCard
              icon={Sparkles}
              title="AI-Powered Planning"
              description="Describe your ideal event and let Go Fish suggest creative ideas tailored to you."
            />
            <FeatureCard
              icon={Calendar}
              title="Timeline View"
              description="See all your upcoming and past events at a glance with our visual timeline."
            />
            <FeatureCard
              icon={Heart}
              title="Capture Memories"
              description="Save special moments from each event to look back on fondly."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
        <p>Go Fish - Your social event coordinator</p>
      </footer>
    </main>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
