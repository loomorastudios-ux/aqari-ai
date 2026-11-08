import React from 'react';

export const AmbientBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Base Grid Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40" />

      {/* Noise Grain Overlay with feTurbulence 0.8 */}
      <div className="absolute inset-0 noise-overlay pointer-events-none" />

      {/* Gold Orb: #D4AF37 600px blur 150px float 20s */}
      <div
        className="absolute -top-32 left-1/4 w-[600px] h-[600px] rounded-full opacity-25 filter blur-[150px] animate-orb-1"
        style={{
          background: 'radial-gradient(circle, #D4AF37 0%, rgba(212, 175, 55, 0) 70%)',
        }}
      />

      {/* Purple Orb: #8B5CF6 500px */}
      <div
        className="absolute top-1/3 -right-20 w-[500px] h-[500px] rounded-full opacity-20 filter blur-[150px] animate-orb-2"
        style={{
          background: 'radial-gradient(circle, #8B5CF6 0%, rgba(139, 92, 246, 0) 70%)',
        }}
      />

      {/* Blue Orb: #06B6D4 700px */}
      <div
        className="absolute bottom-10 left-10 w-[700px] h-[700px] rounded-full opacity-18 filter blur-[170px] animate-orb-3"
        style={{
          background: 'radial-gradient(circle, #06B6D4 0%, rgba(6, 182, 212, 0) 70%)',
        }}
      />

      {/* Deep vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
    </div>
  );
};
