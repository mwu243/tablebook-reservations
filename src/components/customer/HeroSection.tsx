import { CalendarCheck } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="hero-gradient py-16 md:py-24">
      <div className="container text-center">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground">
            <CalendarCheck className="h-4 w-4 text-accent" />
            Book your experience
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Reserve Your Perfect Table
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl">
            Discover availability and secure your spot in seconds. Fine dining, effortlessly reserved.
          </p>
        </div>
      </div>
    </section>
  );
}
