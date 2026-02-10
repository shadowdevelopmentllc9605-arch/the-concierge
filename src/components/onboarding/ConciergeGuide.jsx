import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';

export default function ConciergeGuide({ concierge, message, autoPlay = true }) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (autoPlay && message && concierge) {
      speakMessage();
    }
    
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [message]);

  const speakMessage = () => {
    if (!('speechSynthesis' in window) || !message) return;
    
    window.speechSynthesis.cancel();
    setIsPlaying(true);
    
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.9;
    utterance.pitch = concierge?.id === 'megan' ? 1.1 : 0.9;
    
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const togglePlay = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      speakMessage();
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
        <img 
          src={concierge.image}
          alt={concierge.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#c9a962] font-medium">{concierge.name}</p>
        <p className="text-sm text-[#2d2d2d] truncate">{message}</p>
      </div>
      <button
        onClick={togglePlay}
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