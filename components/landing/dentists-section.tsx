import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";

import { listActiveDentists } from "@/lib/catalogue";
import { dentistCardStyle, initialsOf } from "@/lib/marketing";
import { Skeleton } from "@/components/ui/skeleton";

const CLINIC_PHONE_DISPLAY = "(02) 9876 5432";
const CLINIC_PHONE_HREF = "tel:+61298765432";

function DentistsGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      aria-hidden="true"
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden"
        >
          <Skeleton className="h-48 w-full rounded-none" />
          <div className="p-6">
            <Skeleton className="h-5 w-40 mb-2" />
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-3 w-5/6 mb-5" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Same reasoning as the services grid: degrade to the phone, never 500. */
function DentistsUnavailable({ heading }: { heading: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] py-16 px-6 text-center"
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
        and our reception team will match you with the right dentist.
      </p>
    </div>
  );
}

async function DentistsGrid() {
  let dentists;
  try {
    dentists = await listActiveDentists();
  } catch {
    return <DentistsUnavailable heading="Couldn't load our team" />;
  }

  if (dentists.length === 0) {
    return <DentistsUnavailable heading="Our team page is being updated" />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {dentists.map(
        (
          { id, firstName, lastName, specialisation, bio, profilePhotoUrl },
          index,
        ) => {
          const style = dentistCardStyle(index);
          const fullName = `Dr. ${firstName} ${lastName}`;

          return (
            <article
              key={id}
              className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden group hover:shadow-[var(--shadow-lg)] hover:-translate-y-1 transition-all duration-[var(--duration-normal)]"
            >
              {/* Photo when Supabase Storage has one, initials medallion otherwise. */}
              <div
                className={`relative h-48 ${style.header} flex items-center justify-center`}
              >
                {profilePhotoUrl ? (
                  <Image
                    src={profilePhotoUrl}
                    alt={`Portrait of ${fullName}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div
                    className={`h-24 w-24 rounded-full border-2 flex items-center justify-center text-2xl font-bold backdrop-blur-sm ${style.medallion} ${style.initials}`}
                    aria-hidden="true"
                  >
                    {initialsOf(firstName, lastName)}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-[var(--color-text)] mb-0.5">
                  {fullName}
                </h3>
                <p className="text-sm font-medium text-[var(--color-cta)] mb-4">
                  {specialisation}
                </p>
                {bio && (
                  <p className="text-sm text-[var(--color-text-soft)] leading-relaxed">
                    {bio}
                  </p>
                )}

                <Link
                  href="/book"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-cta)] hover:text-[#005a38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] focus-visible:ring-offset-2 rounded-sm transition-colors group-hover:gap-2.5 duration-[var(--duration-fast)]"
                >
                  Book with Dr. {lastName}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          );
        },
      )}
    </div>
  );
}

export function DentistsSection() {
  return (
    <section
      id="dentists"
      className="py-24 bg-[var(--color-ceramic)]"
      aria-label="Our dental team"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-16">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--color-cta)] mb-3">
              Our Team
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-feature)] leading-tight tracking-tight">
              Experienced dentists who genuinely care
            </h2>
          </div>
          <Link
            href="/book"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-cta)] hover:text-[#005a38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] focus-visible:ring-offset-2 rounded-sm transition-colors shrink-0"
          >
            Book with your preferred dentist
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Dentist cards — chrome first, the grid streams in behind it. */}
        <Suspense fallback={<DentistsGridSkeleton />}>
          <DentistsGrid />
        </Suspense>
      </div>
    </section>
  );
}
