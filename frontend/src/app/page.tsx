import Link from "next/link"
import MotionPreview from "@/components/landing/MotionPreview"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-4xl items-center justify-center px-6 py-10">
        <div className="w-full space-y-6 text-center">
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Find the moments that change everything.
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              Upload a clip and we split it into phases, flag key decision
              moments, and show the signals behind each change.
            </p>
          </div>
          <div className="space-y-2">
            <Button
              asChild
              size="lg"
              className="bg-[#3b82f6] text-white hover:bg-[#2563eb]"
            >
              <Link href="/app">Analyze a clip</Link>
            </Button>
            <p className="text-xs text-muted-foreground">No account required.</p>
          </div>
        </div>
      </div>
      <section id="how-it-works" className="mx-auto max-w-6xl px-6 pb-16">
        <div className="space-y-12">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              How it works
            </h2>
          </div>

          <div className="space-y-12">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground">01</p>
                <h3 className="text-xl font-semibold">Upload a clip</h3>
                <p className="text-sm text-muted-foreground sm:text-base">
                  Upload a gameplay recording to start an automatic analysis. No
                  setup required.
                </p>
              </div>
              <MotionPreview
                src="/previews/upload.mp4"
                alt="Uploading a gameplay clip for analysis"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
              <div className="order-2 lg:order-1">
                <MotionPreview
                  src="/previews/phases.mp4"
                  poster="/previews/phases.png"
                  alt="Intent timeline showing explore, execute, and outcome phases"
                />
              </div>
              <div className="order-1 space-y-3 lg:order-2">
                <p className="text-sm font-semibold text-muted-foreground">02</p>
                <h3 className="text-xl font-semibold">
                  See how intent changes over time
                </h3>
                <p className="text-sm text-muted-foreground sm:text-base">
                  We break the clip into phases like exploring, executing, and
                  resolving so you can see how the session unfolds.
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground">03</p>
                <h3 className="text-xl font-semibold">Spot key decision moments</h3>
                <p className="text-sm text-muted-foreground sm:text-base">
                  We flag moments where behavior shifts — hesitation,
                  commitment, or sudden changes in direction.
                </p>
              </div>
              <MotionPreview
                src="/previews/decision-moments.mp4"
                poster="/previews/decision-moments.png"
                alt="Decision moments being highlighted in the timeline"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
              <div className="order-2 lg:order-1">
                <MotionPreview
                  src="/previews/signal-analysis.mp4"
                  poster="/previews/signal-analysis.png"
                  alt="Signal analysis chart explaining why intent changes were detected"
                />
              </div>
              <div className="order-1 space-y-3 lg:order-2">
                <p className="text-sm font-semibold text-muted-foreground">04</p>
                <h3 className="text-xl font-semibold">
                  Understand why those moments happened
                </h3>
                <p className="text-sm text-muted-foreground sm:text-base">
                  Dive into the underlying signals to see what evidence led the
                  system to each conclusion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section id="features" className="mx-auto max-w-6xl px-6 pb-16">
        <div className="space-y-10">
          <div className="space-y-3 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              What the analysis actually shows
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Not just what happened in the clip — but when intent changed, why
              it changed, and how confident the system is.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="bg-card/40">
              <CardHeader className="space-y-2">
                <CardTitle>Clear intent phases</CardTitle>
                <p className="text-sm text-muted-foreground">
                  The system breaks the clip into exploration, execution, and
                  outcome — so you can see how the player’s focus evolves over
                  time.
                </p>
              </CardHeader>
              <CardContent>
                <img
                  src="/previews/phases.png"
                  alt="Intent timeline preview"
                  className="w-full rounded-lg bg-muted/40 object-cover"
                />
              </CardContent>
            </Card>

            <Card className="bg-card/40">
              <CardHeader className="space-y-2">
                <CardTitle>Key decision points</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Moments where intent shifts are flagged automatically, letting
                  you jump straight to hesitation, commitment, or strategy
                  changes.
                </p>
              </CardHeader>
              <CardContent>
                <img
                  src="/previews/decision-moments.png"
                  alt="Decision moment example"
                  className="w-full rounded-lg bg-muted/40 object-cover"
                />
              </CardContent>
            </Card>

            <Card className="bg-card/40">
              <CardHeader className="space-y-2">
                <CardTitle>Evidence, not guesses</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Every decision is backed by visible signals — how much the
                  scene changes, how unstable it is, and how focused the
                  activity appears.
                </p>
              </CardHeader>
              <CardContent>
                <img
                  src="/previews/signal-analysis.png"
                  alt="Signal analysis view"
                  className="w-full rounded-lg bg-muted/40 object-cover"
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground sm:text-base">
              Ready to see this on your own clip?
            </p>
            <Button
              asChild
              className="bg-[#3b82f6] text-white hover:bg-[#2563eb]"
            >
              <Link href="#features">Analyze a clip</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
