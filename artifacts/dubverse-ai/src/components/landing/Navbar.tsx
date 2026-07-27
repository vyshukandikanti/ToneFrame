import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useScroll } from 'framer-motion';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    return scrollY.on('change', (v) => setIsScrolled(v > 60));
  }, [scrollY]);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled ? 'glass-navbar py-4' : 'bg-transparent py-6'
      }`}
    >
      <div className="mx-auto px-8 max-w-7xl flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group cursor-pointer">
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute inset-[1px] rounded-[7px] bg-[#09090f] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-violet-400" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.7"/>
              </svg>
            </div>
          </div>
          <span className="font-semibold text-[15px] tracking-[-0.02em] text-white/90 group-hover:text-white transition-colors">
            Tone<span className="gradient-text-gold ml-0.5">Frame</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-10">
          {['Features', 'Models', 'Pricing', 'Help'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-[13px] font-medium tracking-wide text-white/40 hover:text-white/80 transition-colors duration-300"
            >
              {item}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link href="/auth">
            <button className="hidden sm:block text-[13px] font-medium text-white/40 hover:text-white/80 transition-colors duration-300 px-4 py-2 cursor-pointer">
              Sign In
            </button>
          </Link>
          <Link href="/auth">
            <button className="relative text-[13px] font-medium px-5 py-2 rounded-full overflow-hidden group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600 transition-opacity duration-300" />
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative text-white">Get Started</span>
            </button>
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
