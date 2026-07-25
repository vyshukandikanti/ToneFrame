import { motion } from 'framer-motion';
import { TRUSTED_MODELS } from '@/lib/mock-data/landing';

export function TrustedModels() {
  return (
    <section id="models" className="py-20 border-y border-white/5 bg-background relative overflow-hidden">
      <div className="container mx-auto px-6">
        <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-widest mb-10">
          Powered by industry-leading foundational models
        </p>
        
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-70">
          {TRUSTED_MODELS.map((model, i) => (
            <motion.div
              key={model}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-xl md:text-2xl font-bold font-sans tracking-tighter text-white/80 hover:text-white transition-colors cursor-default"
            >
              {model}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
