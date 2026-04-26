import Link from "next/link";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

const FOOTER_LINKS = {
  services: [
    { label: "General Check-up", href: "/#services" },
    { label: "Teeth Whitening",  href: "/#services" },
    { label: "Orthodontics",     href: "/#services" },
    { label: "Dental Fillings",  href: "/#services" },
    { label: "Emergency Care",   href: "/#services" },
  ],
  company: [
    { label: "About Us",  href: "/#about" },
    { label: "Our Team",  href: "/#dentists" },
    { label: "Contact",   href: "/#contact" },
    { label: "Book Online", href: "/book" },
  ],
  patient: [
    { label: "Patient Portal",  href: "/dashboard" },
    { label: "My Appointments", href: "/appointments" },
    { label: "Register",        href: "/register" },
    { label: "Login",           href: "/login" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-[var(--color-feature)] text-[var(--color-text-invert)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand & contact */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-cta)]">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" aria-hidden="true">
                  <path
                    d="M12 2C7.58 2 4 5.58 4 10c0 2.76 1.4 5.2 3.54 6.68L9 21h6l1.46-4.32C18.6 15.2 20 12.76 20 10c0-4.42-3.58-8-8-8z"
                    fill="currentColor"
                    opacity="0.9"
                  />
                </svg>
              </div>
              <span className="text-base font-semibold tracking-tight text-white">
                BrightSmile Dental
              </span>
            </Link>
            <p className="text-sm text-[var(--color-text-invert-soft)] leading-relaxed mb-6">
              Professional dental care in the heart of Sydney. Committed to your healthiest, brightest smile.
            </p>

            <ul className="flex flex-col gap-3">
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-[var(--color-cta)] shrink-0 mt-0.5" />
                <span className="text-sm text-[var(--color-text-invert-soft)]">
                  123 Pitt Street, Sydney NSW 2000
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-[var(--color-cta)] shrink-0" />
                <a
                  href="tel:+61298765432"
                  className="text-sm text-[var(--color-text-invert-soft)] hover:text-white transition-colors"
                >
                  (02) 9876 5432
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-[var(--color-cta)] shrink-0" />
                <a
                  href="mailto:hello@brightsmile.com.au"
                  className="text-sm text-[var(--color-text-invert-soft)] hover:text-white transition-colors"
                >
                  hello@brightsmile.com.au
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-[var(--color-cta)] shrink-0 mt-0.5" />
                <span className="text-sm text-[var(--color-text-invert-soft)]">
                  Mon–Fri: 8am–6pm<br />
                  Saturday: 9am–3pm
                </span>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-cta)] mb-4">
              Services
            </h3>
            <ul className="flex flex-col gap-2.5">
              {FOOTER_LINKS.services.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-[var(--color-text-invert-soft)] hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-cta)] mb-4">
              Clinic
            </h3>
            <ul className="flex flex-col gap-2.5">
              {FOOTER_LINKS.company.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-[var(--color-text-invert-soft)] hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Patient */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-cta)] mb-4">
              Patients
            </h3>
            <ul className="flex flex-col gap-2.5">
              {FOOTER_LINKS.patient.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-[var(--color-text-invert-soft)] hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-text-invert-soft)]">
            © {new Date().getFullYear()} BrightSmile Dental. All rights reserved.
          </p>
          <div className="flex gap-4">
            <Link href="/privacy" className="text-xs text-[var(--color-text-invert-soft)] hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs text-[var(--color-text-invert-soft)] hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
