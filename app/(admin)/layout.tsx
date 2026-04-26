import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Stethoscope,
  Layers,
  Download,
  LogOut,
  Settings,
} from "lucide-react";
import type { Role } from "@prisma/client";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin",              label: "Dashboard",   icon: LayoutDashboard },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/admin/dentists",     label: "Dentists",    icon: Stethoscope,   adminOnly: true },
  { href: "/admin/services",     label: "Services",    icon: Layers,        adminOnly: true },
  { href: "/admin/patients",     label: "Patients",    icon: Users },
  { href: "/admin/export",       label: "Export",      icon: Download,      adminOnly: true },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role as Role;
  if (role === "PATIENT") redirect("/dashboard");

  const isAdmin = role === "ADMIN";
  const visibleItems = isAdmin ? NAV_ITEMS : NAV_ITEMS.filter((item) => !item.adminOnly);

  const firstName = session.user.firstName ?? "Admin";

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[var(--color-feature)] shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-14">
          <Link
            href="/admin"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
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
            <span className="text-sm font-semibold tracking-tight text-white hidden sm:block">
              BrightSmile{" "}
              <span className="text-[var(--color-green-light)]">Admin</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-[var(--color-text-invert-soft)]">
              {firstName} &middot;{" "}
              <span className="text-[var(--color-green-light)] font-medium capitalize">
                {role.toLowerCase()}
              </span>
            </span>
            <Link
              href="/"
              className="hidden sm:block text-xs text-[var(--color-text-invert-soft)] hover:text-white transition-colors"
            >
              ← Public site
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex flex-col w-56 bg-[var(--color-surface)] border-r border-[var(--color-border)] pt-6 pb-6 px-3">
          <nav aria-label="Admin navigation">
            <ul className="flex flex-col gap-0.5">
              {visibleItems.map(({ href, label, icon: Icon }) => (
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

          <div className="mt-auto pt-4 border-t border-[var(--color-border)] flex flex-col gap-0.5">
            <Link
              href="/admin/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--color-text-soft)] hover:text-[var(--color-cta)] hover:bg-[var(--color-canvas)] transition-colors"
            >
              <Settings className="h-4 w-4 shrink-0" />
              Settings
            </Link>
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
          className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex lg:hidden overflow-x-auto"
          aria-label="Admin navigation"
        >
          {visibleItems.slice(0, 5).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 min-w-[60px] text-[var(--color-text-soft)] hover:text-[var(--color-cta)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)]"
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
