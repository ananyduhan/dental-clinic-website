import Link from "next/link";
import { MapPin, Phone, Mail, MessageSquare } from "lucide-react";

export function ContactSection() {
  return (
    <section
      id="contact"
      className="py-24 bg-[var(--color-canvas)]"
      aria-label="Contact us"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="max-w-2xl mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--color-cta)] mb-3">
            Get in Touch
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-feature)] leading-tight tracking-tight mb-4">
            We&apos;re here when you need us
          </h2>
          <p className="text-base text-[var(--color-text-soft)] leading-relaxed">
            Have a question about treatment, pricing, or insurance? Our friendly team is ready to help — call, email, or drop in.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact details */}
          <div className="flex flex-col gap-6">
            <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6 flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-[var(--color-green-light)] flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-[var(--color-cta)]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-text)] mb-1">Find Us</h3>
                <p className="text-sm text-[var(--color-text-soft)] leading-relaxed">
                  123 Pitt Street<br />
                  Sydney NSW 2000<br />
                  <span className="text-xs">(near Town Hall Station)</span>
                </p>
              </div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6 flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-[var(--color-green-light)] flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 text-[var(--color-cta)]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-text)] mb-1">Call Us</h3>
                <a
                  href="tel:+61298765432"
                  className="text-sm text-[var(--color-cta)] font-medium hover:text-[#005a38] transition-colors"
                >
                  (02) 9876 5432
                </a>
                <p className="text-xs text-[var(--color-text-soft)] mt-1">
                  Mon–Fri 8am–6pm · Sat 9am–3pm
                </p>
              </div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6 flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-[var(--color-green-light)] flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-[var(--color-cta)]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-text)] mb-1">Email Us</h3>
                <a
                  href="mailto:hello@brightsmile.com.au"
                  className="text-sm text-[var(--color-cta)] font-medium hover:text-[#005a38] transition-colors"
                >
                  hello@brightsmile.com.au
                </a>
                <p className="text-xs text-[var(--color-text-soft)] mt-1">
                  We respond within 2 business hours
                </p>
              </div>
            </div>

            <Link
              href="/book"
              className="flex items-center justify-center gap-2 h-12 rounded-[50px] bg-[var(--color-cta)] text-white font-semibold text-sm hover:bg-[#005a38] transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] focus-visible:ring-offset-2"
            >
              <MessageSquare className="h-4 w-4" />
              Book an Appointment Online
            </Link>
          </div>

          {/* Map placeholder */}
          <div className="rounded-[var(--radius-card)] overflow-hidden shadow-[var(--shadow-card)] bg-[var(--color-ceramic)] min-h-[400px] flex flex-col">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3312.8667256374!2d151.2052!3d-33.8688!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6b12ae3f3b3b3b3b%3A0x3b3b3b3b3b3b3b3b!2sPitt+St%2C+Sydney+NSW+2000!5e0!3m2!1sen!2sau!4v1234567890"
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: "400px", flex: 1 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="BrightSmile Dental location map"
              aria-label="Map showing BrightSmile Dental at 123 Pitt Street, Sydney"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
