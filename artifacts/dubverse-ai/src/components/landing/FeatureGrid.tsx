import { motion } from 'framer-motion';
import { MAIN_FEATURES } from '@/lib/mock-data/landing';
import { Mic, Video, Activity, Globe, Zap, Headphones } from 'lucide-react';

const iconMap: Record<string, any> = {
  Mic,
  Video,
  Activity,
  Globe,
  Zap,
  Headphones
};

export function FeatureGrid() {
  return (
    <section id="features" className="py-24 relative overflow-hidden">
      {/* Background flare */}
      <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="container mx-auto px-6 max-w-7xl relative z-10">
        <div className="mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4"
          >
            Precision engineering for <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">cinematic quality.</span>
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MAIN_FEATURES.map((feature, i) => {
            const Icon = iconMap[feature.icon];
            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass-sm p-8 rounded-3xl border border-white/5 hover:bg-white/[0.06] transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl gradient-primary p-[1px] mb-6 inline-block">
                  <div className="w-full h-full bg-background rounded-xl flex items-center justify-center group-hover:bg-transparent transition-colors">
                    <Icon className="w-6 h-6 text-white group-hover:text-background transition-colors" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
