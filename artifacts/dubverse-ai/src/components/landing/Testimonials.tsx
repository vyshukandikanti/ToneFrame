import { motion } from 'framer-motion';

const TESTIMONIALS = [
  {
    quote: "ToneFrame cut our localization time from weeks to hours. The lip-sync is indistinguishable from human dubbing. An essential part of our international release pipeline.",
    name: 'Sarah Jenkins',
    role: 'Post-Production Lead',
    company: 'Nexus Studios',
    initials: 'SJ',
  },
  {
    quote: "I launch my channel in Spanish, Japanese, and Hindi simultaneously. The emotion transfer means my jokes land in every single language. Nothing else comes close.",
    name: 'David Chen',
    role: 'Content Creator',
    company: '10M+ Subscribers',
    initials: 'DC',
  },
  {
    quote: "We were skeptical about AI voices for dramatic scenes. ToneFrame captures the whisper, the breath, the intensity. It's become our production standard.",
    name: 'Elena Rostova',
    role: 'Director',
    company: 'Aura Films',
    initials: 'ER',
  },
];

export function Testimonials() {
  return (
    <section className="py-28 relative overflow-hidden bg-[#06060b]">
      <div className="mx-auto px-8 max-w-7xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-16"
        >
          <p className="text-[10px] font-medium tracking-[0.28em] uppercase text-white/28 mb-5">
            Testimonials
          </p>
          <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-bold tracking-[-0.03em] leading-[1.1] text-white">
            Trusted by top studios.
          </h2>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="luxury-card rounded-2xl p-8 flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Large quote mark */}
              <div className="absolute top-4 right-6 text-[100px] font-serif leading-none text-white/[0.03] select-none pointer-events-none group-hover:text-white/[0.05] transition-colors duration-500">
                "
              </div>

              <div className="relative z-10 mb-8">
                <p className="text-[14px] text-white/55 leading-[1.75] font-light tracking-[0.005em]">
                  "{t.quote}"
                </p>
              </div>

              <div className="relative z-10 flex items-center gap-3.5">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, rgba(91,33,182,0.6), rgba(124,58,237,0.8))' }}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="text-[13px] font-medium text-white/75 tracking-[-0.01em]">{t.name}</div>
                  <div className="text-[11px] text-white/28 mt-0.5">{t.role}, {t.company}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
