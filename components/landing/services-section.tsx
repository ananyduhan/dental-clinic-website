import Link from "next/link";
import { Suspense } from "react";
import { AlertCircle, ArrowRight, Clock } from "lucide-react";

import { listActiveServices } from "@/lib/catalogue";
import { serviceMarketing } from "@/lib/marketing";
import { Skeleton } from "@/components/ui/skeleton";

const CLINIC_PHONE_DISPLAY = "(02) 9876 5432";
const CLINIC_PHONE_HREF = "tel:+61298765432";

function ServicesGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
      aria-hidden="true"
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="bg-[var(--color-canvas)] rounded-[var(--radius-card)] p-6 border border-[var(--color-border)]"
        >
          <Skeleton className="h-8 w-8 rounded-[var(--radius-card)] mb-4" />
          <Skeleton className="h-5 w-40 mb-3" />
          <Skeleton className="h-3 w-20 mb-4" />
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-4/5 mb-5" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

/**
 * A marketing page that renders an apology beats one that 500s, so a catalogue
 * read that fails degrades to the phone number rather than taking the landing
 * page down with it.
 */
function ServicesUnavailable({ heading }: { heading: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-canvas)] py-16 px-6 text-center"
    >
      <AlertCircle className="h-7 w-7 text-[var(--color-error)] mb-3" />
      <p className="text-base font-semibold text-[var(--color-text)] mb-2">
        {heading}
      </p>
      <p className="text-sm text-[var(--color-text-soft)] max-w-sm">
        Give us a call on{" "}
        <a
          href={CLINIC_PHONE_HREF}
          className="font-semibold text-[var(--color-cta)] hover:text-[#005a38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] focus-visible:ring-offset-2 rounded-sm transition-colors"
        >
          {CLINIC_PHONE_DISPLAY}
        </a>{" "}
        and we&apos;ll book you in over the phone.
      </p>
    </div>
  );
}

async function ServicesGrid() {
  let services;
  try {
    services = await listActiveServices();
  } catch {
    return <ServicesUnavailable heading="Couldn't load our services" />;
  }

  if (services.length === 0) {
    return <ServicesUnavailable heading="Our service list is being updated" />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {services.map(({ id, name, description, durationMinutes }) => {
        const { icon, isPopular } = serviceMarketing(name);

        return (
          <article
            key={id}
            className="relative bg-[var(--color-canvas)] rounded-[var(--radius-card)] p-6 border border-[var(--color-border)] hover:border-[var(--color-cta)]/40 hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5 transition-all duration-[var(--duration-normal)] group"
          >
            {isPopular && (
              <span className="absolute top-4 right-4 inline-flex items-center rounded-[50px] bg-[var(--color-cta)] px-2.5 py-0.5 text-xs font-semibold text-white">
                Popular
              </span>
            )}

            <div className="text-3xl mb-4" aria-hidden="true">
              {icon}
            </div>

            <div className="flex items-start gap-2 mb-3">
              <h3 className="text-base font-semibold text-[var(--color-text)] flex-1 leading-snug">
                {name}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 mb-4">
              <Clock className="h-3.5 w-3.5 text-[var(--color-text-soft)]" />
              <span className="text-xs font-medium text-[var(--color-text-soft)]">
                {durationMinutes} min
              </span>
            </div>

            <p className="text-sm text-[var(--color-text-soft)] leading-relaxed mb-5">
              {description}
            </p>

            <Link
              href="/book"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-cta)] hover:text-[#005a38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] focus-visible:ring-offset-2 rounded-sm transition-colors group-hover:gap-2 duration-[var(--duration-fast)]"
            >
              Book {name}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </article>
        );
      })}
    </div>
  );
}

export function ServicesSection() {
  return (
    <section
      id="services"
      className="py-24 bg-[var(--color-surface)]"
      aria-label="Our dental services"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        {/* Header */}
        <div className="max-w-2xl mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--color-cta)] mb-3">
            What We Offer
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-feature)] leading-tight tracking-tight mb-4">
            Comprehensive dental services under one roof
          </h2>
          <p className="text-base text-[var(--color-text-soft)] leading-relaxed">
            From preventive care to advanced cosmetic procedures, our full-service clinic handles everything your smile needs — for the whole family.
          </p>
        </div>

        {/* Service cards — the section chrome renders immediately, the grid streams in. */}
        <Suspense fallback={<ServicesGridSkeleton />}>
          <ServicesGrid />
        </Suspense>

        {/* CTA band */}
        <div className="mt-16 rounded-[var(--radius-card)] bg-[var(--color-feature)] px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Not sure what you need?</h3>
            <p className="text-sm text-[var(--color-text-invert-soft)]">
              Start with a general check-up and our dentists will recommend a personalised treatment plan.
            </p>
          </div>
          <Link
            href="/book"
            className="shrink-0 inline-flex items-center justify-center gap-2 h-11 px-8 rounded-[50px] bg-white text-[var(--color-cta)] font-semibold text-sm hover:bg-white/90 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Book a Check-up
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
