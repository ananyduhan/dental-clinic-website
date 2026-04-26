import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";

export function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-[var(--color-feature)] min-h-[92vh] flex items-center"
      aria-label="Welcome to BrightSmile Dental"
    >
      {/* Background decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-[var(--color-cta)]/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-[500px] w-[500px] rounded-full bg-[var(--color-uplift)]/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-[var(--color-cta)]/5 blur-2xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Text content */}
        <div className="text-center lg:text-left animate-fade-in">
          {/* Social proof badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 mb-8">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-sm text-white/90 font-medium">4.9 · Rated #1 in Sydney CBD</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight text-balance mb-6">
            Your Healthiest,{" "}
            <span className="text-[var(--color-green-light)]">Brightest</span>{" "}
            Smile Starts Here
          </h1>

          <p className="text-lg text-[var(--color-text-invert-soft)] leading-relaxed mb-10 max-w-xl mx-auto lg:mx-0">
            Expert dental care in the heart of Sydney. From routine check-ups to complete smile makeovers — we make every visit comfortable, efficient, and worth smiling about.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link
              href="/book"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-[50px] bg-[var(--color-cta)] text-white font-semibold text-base hover:bg-[#005a38] transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-feature)]"
            >
              Book Appointment
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/#dentists"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-[50px] bg-transparent text-white border border-white/60 font-semibold text-base hover:bg-white/10 transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-feature)]"
            >
              Meet Our Dentists
            </Link>
          </div>

          {/* Quick stats */}
          <div className="mt-12 grid grid-cols-3 gap-6 max-w-sm mx-auto lg:mx-0">
            {[
              { value: "15+", label: "Years of care" },
              { value: "8,000+", label: "Happy patients" },
              { value: "97%", label: "Satisfaction rate" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center lg:text-left">
                <p className="text-2xl font-bold text-[var(--color-green-light)]">{value}</p>
                <p className="text-xs text-[var(--color-text-invert-soft)] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right column — illustration / placeholder card */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative">
            {/* Main card */}
            <div className="w-80 h-96 rounded-[var(--radius-card)] bg-gradient-to-br from-[var(--color-cta)]/30 to-[var(--color-uplift)]/30 border border-white/10 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-8">
              <div className="h-24 w-24 rounded-full bg-[var(--color-cta)]/20 border-2 border-[var(--color-cta)]/40 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12 text-[var(--color-green-light)]" aria-hidden="true">
                  <path d="M12 2C7.58 2 4 5.58 4 10c0 2.76 1.4 5.2 3.54 6.68L9 21h6l1.46-4.32C18.6 15.2 20 12.76 20 10c0-4.42-3.58-8-8-8z" fill="currentColor" opacity="0.6" />
                  <path d="M9.5 10.5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-white font-semibold text-lg">BrightSmile Dental</p>
                <p className="text-[var(--color-text-invert-soft)] text-sm mt-1">Sydney CBD</p>
              </div>
              <div className="w-full pt-4 border-t border-white/10 flex flex-col gap-2">
                {["Mon–Fri: 8am – 6pm", "Saturday: 9am – 3pm", "Emergency: 7 days"].map((h) => (
                  <p key={h} className="text-xs text-[var(--color-text-invert-soft)] text-center">{h}</p>
                ))}
              </div>
            </div>

            {/* Floating appointment badge */}
            <div className="absolute -bottom-6 -left-8 bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-4 flex items-center gap-3 w-56">
              <div className="h-10 w-10 rounded-full bg-[var(--color-valid-tint)] flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-[var(--color-cta)]" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--color-text)]">Appointment Confirmed</p>
                <p className="text-xs text-[var(--color-text-soft)]">Today at 2:30 PM</p>
              </div>
            </div>

            {/* Floating review badge */}
            <div className="absolute -top-4 -right-8 bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-3 w-48">
              <div className="flex items-center gap-1 mb-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-xs text-[var(--color-text)] font-medium">&ldquo;Painless and professional!&rdquo;</p>
              <p className="text-xs text-[var(--color-text-soft)] mt-0.5">— Sarah M., patient</p>
            </div>
          </div>
        </div>
      </div>

      {/* Wave divider */}
      <div className="absolute bottom-0 left-0 right-0" aria-hidden="true">
        <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path d="M0 48H1440V20C1200 44 960 8 720 20C480 32 240 4 0 20V48Z" fill="var(--color-canvas)" />
        </svg>
      </div>
    </section>
  );
}
