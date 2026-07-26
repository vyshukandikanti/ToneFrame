import { motion } from 'framer-motion';
import { Mic, Video, Activity, Globe, Zap, Headphones } from 'lucide-react';

const FEATURES = [
  {
    id: '01',
    icon: Mic,
    title: 'Voice Cloning',
    description: 'Replicate voices with 99.8% acoustic accuracy. Every breath, pause, and cadence preserved across any language.',
    wide: true,
  },
  {
    id: '02',
    icon: Video,
    title: 'Lip Sync Technology',
    description: 'AI-driven visual matching that corrects mouth movements frame by frame to match the new audio track.',
    wide: false,
  },
  {
    id: '03',
    icon: Activity,
    title: 'Emotion Transfer',
    description: "Don't just translate words. Translate feelings — dynamic pitch, pacing, and intensity preservation.",
    wide: false,
  },
  {
    id: '04',
    icon: Globe,
    title: '40+ Languages',
    description: 'Expand globally with native-sounding dubs across 40 languages and regional dialects.',
    wide: false,
  },
  {
    id: '05',
    icon: Zap,
    title: 'Real-time Processing',
    description: 'Near-instant generation. Preview high-fidelity audio tracks while the full render completes in the background.',
    wide: false,
  },
  {
    id: '06',
    icon: Headphones,
    title: 'Studio Quality',
    description: 'Export in uncompressed 48kHz WAV and 4K video — ready for cinematic post-production workflows.',
    wide: true,
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="py-28 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none opacity-25"
        style={{ background: 'radial-gradient(ellipse, rgba(91,33,182,0.15) 0%, transparent 70%)' }}
      />

      <div className="mx-auto px-8 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="flex items-end justify-between mb-16 gap-8"
        >
          <div>
            <p className="text-[10px] font-medium tracking-[0.28em] uppercase text-white/28 mb-5">
              Capabilities
            </p>
            <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-bold tracking-[-0.03em] leading-[1.1] text-white max-w-sm">
              Precision-engineered for
              <br />
              <span className="gradient-text">cinematic quality.</span>
            </h2>
          </div>
          <p className="hidden md:block text-[13px] text-white/30 max-w-xs leading-relaxed font-light text-right self-end">
            Every model in our pipeline is built for broadcast-grade output, not just acceptable results.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={`luxury-card rounded-2xl p-7 group flex flex-col relative overflow-hidden ${
                feature.wide ? 'md:col-span-2' : 'md:col-span-1'
              }`}
            >
              {/* Hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 60% 50% at 30% 30%, rgba(91,33,182,0.06) 0%, transparent 70%)' }}
              />

              <div className="flex items-start justify-between mb-8">
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/07 flex items-center justify-center group-hover:bg-white/[0.08] transition-colors duration-300">
                  <feature.icon className="w-4 h-4 text-white/50 group-hover:text-white/75 transition-colors duration-300" />
                </div>
                <span className="text-[11px] font-mono text-white/18 tracking-wider">{feature.id}</span>
              </div>

              <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-white/80 mb-3 group-hover:text-white/95 transition-colors duration-300">
                {feature.title}
              </h3>
              <p className="text-[13px] text-white/32 leading-relaxed font-light">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
