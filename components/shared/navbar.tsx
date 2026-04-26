import Link from "next/link";
import { auth } from "@/lib/auth";
import { MobileNav } from "./mobile-nav";

const NAV_LINKS = [
  { href: "/#about",    label: "About" },
  { href: "/#services", label: "Services" },
  { href: "/#dentists", label: "Our Team" },
  { href: "/#contact",  label: "Contact" },
];

export async function Navbar() {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const role = session?.user?.role ?? null;
  const dashboardHref = role === "ADMIN" || role === "DENTIST" ? "/admin" : "/dashboard";

  return (
    <header className="sticky top-0 z-30 bg-[var(--color-surface)] shadow-[var(--shadow-nav)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] rounded"
          aria-label="BrightSmile Dental — home"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-cta)]">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" aria-hidden="true">
              <path
                d="M12 2C7.58 2 4 5.58 4 10c0 2.76 1.4 5.2 3.54 6.68L9 21h6l1.46-4.32C18.6 15.2 20 12.76 20 10c0-4.42-3.58-8-8-8z"
                fill="currentColor"
                opacity="0.9"
              />
              <path
                d="M9.5 10.5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="text-base font-semibold tracking-tight text-[var(--color-feature)]">
            BrightSmile <span className="text-[var(--color-cta)]">Dental</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-[var(--color-text-soft)] hover:text-[var(--color-cta)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] rounded"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA buttons */}
        <div className="hidden md:flex items-center gap-3">
          {isLoggedIn ? (
            <Link
              href={dashboardHref}
              className="inline-flex h-9 items-center justify-center rounded-[50px] bg-[var(--color-cta)] px-5 text-sm font-semibold text-white hover:bg-[#005a38] transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] focus-visible:ring-offset-2"
            >
              My Account
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-9 items-center justify-center rounded-[50px] border border-[var(--color-text)] px-5 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-ceramic)] transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] focus-visible:ring-offset-2"
              >
                Sign In
              </Link>
              <Link
                href="/book"
                className="inline-flex h-9 items-center justify-center rounded-[50px] bg-[var(--color-cta)] px-5 text-sm font-semibold text-white hover:bg-[#005a38] transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] focus-visible:ring-offset-2"
              >
                Book Appointment
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <MobileNav isLoggedIn={isLoggedIn} role={role} />
      </div>
    </header>
  );
}
