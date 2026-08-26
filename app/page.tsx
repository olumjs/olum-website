import Hero from "@/components/Hero";
import FeatureSection from "@/components/FeatureSection";
import SyntaxCompareSection from "@/components/SyntaxCompareSection";
import BenchmarkSection from "@/components/BenchmarkSection";
import ComingNextSection from "@/components/ComingNextSection";
// import TestimonialsSection from "@/components/TestimonialsSection";
import ShowcaseSection from "@/components/ShowcaseSection";
import ContributorsSection from "@/components/ContributorsSection";
import PalestineSection from "@/components/PalestineSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Hero />
      <FeatureSection />
      <SyntaxCompareSection />
      <BenchmarkSection />
      <ComingNextSection />
      {/* <TestimonialsSection /> */}
      <ShowcaseSection />
      <ContributorsSection />
      <PalestineSection />
      <CTASection />
      <Footer />
    </main>
  );
}
