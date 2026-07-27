import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const FAQS = [
  {
    question: 'How accurate is the voice cloning?',
    answer: 'Our voice cloning models achieve 99.8% acoustic similarity. They replicate not just the timbre, but the breathing patterns, pauses, and unique cadences of the original speaker — indistinguishable in blind listening tests.',
  },
  {
    question: 'Does lip sync modify the original video?',
    answer: 'Yes. Our AI subtly alters the lower face movements in the video to match the new audio track, ensuring perfect visual synchronization without uncanny valley effects. The modification is non-destructive to original expressions.',
  },
  {
    question: 'Which languages are supported?',
    answer: 'We support 40+ languages including English, Spanish, French, German, Mandarin, Japanese, Korean, Arabic, Hindi, and Portuguese, with regional accents and dialect options for each major language group.',
  },
  {
    question: 'Can I use ToneFrame for commercial projects?',
    answer: 'All paid tiers include a full commercial license for generated audio and video content. You retain 100% ownership of your content. We never claim rights over your productions.',
  },
  {
    question: 'How long does processing take?',
    answer: 'Processing is near real-time. A 10-minute video typically takes 2-3 minutes to transcribe, translate, clone, and lip-sync across multiple languages simultaneously. Enterprise accounts receive priority GPU allocation.',
  },
  {
    question: 'Is my data secure?',
    answer: 'We employ AES-256 encryption for all data in transit and at rest. Your private uploads are never used to train our foundational models without explicit, opt-in consent. We are SOC 2 Type II certified.',
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="py-28 relative bg-[#06060b]">
      <div className="mx-auto px-8 max-w-7xl">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

          {/* Left — header */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="lg:sticky lg:top-32"
          >
            <p className="text-[10px] font-medium tracking-[0.28em] uppercase text-white/28 mb-5">
              FAQ
            </p>
            <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-bold tracking-[-0.03em] leading-[1.1] text-white mb-6">
              Common
              <br />
              questions.
            </h2>
            <p className="text-[14px] text-white/30 leading-relaxed font-light max-w-xs">
              Anything else? Reach our team through the Help Center — we typically respond within 2 hours.
            </p>
          </motion.div>

          {/* Right — accordion */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <Accordion type="single" collapsible className="space-y-2">
              {FAQS.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="luxury-card rounded-xl border-0 px-5 overflow-hidden"
                >
                  <AccordionTrigger className="text-[14px] font-medium text-white/65 hover:text-white/90 py-5 transition-colors duration-300 hover:no-underline text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-[13px] text-white/35 leading-relaxed font-light pb-5">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
