/**
 * Presentation-only metadata for the public catalogue.
 *
 * The database is the source of truth for *which* services and dentists exist.
 * What lives here is the marketing chrome the schema deliberately does not
 * carry — an emoji, a "Popular" badge, a card colour. Two consequences are
 * deliberate:
 *
 * 1. Marketing copy changes never need a migration.
 * 2. Every lookup falls back, so a row added through the admin UI renders
 *    correctly the moment it is created — just plainly, with no badge.
 *
 * Anything that is a fact about a real person or a real service (a name, a
 * duration, a bio, a specialisation) belongs in the database, not here.
 */

const DEFAULT_SERVICE_ICON = "🦷";

export type ServiceMarketing = {
  icon: string;
  isPopular: boolean;
};

/**
 * Keyed by `Service.name` — the only stable public handle a service has, since
 * the schema carries no slug and the UUID is not something a human can map
 * against. A rename in the admin UI silently drops the entry back to the
 * default, which is why the fallback has to be presentable rather than empty.
 *
 * A `Map` rather than an object literal: the key is admin-controlled text, and
 * an object lookup for "constructor" or "toString" walks up to
 * `Object.prototype` and returns something truthy, which slips straight past
 * the `??` fallback and renders a card with an undefined icon.
 */
const SERVICE_MARKETING = new Map<string, ServiceMarketing>([
  ["General Checkup", { icon: "🦷", isPopular: false }],
  ["Teeth Cleaning", { icon: "🪥", isPopular: true }],
  ["Filling", { icon: "🔬", isPopular: false }],
  ["Root Canal", { icon: "💊", isPopular: false }],
  ["Teeth Whitening", { icon: "✨", isPopular: true }],
]);

export function serviceMarketing(name: string): ServiceMarketing {
  return (
    SERVICE_MARKETING.get(name) ?? {
      icon: DEFAULT_SERVICE_ICON,
      isPopular: false,
    }
  );
}

export type DentistCardStyle = {
  /** Card header block. */
  header: string;
  /** The initials medallion sitting on top of it. */
  medallion: string;
  /** Initials themselves — carries the contrast against `header`. */
  initials: string;
};

/**
 * Solid colour blocks, not gradients.
 *
 * The version of this card that shipped with the prototype used
 * `bg-gradient-to-br` with three hardcoded hexes, one of which (`#a8d5c5`) was
 * not a token at all. `docs/design-system.md` is explicit on both counts —
 * "the system is colour-block throughout", "don't introduce gradient fills" —
 * so the rewrite drops the gradients and uses tokens only.
 */
const DENTIST_CARD_STYLES: readonly DentistCardStyle[] = [
  {
    header: "bg-[var(--color-feature)]",
    medallion: "bg-white/20 border-white/30",
    initials: "text-white",
  },
  {
    header: "bg-[var(--color-green-light)]",
    medallion: "bg-white border-[var(--color-border)]",
    initials: "text-[var(--color-feature)]",
  },
  {
    header: "bg-[var(--color-cta)]",
    medallion: "bg-white/20 border-white/30",
    initials: "text-white",
  },
  {
    header: "bg-[var(--color-uplift)]",
    medallion: "bg-white/20 border-white/30",
    initials: "text-white",
  },
];

/**
 * Assign by position in the rendered list, so the first four cards are always
 * four different colours.
 *
 * Hashing the dentist id was the other candidate — it keeps a dentist's colour
 * stable when a colleague joins. It was tried and reverted: with three dentists
 * over four buckets a collision is more likely than not, and the clinic's three
 * real cards came out two-of-three identical, which reads as a bug. Distinctness
 * on the page every visitor sees beats stability across a hiring event nobody
 * sees.
 */
export function dentistCardStyle(index: number): DentistCardStyle {
  const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  return DENTIST_CARD_STYLES[safeIndex % DENTIST_CARD_STYLES.length];
}

/** Fallback for the medallion when a dentist has no profile photo. */
export function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
