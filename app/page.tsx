import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { Hero } from "@/components/landing/hero";
import { AboutSection } from "@/components/landing/about-section";
import { DentistsSection } from "@/components/landing/dentists-section";
import { ServicesSection } from "@/components/landing/services-section";
import { ContactSection } from "@/components/landing/contact-section";

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
