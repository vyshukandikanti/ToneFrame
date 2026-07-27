export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  interval: string;
  popular?: boolean;
  features: string[];
  cta: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  quote: string;
  rating: number;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export interface Step {
  id: string;
  number: string;
  title: string;
  description: string;
  icon: string;
}

export const MAIN_FEATURES: Feature[] = [
  {
    id: "voice-cloning",
    title: "Voice Cloning",
    description: "Replicate voices with 99.8% accuracy. Preserve emotion, intonation, and delivery across languages.",
    icon: "Mic"
  },
  {
    id: "lip-sync",
    title: "Lip Sync Technology",
    description: "AI-driven visual lip matching that automatically adjusts mouth movements to the new audio track.",
    icon: "Video"
  },
  {
    id: "emotion-transfer",
    title: "Emotion Transfer",
    description: "Don't just translate words. Translate feelings with dynamic pitch and pacing preservation.",
    icon: "Activity"
  },
  {
    id: "multi-language",
    title: "40+ Languages",
    description: "Expand your audience globally with native-sounding dubs in over forty dialects and accents.",
    icon: "Globe"
  },
  {
    id: "realtime",
    title: "Real-time Processing",
    description: "Zero wait times. Generate and preview high-fidelity audio tracks in real-time.",
    icon: "Zap"
  },
  {
    id: "studio-quality",
    title: "Studio Quality",
    description: "Export in uncompressed 48kHz WAV audio format ready for cinematic post-production.",
    icon: "Headphones"
  }
];

export const WORKFLOW_STEPS: Step[] = [
  {
    id: "step-1",
    number: "01",
    title: "Upload Video",
    description: "Drop your source file in any format.",
    icon: "UploadCloud"
  },
  {
    id: "step-2",
    number: "02",
    title: "AI Processing",
    description: "Automatic transcription & emotion analysis.",
    icon: "Cpu"
  },
  {
    id: "step-3",
    number: "03",
    title: "Voice Cloning",
    description: "Select languages and generate audio.",
    icon: "Wand2"
  },
  {
    id: "step-4",
    number: "04",
    title: "Export Ready",
    description: "Download synced video and audio tracks.",
    icon: "Download"
  }
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    name: "Sarah Jenkins",
    role: "Post-Production Lead",
    company: "Nexus Studios",
    quote: "ToneFrame cut our localization time from weeks to hours. The lip-sync capability is indistinguishable from human dubbing. A game changer for our international releases.",
    rating: 5
  },
  {
    id: "t2",
    name: "David Chen",
    role: "Content Creator",
    company: "10M+ Subscribers",
    quote: "I can finally launch my channel in Spanish, Japanese, and Hindi simultaneously. The emotion transfer ensures my jokes land perfectly in every single language.",
    rating: 5
  },
  {
    id: "t3",
    name: "Elena Rostova",
    role: "Director",
    company: "Aura Films",
    quote: "We were skeptical about AI voices for dramatic scenes, but ToneFrame captures the whisper, the breath, and the intensity. It's an essential part of our pipeline now.",
    rating: 5
  }
];

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$29",
    interval: "/mo",
    features: [
      "2 hours of video dubbing",
      "Standard voice cloning",
      "10 languages supported",
      "720p lip-sync exports",
      "Community support"
    ],
    cta: "Start Free Trial"
  },
  {
    id: "pro",
    name: "Pro",
    price: "$79",
    interval: "/mo",
    popular: true,
    features: [
      "10 hours of video dubbing",
      "High-fidelity voice cloning",
      "All 40+ languages",
      "4K lip-sync exports",
      "Emotion transfer control",
      "Priority API access"
    ],
    cta: "Get Pro"
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    interval: "",
    features: [
      "Unlimited video dubbing",
      "Custom model training",
      "Dedicated account manager",
      "On-premise deployment options",
      "White-glove onboarding",
      "SLA guarantee"
    ],
    cta: "Contact Sales"
  }
];

export const FAQS: FAQ[] = [
  {
    id: "faq-1",
    question: "How accurate is the voice cloning?",
    answer: "Our voice cloning models achieve 99.8% acoustic similarity. They replicate not just the timbre, but the breathing patterns, pauses, and unique cadences of the original speaker."
  },
  {
    id: "faq-2",
    question: "Does the lip-sync modify the video?",
    answer: "Yes, our AI subtly alters the lower face movements in the video to match the new audio track, ensuring perfect visual synchronization without uncanny valley effects."
  },
  {
    id: "faq-3",
    question: "What languages are currently supported?",
    answer: "We support over 40 languages including English, Spanish, French, German, Mandarin, Japanese, Korean, Arabic, Hindi, and Portuguese, with regional accents for each."
  },
  {
    id: "faq-4",
    question: "Can I use ToneFrame for commercial projects?",
    answer: "Absolutely. All paid tiers include a full commercial license for the generated audio and video. You retain 100% ownership of your content."
  },
  {
    id: "faq-5",
    question: "How long does processing take?",
    answer: "Processing is nearly real-time. A 10-minute video typically takes about 2-3 minutes to transcribe, translate, clone, and lip-sync across multiple languages."
  },
  {
    id: "faq-6",
    question: "Is my data secure?",
    answer: "We employ enterprise-grade encryption for all data in transit and at rest. We never use your private uploads to train our foundational models without explicit consent."
  }
];

export const SUPPORTED_LANGUAGES = [
  "English", "Spanish", "French", "German", 
  "Japanese", "Korean", "Chinese", "Arabic", 
  "Portuguese", "Hindi", "Italian", "Russian", 
  "Dutch", "Turkish", "Polish", "Swedish"
];

export const TRUSTED_MODELS = [
  "Whisper", "ElevenLabs", "HeyGen", "Fish Speech", "CosyVoice 2", "Indus TTS-2"
];
