import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-canvas)] flex flex-col">
      {/* Minimal auth header */}
      <header className="flex items-center justify-between px-4 sm:px-6 lg:px-10 py-4">
        <Link
          href="/"
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
          <span className="text-sm font-semibold tracking-tight text-[var(--color-feature)]">
            BrightSmile <span className="text-[var(--color-cta)]">Dental</span>
          </span>
        </Link>
        <Link
          href="/"
          className="text-sm text-[var(--color-text-soft)] hover:text-[var(--color-cta)] transition-colors"
        >
          ← Back to home
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </main>

      <footer className="py-6 text-center text-xs text-[var(--color-text-soft)]">
        © {new Date().getFullYear()} BrightSmile Dental. All rights reserved.
      </footer>
    </div>
  );
}
