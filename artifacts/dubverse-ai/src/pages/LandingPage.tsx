import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { TrustedModels } from '@/components/landing/TrustedModels';
import { SupportedLanguages } from '@/components/landing/SupportedLanguages';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { Testimonials } from '@/components/landing/Testimonials';
import { Pricing } from '@/components/landing/Pricing';
import { FAQSection } from '@/components/landing/FAQ';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-purple-500/30 selection:text-white noise">
      <Navbar />
      <main>
        <HeroSection />
        <TrustedModels />
        <SupportedLanguages />
        <HowItWorks />
        <FeatureGrid />
        <Testimonials />
        <Pricing />
        <FAQSection />
      </main>
      <Footer />
    </div>
  );
}
