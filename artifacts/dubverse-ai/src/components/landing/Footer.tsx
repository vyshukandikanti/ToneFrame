import { motion } from 'framer-motion';

const LINKS = {
  Product: ['Voice Cloning', 'Lip Sync', 'Emotion Transfer', 'API Access', 'Pricing'],
  Company: ['About Us', 'Careers', 'Blog', 'Press', 'Contact'],
  Resources: ['Documentation', 'Tutorials', 'Release Notes', 'Status', 'Community'],
  Legal: ['Terms of Service', 'Privacy Policy', 'Data Processing', 'Security'],
};

export function Footer() {
  return (
    <footer className="relative overflow-hidden">
      <div className="luxury-divider" />

      <div className="mx-auto px-8 max-w-7xl py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-16">

          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="relative w-6 h-6">
                <div className="absolute inset-0 rounded-md bg-gradient-to-br from-violet-500 to-purple-700 opacity-80" />
                <div className="absolute inset-[1px] rounded-[5px] bg-[#09090f] flex items-center justify-center">
                  <svg className="w-3 h-3 text-violet-400" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                    <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.7"/>
                  </svg>
                </div>
              </div>
              <span className="font-semibold text-[14px] tracking-[-0.02em] text-white/75">
                DubVerse<span className="gradient-text-gold">AI</span>
              </span>
            </div>
            <p className="text-[13px] text-white/25 leading-relaxed font-light max-w-[200px]">
              The enterprise standard for multilingual AI video dubbing.
            </p>

            {/* Social */}
            <div className="flex gap-3 mt-8">
              {['X', 'GH', 'LI'].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="w-8 h-8 rounded-full luxury-card flex items-center justify-center text-[10px] font-mono text-white/25 hover:text-white/55 transition-colors duration-300"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([group, items]) => (
            <div key={group}>
              <h4 className="text-[10px] font-medium tracking-[0.2em] uppercase text-white/25 mb-5">
                {group}
              </h4>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-[13px] text-white/28 hover:text-white/60 transition-colors duration-300 font-light"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="luxury-divider mb-8" />
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[12px] text-white/18 font-light">
            © {new Date().getFullYear()} DubVerse AI, Inc. All rights reserved.
          </p>
          <p className="text-[12px] text-white/14 font-light tracking-wide">
            Built for the world's best creators.
          </p>
        </div>
      </div>
    </footer>
  );
}
