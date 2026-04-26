import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";

const SERVICES = [
  {
    name: "General Check-up & Clean",
    duration: "45 min",
    description: "Comprehensive oral examination, professional scale and clean, and personalised oral hygiene advice. Essential for maintaining a healthy smile.",
    icon: "🦷",
    popular: false,
  },
  {
    name: "Teeth Whitening",
    duration: "90 min",
    description: "Professional in-chair whitening using the latest LED technology. Achieve a dramatically brighter smile in a single appointment.",
    icon: "✨",
    popular: true,
  },
  {
    name: "Dental Filling",
    duration: "60 min",
    description: "Tooth-coloured composite fillings that restore structure and blend seamlessly with your natural teeth. No more metal glint.",
    icon: "🔬",
    popular: false,
  },
  {
    name: "Root Canal Treatment",
    duration: "120 min",
    description: "Pain-relieving treatment that saves an infected tooth. Our experienced endodontists use rotary instruments to make the process as comfortable as possible.",
    icon: "💊",
    popular: false,
  },
  {
    name: "Orthodontic Consultation",
    duration: "60 min",
    description: "Detailed assessment of your teeth alignment and bite. Discuss Invisalign, traditional braces, and retainers with our orthodontic specialist.",
    icon: "📐",
    popular: false,
  },
  {
    name: "Emergency Dental Care",
    duration: "30 min",
    description: "Same-day urgent appointments for toothache, broken teeth, lost fillings, and dental trauma. Call us and we'll see you today.",
    icon: "🚨",
    popular: false,
  },
];

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

        {/* Service cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.map(({ name, duration, description, icon, popular }) => (
            <article
              key={name}
              className="relative bg-[var(--color-canvas)] rounded-[var(--radius-card)] p-6 border border-[var(--color-border)] hover:border-[var(--color-cta)]/40 hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5 transition-all duration-[var(--duration-normal)] group"
            >
              {popular && (
                <span className="absolute top-4 right-4 inline-flex items-center rounded-[50px] bg-[var(--color-cta)] px-2.5 py-0.5 text-xs font-semibold text-white">
                  Popular
                </span>
              )}

              <div className="text-3xl mb-4" aria-hidden="true">{icon}</div>

              <div className="flex items-start gap-2 mb-3">
                <h3 className="text-base font-semibold text-[var(--color-text)] flex-1 leading-snug">{name}</h3>
              </div>

              <div className="flex items-center gap-1.5 mb-4">
                <Clock className="h-3.5 w-3.5 text-[var(--color-text-soft)]" />
                <span className="text-xs font-medium text-[var(--color-text-soft)]">{duration}</span>
              </div>

              <p className="text-sm text-[var(--color-text-soft)] leading-relaxed mb-5">
                {description}
              </p>

              <Link
                href="/book"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-cta)] hover:text-[#005a38] transition-colors group-hover:gap-2 duration-[var(--duration-fast)]"
              >
                Book this service
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </article>
          ))}
        </div>

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
