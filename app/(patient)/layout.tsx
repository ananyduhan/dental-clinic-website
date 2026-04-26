import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  PlusCircle,
  User,
  LogOut,
} from "lucide-react";
import { PatientMobileNav } from "@/components/shared/patient-mobile-nav";

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/book",         label: "Book Now",     icon: PlusCircle },
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/profile",      label: "Profile",      icon: User },
];

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN" || session.user.role === "DENTIST") redirect("/admin");

  const firstName = session.user.firstName ?? "Patient";

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[var(--color-surface)] shadow-[var(--shadow-nav)]">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-14">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] rounded"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-cta)]">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" aria-hidden="true">
                <path
                  d="M12 2C7.58 2 4 5.58 4 10c0 2.76 1.4 5.2 3.54 6.68L9 21h6l1.46-4.32C18.6 15.2 20 12.76 20 10c0-4.42-3.58-8-8-8z"
                  fill="currentColor"
                  opacity="0.9"
                />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight text-[var(--color-feature)] hidden sm:block">
              BrightSmile Dental
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-[var(--color-text-soft)]">
              Welcome, <span className="font-medium text-[var(--color-text)]">{firstName}</span>
            </span>
            <PatientMobileNav />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex flex-col w-56 bg-[var(--color-surface)] border-r border-[var(--color-border)] pt-8 pb-6 px-3">
          <nav aria-label="Patient navigation">
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--color-text-soft)] hover:text-[var(--color-cta)] hover:bg-[var(--color-canvas)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)]"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-auto pt-4 border-t border-[var(--color-border)]">
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--color-text-soft)] hover:text-[var(--color-error)] hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign Out
              </button>
            </form>
          </div>
        </aside>

        {/* Mobile bottom tab bar */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex lg:hidden"
          aria-label="Patient navigation"
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[var(--color-text-soft)] hover:text-[var(--color-cta)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)]"
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 pb-24 lg:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
