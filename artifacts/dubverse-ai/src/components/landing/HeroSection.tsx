import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Mic, Video, Globe, Activity, Play } from 'lucide-react';

const FLOATING_CARDS = [
  { icon: Mic, label: "Voice Cloning", delay: 0.1, x: -120, y: -80 },
  { icon: Video, label: "Lip Sync", delay: 0.3, x: 140, y: -40 },
  { icon: Globe, label: "40+ Languages", delay: 0.5, x: -150, y: 100 },
  { icon: Activity, label: "Emotion Transfer", delay: 0.7, x: 130, y: 120 },
];

export function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] flex items-center justify-center pt-24 pb-16 overflow-hidden mesh-bg">
      {/* Animated subtle orb in background */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ 
          duration: 8, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"
      />

      <div className="container mx-auto px-6 max-w-7xl relative z-10 text-center flex flex-col items-center">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-sm border border-white/10 mb-8"
        >
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]"></span>
          <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Introducing DubVerse 2.0</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-white max-w-5xl leading-[1.1]"
        >
          Create AI-powered multilingual <br className="hidden md:block" />
          <span className="gradient-text-purple-blue">dubbing in minutes.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 text-lg md:text-xl text-muted-foreground max-w-2xl font-medium"
        >
          Voice Cloning, Lip Sync, Emotion Transfer, 40+ Languages. <br className="hidden md:block" />
          Studio-quality AI voices for enterprise creators.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base gradient-primary text-white border-0 glow-blue rounded-xl shadow-2xl hover:shadow-[0_0_60px_rgba(59,130,246,0.4)] transition-all duration-300">
            Get Started Free
          </Button>
          <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base bg-white/5 border-white/10 hover:bg-white/10 hover:text-white rounded-xl backdrop-blur-md">
            <Play className="w-4 h-4 mr-2 fill-current" />
            Watch Demo
          </Button>
        </motion.div>

        {/* Floating Cards */}
        <div className="absolute inset-0 pointer-events-none hidden lg:block">
          {FLOATING_CARDS.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 + card.delay, duration: 0.5 }}
              className="absolute top-1/2 left-1/2"
              style={{
                x: `calc(-50% + ${card.x}px)`,
                y: `calc(-50% + ${card.y}px)`,
              }}
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, delay: card.delay, repeat: Infinity, ease: "easeInOut" }}
                className="glass-heavy px-4 py-3 rounded-2xl flex items-center gap-3 shadow-2xl gradient-border border-white/10 backdrop-blur-xl"
              >
                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
                  <card.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-white whitespace-nowrap">{card.label}</span>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
