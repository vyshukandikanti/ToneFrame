import { motion } from 'framer-motion';
import { SUPPORTED_LANGUAGES } from '@/lib/mock-data/landing';

export function SupportedLanguages() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4"
          >
            Speak to the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">world.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-lg max-w-2xl mx-auto"
          >
            Natively support over 40 languages with accurate dialects and regional colloquialisms.
          </motion.p>
        </div>

        {/* Marquee effect for languages */}
        <div className="relative w-full overflow-hidden flex flex-col gap-4">
          {/* Fading edges */}
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-10"></div>
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-10"></div>

          <motion.div 
            animate={{ x: [0, -1000] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="flex gap-4 w-max"
          >
            {[...SUPPORTED_LANGUAGES, ...SUPPORTED_LANGUAGES].map((lang, i) => (
              <div 
                key={`${lang}-${i}`}
                className="glass-sm px-6 py-3 rounded-full border border-white/5 whitespace-nowrap flex items-center gap-2 hover:bg-white/5 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                <span className="text-white font-medium">{lang}</span>
              </div>
            ))}
          </motion.div>
          
          <motion.div 
            animate={{ x: [-1000, 0] }}
            transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
            className="flex gap-4 w-max ml-12"
          >
            {[...SUPPORTED_LANGUAGES, ...SUPPORTED_LANGUAGES].reverse().map((lang, i) => (
              <div 
                key={`rev-${lang}-${i}`}
                className="glass-sm px-6 py-3 rounded-full border border-white/5 whitespace-nowrap flex items-center gap-2 hover:bg-white/5 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
                <span className="text-white font-medium">{lang}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
