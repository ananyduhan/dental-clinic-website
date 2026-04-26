import Link from "next/link";
import { ArrowRight } from "lucide-react";

const DENTISTS = [
  {
    name: "Dr. Sarah Chen",
    specialisation: "General & Preventive Dentistry",
    bio: "With over 12 years of experience, Dr. Chen specialises in making every patient feel at ease. She's passionate about preventive care and oral health education.",
    initials: "SC",
    color: "from-[#d4e9e2] to-[#a8d5c5]",
    textColor: "text-[var(--color-feature)]",
    qualifications: "BDS (Hons) · FRACDS",
  },
  {
    name: "Dr. James Patel",
    specialisation: "Orthodontics & Smile Design",
    bio: "Dr. Patel combines the latest Invisalign technology with a meticulous eye for aesthetics. He's helped hundreds of patients achieve their dream smiles.",
    initials: "JP",
    color: "from-[#1E3932] to-[#2b5148]",
    textColor: "text-white",
    qualifications: "BDSc · MOrth · MRACDS",
  },
  {
    name: "Dr. Emily Walker",
    specialisation: "Cosmetic & Restorative Dentistry",
    bio: "A cosmetic dentistry specialist with a genuine love for artistry. Dr. Walker transforms smiles through porcelain veneers, whitening, and full-mouth rehabilitation.",
    initials: "EW",
    color: "from-[#006241] to-[#00754A]",
    textColor: "text-white",
    qualifications: "BDS · MFDS · MDentSci",
  },
];

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
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-cta)] hover:text-[#005a38] transition-colors shrink-0"
          >
            Book with your preferred dentist
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Dentist cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DENTISTS.map(({ name, specialisation, bio, initials, color, textColor, qualifications }) => (
            <article
              key={name}
              className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden group hover:shadow-[var(--shadow-lg)] hover:-translate-y-1 transition-all duration-[var(--duration-normal)]"
            >
              {/* Avatar area */}
              <div className={`h-48 bg-gradient-to-br ${color} flex items-center justify-center`}>
                <div className={`h-24 w-24 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-2xl font-bold ${textColor} backdrop-blur-sm`}>
                  {initials}
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-[var(--color-text)] mb-0.5">{name}</h3>
                <p className="text-sm font-medium text-[var(--color-cta)] mb-2">{specialisation}</p>
                <p className="text-xs text-[var(--color-text-soft)] font-mono mb-4">{qualifications}</p>
                <p className="text-sm text-[var(--color-text-soft)] leading-relaxed">{bio}</p>

                <Link
                  href="/book"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-cta)] hover:text-[#005a38] transition-colors group-hover:gap-2.5 duration-[var(--duration-fast)]"
                >
                  Book with {name.split(" ")[1]}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
