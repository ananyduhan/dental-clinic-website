import { Shield, Heart, Clock, Award } from "lucide-react";

const VALUES = [
  {
    icon: Shield,
    title: "Safe & Gentle",
    description: "We prioritise your comfort with minimally invasive techniques and gentle handling at every step.",
  },
  {
    icon: Heart,
    title: "Patient-First Care",
    description: "Every treatment plan is tailored to your unique needs, goals, and budget — never one-size-fits-all.",
  },
  {
    icon: Clock,
    title: "On Time, Every Time",
    description: "We respect your schedule. Our streamlined booking system minimises waiting room time.",
  },
  {
    icon: Award,
    title: "Clinically Excellent",
    description: "All our dentists hold advanced qualifications and pursue ongoing professional development.",
  },
];

const HOURS = [
  { day: "Monday", time: "8:00 AM – 6:00 PM" },
  { day: "Tuesday", time: "8:00 AM – 6:00 PM" },
  { day: "Wednesday", time: "8:00 AM – 6:00 PM" },
  { day: "Thursday", time: "8:00 AM – 6:00 PM" },
  { day: "Friday", time: "8:00 AM – 5:00 PM" },
  { day: "Saturday", time: "9:00 AM – 3:00 PM" },
  { day: "Sunday", time: "Closed" },
];

export function AboutSection() {
  return (
    <section
      id="about"
      className="py-24 bg-[var(--color-canvas)]"
      aria-label="About BrightSmile Dental"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        {/* Section header */}
        <div className="max-w-2xl mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--color-cta)] mb-3">
            Who We Are
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-feature)] leading-tight tracking-tight mb-4">
            Dental care built on trust, skill, and genuine compassion
          </h2>
          <p className="text-base text-[var(--color-text-soft)] leading-relaxed">
            Founded in 2009, BrightSmile Dental has been Sydney&apos;s trusted partner for healthy smiles. Our team of experienced clinicians combines cutting-edge technology with a warm, unhurried approach that puts patients at ease.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Values grid */}
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-8">Our values</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {VALUES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5 hover:shadow-[var(--shadow-lg)] transition-shadow duration-[var(--duration-normal)]"
                >
                  <div className="h-10 w-10 rounded-full bg-[var(--color-green-light)] flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5 text-[var(--color-cta)]" />
                  </div>
                  <h4 className="text-sm font-semibold text-[var(--color-text)] mb-1.5">{title}</h4>
                  <p className="text-sm text-[var(--color-text-soft)] leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Opening hours */}
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-8">Opening hours</h3>
            <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
              <table className="w-full text-sm" aria-label="Opening hours">
                <caption className="sr-only">Clinic opening hours</caption>
                <tbody>
                  {HOURS.map(({ day, time }, i) => (
                    <tr
                      key={day}
                      className={`flex items-center justify-between px-5 py-3.5 ${
                        i < HOURS.length - 1 ? "border-b border-[var(--color-border)]" : ""
                      }`}
                    >
                      <td className="font-medium text-[var(--color-text)]">{day}</td>
                      <td
                        className={
                          time === "Closed"
                            ? "text-[var(--color-text-soft)]"
                            : "text-[var(--color-cta)] font-medium"
                        }
                      >
                        {time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="px-5 py-4 bg-[var(--color-feature)] text-center">
                <p className="text-sm text-[var(--color-text-invert-soft)]">
                  Emergency appointments available 7 days —{" "}
                  <a
                    href="tel:+61298765432"
                    className="text-[var(--color-green-light)] hover:text-white font-medium transition-colors"
                  >
                    call (02) 9876 5432
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
