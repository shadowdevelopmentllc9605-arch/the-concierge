import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { speakOnboardingMessage } from '@/lib/onboardingVoices';

export default function ConciergeGuide({ concierge, message, autoPlay = true }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  const requestRef = useRef(0);

  const speakMessage = async () => {
    if (!concierge || !message) return;
    const id = ++requestRef.current;
    const isCurrent = () => requestRef.current === id;
    setVoiceNotice('');
    setIsPlaying(true);

    try {
      const result = await speakOnboardingMessage({
        concierge, message, isCurrent,
        onend: () => { if (isCurrent()) setIsPlaying(false); },
        onerror: () => { if (isCurrent()) setIsPlaying(false); }
      });
      if (!isCurrent()) return;
      if (!result.spoken) {
        setIsPlaying(false);
        if (result.reason === 'masculine_voice_unavailable') {
          setVoiceNotice("Tyler's masculine voice is unavailable in this browser. His instructions are shown on screen.");
        }
      }
    } catch (error) {
      console.error('Onboarding guide voice unavailable', error);
      if (isCurrent()) setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (autoPlay && message && concierge) void speakMessage();
    return () => {
      ++requestRef.current;
      window.speechSynthesis?.cancel();
    };
  }, [message, concierge?.id, autoPlay]);

  const togglePlay = () => {
    if (isPlaying) {
      ++requestRef.current;
      window.speechSynthesis?.cancel();
      setIsPlaying(false);
    } else {
      void speakMessage();
    }
  };

  if (!concierge) return null;

  return (
    <motion.div
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-2xl p-3 shadow-sm border border-[#e5e7eb]/50 mb-6"
    >
      <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-[#c9a962]/30">
        <img src={concierge.image} alt={concierge.name} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#c9a962] font-medium">{concierge.name}</p>
        <p className="text-sm text-[#2d2d2d]">{message}</p>
        {voiceNotice && <p role="status" className="mt-2 text-xs text-amber-900">{voiceNotice}</p>}
      </div>
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Stop guide narration' : 'Play guide narration'}
        className="w-8 h-8 rounded-full bg-[#f8f5f0] flex items-center justify-center shrink-0"
      >
        {isPlaying ? (
          <Volume2 className="w-4 h-4 text-[#c9a962] animate-pulse" />
        ) : (
          <VolumeX className="w-4 h-4 text-[#6b7280]" />
        )}
      </button>
    </motion.div>
  );
}
