import { motion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$29',
    interval: '/month',
    description: 'For independent creators getting started with AI dubbing.',
    features: [
      '2 hours of video dubbing',
      'Standard voice cloning',
      '10 languages supported',
      '1080p exports',
      'Community support',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$79',
    interval: '/month',
    description: 'For studios and creators who need maximum quality and reach.',
    features: [
      '10 hours of video dubbing',
      'High-fidelity voice cloning',
      'All 40+ languages',
      '4K exports with lip sync',
      'Emotion transfer control',
      'Priority API access',
    ],
    cta: 'Get Pro',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    interval: '',
    description: 'For broadcast networks and production companies at scale.',
    features: [
      'Unlimited video dubbing',
      'Custom model training',
      'Dedicated account manager',
      'On-premise deployment',
      'White-glove onboarding',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-28 relative overflow-hidden">
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(91,33,182,0.06) 0%, transparent 70%)' }}
      />

      <div className="mx-auto px-8 max-w-7xl relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <p className="text-[10px] font-medium tracking-[0.28em] uppercase text-white/28 mb-5">
            Pricing
          </p>
          <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-bold tracking-[-0.03em] leading-[1.1] text-white mb-4">
            Simple, transparent pricing.
          </h2>
          <p className="text-[14px] text-white/30 font-light">
            No hidden fees. Cancel anytime.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className={`relative rounded-2xl p-7 flex flex-col ${
                plan.popular
                  ? 'gold-border'
                  : 'luxury-card'
              }`}
              style={plan.popular ? {
                background: 'rgba(255,255,255,0.03)',
                boxShadow: '0 0 60px rgba(196,163,90,0.08), 0 0 120px rgba(196,163,90,0.04)',
              } : {}}
            >
              {plan.popular && (
                <div className="absolute -top-px left-1/2 -translate-x-1/2 -translate-y-full pb-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium tracking-[0.14em] uppercase"
                    style={{ background: 'rgba(196,163,90,0.12)', border: '1px solid rgba(196,163,90,0.25)', color: '#C4A35A' }}
                  >
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan name & price */}
              <div className="mb-7">
                <div className="text-[11px] font-medium tracking-[0.18em] uppercase text-white/30 mb-4">
                  {plan.name}
                </div>
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className={`text-[44px] font-bold tracking-[-0.04em] leading-none ${plan.popular ? 'gradient-text-gold' : 'text-white/85'}`}>
                    {plan.price}
                  </span>
                  {plan.interval && (
                    <span className="text-[13px] text-white/28 font-light">{plan.interval}</span>
                  )}
                </div>
                <p className="text-[12px] text-white/28 leading-relaxed font-light">
                  {plan.description}
                </p>
              </div>

              {/* Divider */}
              <div className="luxury-divider mb-7" />

              {/* Features */}
              <ul className="space-y-3.5 flex-grow mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      <Check className={`w-3.5 h-3.5 ${plan.popular ? 'text-amber-400/70' : 'text-white/30'}`} />
                    </div>
                    <span className="text-[13px] text-white/50 font-light leading-snug">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                className={`w-full py-3 rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 group transition-all duration-300 ${
                  plan.popular
                    ? 'text-[#09090f] hover:opacity-90'
                    : 'text-white/50 border border-white/08 hover:border-white/14 hover:text-white/75'
                }`}
                style={plan.popular ? {
                  background: 'linear-gradient(135deg, #C4A35A, #D4B896)',
                } : {}}
              >
                {plan.cta}
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
