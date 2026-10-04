import { useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import AvatarUploadModal from './AvatarUploadModal';
import { getGreetingHour } from '../utils/dateUtils';

function getGreetingTime(hour) {
  if (hour >= 5 && hour < 12) return 'Good Morning,';
  if (hour >= 12 && hour < 17) return 'Good Afternoon,';
  if (hour >= 17 && hour < 21) return 'Good Evening,';
  return 'Good Night,';
}

export default function GreetingCard({ name = 'Umesh', avatarUrl = null, onAvatarUpdated = null }) {
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const greeting = useMemo(() => {
    const hour = getGreetingHour();
    return getGreetingTime(hour);
  }, []);

  const displayName = name ? name.split(' ')[0] : 'Umesh';

  return (
    <>
      <div className="card bg-white rounded-3xl p-4 border border-[#EFE4D8] shadow-sm flex items-center justify-between gap-3 fade-up">
        {/* Left side: Avatar + Greeting Text */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Circular Clickable Avatar with Camera Overlay */}
          <div
            onClick={() => setShowAvatarModal(true)}
            className="group relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-[#F6DFC9] flex-shrink-0 border-2 border-[#EFE2D4] shadow-sm cursor-pointer transition-all hover:scale-105 hover:border-[#BA6838]"
            title="Click to change profile photo"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              /* Illustrated Portrait Avatar */
              <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="50" fill="#F4DCB9" />
                <path d="M12 96 C20 74 34 68 50 68 C66 68 80 74 88 96 Z" fill="#995632" />
                <path d="M35 70 Q50 82 65 70 Q50 90 35 70 Z" fill="#BA6838" />
                <path d="M44 76 L44 92" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M56 76 L56 90" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M43 56 H57 V70 H43 Z" fill="#E2A679" />
                <ellipse cx="50" cy="48" rx="19" ry="21" fill="#F3BF96" />
                <path
                  d="M30 44 C28 32 35 22 50 22 C65 22 72 32 70 44 C67 36 62 30 50 30 C38 30 33 36 30 44 Z"
                  fill="#2A201A"
                />
                <path
                  d="M31 38 C35 28 42 25 51 25 C62 25 68 30 70 38 C67 32 58 29 50 31 C42 33 36 35 31 38 Z"
                  fill="#1C1410"
                />
                <path d="M38 41 Q43 39 46 41" stroke="#261A13" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M54 41 Q57 39 62 41" stroke="#261A13" strokeWidth="2" strokeLinecap="round" fill="none" />
                <circle cx="42" cy="46" r="2.5" fill="#261A13" />
                <circle cx="58" cy="46" r="2.5" fill="#261A13" />
                <path d="M45 57 Q50 62 55 57" stroke="#9E5D36" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            )}

            {/* Hover Camera Overlay Badge */}
            <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
              <Camera size={18} className="text-white drop-shadow-md" />
            </div>
          </div>

          {/* Text Block */}
          <div className="min-w-0">
            <p className="text-xs text-[#857368] font-medium leading-none mb-1">
              {greeting}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-lg font-bold text-[#261B14] leading-tight">
                {displayName}
              </h1>
              {/* Leaf motif */}
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M17 3C17 3 13 4 8 9C3 14 3 17 3 17C3 17 6 17 11 12C16 7 17 3 17 3Z"
                  fill="#BA6838"
                />
                <path d="M3 17L9 11" stroke="#8A4822" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[11px] text-[#7A6960] leading-snug mt-1 max-w-[200px]">
              A peaceful mind helps you learn, grow and do more.
            </p>
          </div>
        </div>

        {/* Right side: Quote Card */}
        <div className="w-28 sm:w-32 bg-[#E9F2EB] border border-[#D5E6D9] rounded-2xl p-2.5 flex flex-col items-center justify-center text-center flex-shrink-0 shadow-xs">
          <div className="w-8 h-8 flex items-center justify-center mb-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 3C12 3 9 7 9 11C9 13.5 10.5 15.5 12 16C13.5 15.5 15 13.5 15 11C15 7 12 3 12 3Z"
                fill="#527D5E"
              />
              <path
                d="M7 8C7 8 6 12 8.5 14.5C9.5 15.5 12 16 12 16C12 16 10.5 13.5 10 11C9.5 8.5 7 8 7 8Z"
                fill="#6E9A7B"
              />
              <path
                d="M17 8C17 8 18 12 15.5 14.5C14.5 15.5 12 16 12 16C12 16 13.5 13.5 14 11C14.5 8.5 17 8 17 8Z"
                fill="#6E9A7B"
              />
              <path d="M12 16V21" stroke="#3D6348" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[10px] sm:text-[10.5px] font-medium text-[#2C4A34] leading-tight italic">
            "Progress happens in a calm mind."
          </p>
        </div>
      </div>

      {/* Avatar Upload Modal */}
      <AvatarUploadModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        currentAvatar={avatarUrl}
        onUploaded={(newUrl) => {
          if (onAvatarUpdated) {
            onAvatarUpdated(newUrl);
          }
        }}
      />
    </>
  );
}
