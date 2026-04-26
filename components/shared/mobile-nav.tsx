"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/#about",    label: "About" },
  { href: "/#services", label: "Services" },
  { href: "/#dentists", label: "Our Team" },
  { href: "/#contact",  label: "Contact" },
];

interface MobileNavProps {
  isLoggedIn: boolean;
  role?: string | null;
}

export function MobileNav({ isLoggedIn, role }: MobileNavProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-full p-2 text-[var(--color-text)] hover:bg-[var(--color-ceramic)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] md:hidden"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-72 bg-[var(--color-surface)] shadow-[var(--shadow-lg)]",
          "flex flex-col",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
          <span className="font-semibold text-[var(--color-feature)] tracking-tight">
            BrightSmile Dental
          </span>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full p-1.5 hover:bg-[var(--color-ceramic)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)]"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center px-3 py-3 rounded-lg text-base font-medium text-[var(--color-text)] hover:bg-[var(--color-ceramic)] hover:text-[var(--color-cta)] transition-colors"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6 pt-6 border-t border-[var(--color-border)] flex flex-col gap-3">
            {isLoggedIn ? (
              <>
                <Link
                  href={role === "ADMIN" || role === "DENTIST" ? "/admin" : "/dashboard"}
                  className="flex items-center justify-center h-10 px-6 rounded-[50px] bg-[var(--color-cta)] text-white font-semibold text-sm hover:bg-[#005a38] transition-colors active:scale-95"
                >
                  My Account
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="flex items-center justify-center h-10 px-6 rounded-[50px] border border-[var(--color-text)] text-[var(--color-text)] font-semibold text-sm hover:bg-[var(--color-ceramic)] transition-colors active:scale-95"
                >
                  Sign In
                </Link>
                <Link
                  href="/book"
                  className="flex items-center justify-center h-10 px-6 rounded-[50px] bg-[var(--color-cta)] text-white font-semibold text-sm hover:bg-[#005a38] transition-colors active:scale-95"
                >
                  Book Appointment
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
