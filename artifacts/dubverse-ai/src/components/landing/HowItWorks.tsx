import { motion } from 'framer-motion';
import { UploadCloud, Cpu, Wand2, Download } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    title: 'Upload Your Video',
    description: 'Drop any format — MP4, MOV, MKV, AVI. Our ingest pipeline accepts up to 4K source files with no compression.',
    icon: UploadCloud,
    accent: 'from-violet-500/20 to-transparent',
    iconColor: 'text-violet-400',
  },
  {
    number: '02',
    title: 'AI Transcription & Analysis',
    description: 'Whisper-powered speech recognition extracts every syllable with timestamped precision. Emotion detection runs in parallel.',
    icon: Cpu,
    accent: 'from-purple-500/20 to-transparent',
    iconColor: 'text-purple-400',
  },
  {
    number: '03',
    title: 'Voice Clone & Dub',
    description: 'Select target languages. Our models clone the original voice and synthesize a perfect multilingual dub with emotion intact.',
    icon: Wand2,
    accent: 'from-gold/20 to-transparent',
    iconColor: 'text-amber-400/80',
  },
  {
    number: '04',
    title: 'Export Studio-Ready',
    description: 'Download synced video with lip movements corrected, plus raw audio stems in 48kHz WAV for your post-production pipeline.',
    icon: Download,
    accent: 'from-violet-400/20 to-transparent',
    iconColor: 'text-violet-300',
  },
];

export function HowItWorks() {
  return (
    <section className="py-28 relative overflow-hidden bg-[#06060b]">
      <div className="mx-auto px-8 max-w-7xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-20"
        >
          <p className="text-[10px] font-medium tracking-[0.28em] uppercase text-white/28 mb-5">
            How It Works
          </p>
          <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-bold tracking-[-0.03em] leading-[1.1] text-white max-w-lg">
            From upload to global
            <br />
            release in <span className="gradient-text">4 steps.</span>
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="luxury-card rounded-2xl p-7 flex flex-col group relative overflow-hidden"
            >
              {/* Background accent */}
              <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${step.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

              {/* Step number — large, dim background text */}
              <div className="absolute top-4 right-4 text-[64px] font-black tracking-[-0.05em] leading-none text-white/[0.04] select-none pointer-events-none">
                {step.number}
              </div>

              {/* Icon */}
              <div className="relative z-10 w-10 h-10 rounded-xl bg-white/[0.04] border border-white/07 flex items-center justify-center mb-6 group-hover:bg-white/[0.07] transition-colors duration-300">
                <step.icon className={`w-5 h-5 ${step.iconColor}`} />
              </div>

              {/* Step label */}
              <div className="relative z-10 text-[10px] font-medium tracking-[0.2em] uppercase text-white/25 mb-3">
                Step {step.number}
              </div>

              <h3 className="relative z-10 text-[16px] font-semibold tracking-[-0.01em] text-white/85 mb-3 leading-tight">
                {step.title}
              </h3>
              <p className="relative z-10 text-[13px] text-white/35 leading-relaxed font-light">
                {step.description}
              </p>

              {/* Connector dot (desktop) */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute -right-[11px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-white/10 bg-[#06060b] z-20 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
