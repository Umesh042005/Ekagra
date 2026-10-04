import { ChevronRight } from 'lucide-react';

export default function TakeAPauseBanner() {
  return (
    <div className="card fade-up relative overflow-hidden rounded-3xl p-4 border border-[#EBE0D2] shadow-sm flex items-center justify-between gap-3"
         style={{
           background: 'linear-gradient(110deg, #FCEFE4 0%, #F6E2D0 48%, #E2EDE3 100%)',
         }}>
      {/* Left Text & Action */}
      <div className="z-10 flex-1 min-w-0 pr-2">
        <h3 className="font-bold text-base text-[#3E291C] leading-snug">
          Take a Pause
        </h3>
        <p className="text-xs text-[#7A695E] leading-snug mt-0.5 max-w-[185px]">
          Small moments of peace create big changes.
        </p>
        <button
          aria-label="Take a pause meditation"
          className="mt-2.5 w-7 h-7 rounded-full bg-[#EDDAC9] hover:bg-[#E2CBB7] transition-colors flex items-center justify-center text-[#733F1F] shadow-xs"
        >
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Right Decorative Scenic Illustration */}
      <div className="w-36 h-20 sm:w-44 sm:h-22 flex-shrink-0 relative flex items-end justify-center pointer-events-none">
        <svg viewBox="0 0 160 85" className="w-full h-full overflow-visible" xmlns="http://www.w3.org/2000/svg">
          {/* Distant mountains/hills */}
          <path d="M0 65 Q40 40 90 62 T160 60 L160 85 L0 85 Z" fill="#D6E4D8" />

          {/* Gentle Rising Sun */}
          <circle cx="95" cy="46" r="16" fill="#F8C7A8" fillOpacity="0.75" />

          {/* Rolling Mid Hills */}
          <path d="M10 70 Q70 48 120 68 T160 65 L160 85 L10 85 Z" fill="#8CA892" fillOpacity="0.6" />

          {/* Forefront Hill */}
          <path d="M30 78 Q85 64 160 70 L160 85 L30 85 Z" fill="#587961" fillOpacity="0.7" />

          {/* Tiny soaring birds */}
          <path d="M42 32 Q45 29 48 32 Q51 29 54 32" stroke="#8A6B56" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M56 26 Q58 24 60 26 Q62 24 64 26" stroke="#8A6B56" strokeWidth="0.8" fill="none" strokeLinecap="round" />

          {/* Meditating Silhouette */}
          <g transform="translate(112, 48) scale(0.65)">
            {/* Head */}
            <circle cx="20" cy="10" r="5" fill="#3D291C" />
            {/* Hair bun */}
            <circle cx="20" cy="4" r="2.5" fill="#3D291C" />
            {/* Torso */}
            <path d="M14 16 C14 16 17 15 20 15 C23 15 26 16 26 16 L27 28 L13 28 Z" fill="#A86138" />
            {/* Arms in meditation */}
            <path d="M14 17 L8 24 L12 28" stroke="#A86138" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M26 17 L32 24 L28 28" stroke="#A86138" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* Crossed legs / Lotus base */}
            <path d="M7 28 C7 24 33 24 33 28 C33 32 7 32 7 28 Z" fill="#354B3B" />
          </g>

          {/* Botanical sprigs on far right */}
          <g transform="translate(136, 32) scale(0.55)">
            <path d="M10 50 Q20 25 15 0" stroke="#3D5B44" strokeWidth="2" fill="none" />
            <ellipse cx="17" cy="8" rx="4" ry="7" transform="rotate(25 17 8)" fill="#5D8065" />
            <ellipse cx="10" cy="20" rx="4" ry="7" transform="rotate(-30 10 20)" fill="#6E9576" />
            <ellipse cx="20" cy="32" rx="4" ry="7" transform="rotate(35 20 32)" fill="#5D8065" />
          </g>
        </svg>
      </div>
    </div>
  );
}
