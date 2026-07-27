import { motion } from 'framer-motion';
import { Play, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

const STATS = [
  { value: '99.8%', label: 'Voice accuracy' },
  { value: '40+',   label: 'Languages' },
  { value: '<3min', label: 'Per 10-min video' },
  { value: '4K',    label: 'Export quality' },
];

export function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden mesh-bg">

      {/* Background orbs — slow, refined */}
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.12, 0.2, 0.12] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(91,33,182,0.18) 0%, transparent 70%)' }}
      />
      <motion.div
        animate={{ scale: [1, 1.12, 1], opacity: [0.06, 0.1, 0.06] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(196,163,90,0.12) 0%, transparent 70%)' }}
      />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      <div className="container mx-auto px-8 max-w-7xl relative z-10 text-center pt-32 pb-24">

        {/* Eyebrow badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2.5 mb-10"
        >
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-white/20" />
          <span className="text-[11px] font-medium tracking-[0.22em] uppercase text-white/35">
            Introducing ToneFrame 2.0
          </span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-white/20" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-[clamp(3.2rem,8vw,7rem)] font-bold tracking-[-0.04em] leading-[0.95] text-white max-w-5xl mx-auto"
        >
          Create AI-powered
          <br />
          <span className="gradient-text">multilingual dubbing</span>
          <br />
          in minutes.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 text-[15px] md:text-[17px] text-white/38 max-w-xl mx-auto leading-relaxed font-light tracking-[0.01em]"
        >
          Voice Cloning · Lip Sync · Emotion Transfer · 40+ Languages
          <br />
          Studio-quality AI voices for enterprise creators.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12 flex items-center justify-center gap-4 flex-wrap"
        >
          <Link href="/auth">
            <button className="group relative flex items-center gap-2.5 px-7 py-3.5 rounded-full overflow-hidden text-[14px] font-medium text-white cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-700 to-purple-600" />
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative">Get Started Free</span>
              <ArrowRight className="relative w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
          </Link>

          <button className="group flex items-center gap-2.5 px-7 py-3.5 rounded-full text-[14px] font-medium text-white/50 hover:text-white/80 border border-white/08 hover:border-white/14 transition-all duration-300 backdrop-blur-sm">
            <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center group-hover:border-white/35 transition-colors">
              <Play className="w-2 h-2 fill-white/50 group-hover:fill-white/80 transition-colors ml-0.5" />
            </div>
            Watch Demo
          </button>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-24 flex items-center justify-center gap-0 flex-wrap max-w-2xl mx-auto"
        >
          {STATS.map((stat, i) => (
            <div key={stat.label} className="flex items-center">
              <div className="px-8 py-4 text-center">
                <div className="text-[28px] font-bold tracking-[-0.03em] text-white/90 leading-none mb-1.5">
                  {stat.value}
                </div>
                <div className="text-[11px] font-medium tracking-[0.12em] uppercase text-white/28">
                  {stat.label}
                </div>
              </div>
              {i < STATS.length - 1 && (
                <div className="w-px h-10 bg-white/06 self-center" />
              )}
            </div>
          ))}
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 1 }}
          className="mt-16 flex flex-col items-center gap-2"
        >
          <motion.div
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-px h-12 bg-gradient-to-b from-transparent via-white/15 to-transparent"
          />
        </motion.div>
      </div>
    </section>
  );
}
