import { motion } from 'framer-motion';

const MODELS = [
  { name: 'Whisper',      label: 'by OpenAI' },
  { name: 'ElevenLabs',   label: 'TTS Engine' },
  { name: 'HeyGen',       label: 'Lip Sync' },
  { name: 'Fish Speech',  label: 'Voice Clone' },
  { name: 'CosyVoice 2', label: 'by Alibaba' },
  { name: 'Indus TTS-2',  label: 'Neural Voice' },
];

export function TrustedModels() {
  return (
    <section id="models" className="py-20 relative overflow-hidden">
      <div className="luxury-divider mb-20" />

      <div className="mx-auto px-8 max-w-7xl">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="text-center text-[10px] font-medium tracking-[0.28em] uppercase text-white/25 mb-14"
        >
          Powered by industry-leading foundational models
        </motion.p>

        <div className="flex flex-wrap justify-center items-center gap-x-14 gap-y-8">
          {MODELS.map((model, i) => (
            <motion.div
              key={model.name}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.08 }}
              className="flex flex-col items-center gap-1 group cursor-default"
            >
              <span className="text-[18px] font-semibold tracking-[-0.02em] text-white/30 group-hover:text-white/60 transition-colors duration-500">
                {model.name}
              </span>
              <span className="text-[10px] tracking-[0.14em] uppercase text-white/15 group-hover:text-white/28 transition-colors duration-500">
                {model.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="luxury-divider mt-20" />
    </section>
  );
}
