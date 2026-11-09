import React from 'react';
import { Sparkles } from 'lucide-react';

interface AnnouncementBannerProps {
  text?: string;
  className?: string;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  text,
  className = '',
}) => {
  if (!text || !text.trim()) {
    return null;
  }

  return (
    <div
      className={`w-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37] text-black py-2 px-4 shadow-[0_2px_15px_rgba(212,175,55,0.3)] text-center text-xs font-mono font-bold tracking-wider flex items-center justify-center gap-2 select-none relative z-50 ${className}`}
    >
      <Sparkles className="w-3.5 h-3.5 fill-black text-black shrink-0 animate-pulse" />
      <span>{text}</span>
      <Sparkles className="w-3.5 h-3.5 fill-black text-black shrink-0 animate-pulse" />
    </div>
  );
};
