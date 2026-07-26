import { motion } from 'framer-motion';

const LANGUAGES = [
  { name: 'English',    code: 'EN' },
  { name: 'Spanish',    code: 'ES' },
  { name: 'French',     code: 'FR' },
  { name: 'German',     code: 'DE' },
  { name: 'Japanese',   code: 'JA' },
  { name: 'Korean',     code: 'KO' },
  { name: 'Chinese',    code: 'ZH' },
  { name: 'Arabic',     code: 'AR' },
  { name: 'Portuguese', code: 'PT' },
  { name: 'Hindi',      code: 'HI' },
  { name: 'Italian',    code: 'IT' },
  { name: 'Russian',    code: 'RU' },
  { name: 'Dutch',      code: 'NL' },
  { name: 'Turkish',    code: 'TR' },
  { name: 'Polish',     code: 'PL' },
  { name: 'Swedish',    code: 'SV' },
];

export function SupportedLanguages() {
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="mx-auto px-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-16 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-[10px] font-medium tracking-[0.28em] uppercase text-white/28 mb-4">
              Global Reach
            </p>
            <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-bold tracking-[-0.03em] leading-[1.1] text-white max-w-sm">
              40+ Languages.<br />
              <span className="gradient-text-gold">Zero compromise.</span>
            </h2>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="hidden md:block max-w-xs text-[14px] text-white/35 leading-relaxed font-light self-end"
          >
            Native-sounding dubs with regional accents. Your content, everywhere, indistinguishable.
          </motion.p>
        </div>

        {/* Language grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
          {LANGUAGES.map((lang, i) => (
            <motion.div
              key={lang.code}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.04 }}
              className="luxury-card rounded-xl px-3 py-3.5 flex flex-col items-center gap-1 group cursor-default"
            >
              <span className="text-[11px] font-mono font-medium tracking-wider text-white/28 group-hover:text-white/50 transition-colors duration-300">
                {lang.code}
              </span>
              <span className="text-[12px] font-medium text-white/55 group-hover:text-white/80 transition-colors duration-300 text-center">
                {lang.name}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
