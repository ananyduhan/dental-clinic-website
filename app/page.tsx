import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { Hero } from "@/components/landing/hero";
import { AboutSection } from "@/components/landing/about-section";
import { DentistsSection } from "@/components/landing/dentists-section";
import { ServicesSection } from "@/components/landing/services-section";
import { ContactSection } from "@/components/landing/contact-section";

/**
 * The services and dentists sections read the live catalogue, so the page
 * renders per request rather than being frozen at build time — a dentist who
 * goes inactive should disappear from the public site on the next load, not on
 * the next deploy. Each section streams behind its own Suspense boundary, so
 * the hero and about copy still paint immediately.
 */
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <AboutSection />
        <ServicesSection />
        <DentistsSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
