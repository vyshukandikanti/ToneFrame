import { motion } from 'framer-motion';
import { WORKFLOW_STEPS } from '@/lib/mock-data/landing';
import { UploadCloud, Cpu, Wand2, Download } from 'lucide-react';

const iconMap: Record<string, any> = {
  UploadCloud,
  Cpu,
  Wand2,
  Download
};

export function HowItWorks() {
  return (
    <section className="py-24 relative bg-black/40">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="text-center mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4"
          >
            From upload to global in <span className="gradient-text-purple-blue">4 steps.</span>
          </motion.h2>
        </div>

        <div className="relative">
          {/* Gradient line connecting steps */}
          <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500/20 via-blue-500/50 to-cyan-500/20 -translate-y-1/2 hidden lg:block z-0"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {WORKFLOW_STEPS.map((step, i) => {
              const Icon = iconMap[step.icon];
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  className="glass p-8 rounded-3xl relative group hover:-translate-y-2 transition-transform duration-300"
                >
                  <div className="absolute -top-4 -left-4 w-12 h-12 rounded-2xl bg-black border border-white/10 flex items-center justify-center font-black text-xl text-white/30 group-hover:text-white transition-colors z-20">
                    {step.number}
                  </div>
                  
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:bg-white/10 transition-colors">
                    <Icon className="w-8 h-8 text-blue-400 group-hover:text-white transition-colors" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
