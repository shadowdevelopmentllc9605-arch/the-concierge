import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { ArrowRight, Volume2, VolumeX } from 'lucide-react';

export default function ConciergeIntro({ user, onComplete, onSelectConcierge }) {
  const [selectedConcierge, setSelectedConcierge] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const [voices, setVoices] = useState([]);

  const concierges = [
    {
      id: 'tyler',
      name: 'Tyler',
      gender: 'male',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
      greeting: `Hey there, I'm Tyler. I'll be your personal style concierge. I'm here to help you look your best every day. Let's build your profile and get started!`
    },
    {
      id: 'megan',
      name: 'Megan',
      gender: 'female',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face',
      greeting: `Hi! I'm Megan, your personal style concierge. I'm so excited to help you discover your perfect look. Let's create your profile and get started!`
    }
  ];

  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis?.getVoices() || [];
      setVoices(available);
    };
    loadVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const pickVoice = (gender) => {
    // Prefer American English voices matching the gender
    const americanVoices = voices.filter(v => v.lang === 'en-US');
    const maleKeywords = ['male', 'man', 'guy', 'david', 'alex', 'daniel', 'mark', 'james', 'thomas', 'tyler', 'evan', 'google us english'];
    const femaleKeywords = ['female', 'woman', 'girl', 'samantha', 'susan', 'karen', 'victoria', 'zira', 'moira', 'fiona', 'lisa', 'emily', 'megan'];

    let match = americanVoices.find(v => {
      const name = v.name.toLowerCase();
      const keywords = gender === 'male' ? maleKeywords : femaleKeywords;
      return keywords.some(k => name.includes(k));
    });

    // Fallback: pick any American voice and adjust pitch
    if (!match && americanVoices.length > 0) {
      match = americanVoices[gender === 'male' ? 0 : americanVoices.length - 1];
    }

    // Final fallback: any English voice
    if (!match) {
      const engVoices = voices.filter(v => v.lang.startsWith('en'));
      match = engVoices[0] || null;
    }

    return match;
  };

  const handleSelect = (concierge) => {
    setSelectedConcierge(concierge);
    setIsPlaying(true);
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(concierge.greeting);
      utterance.rate = 0.92;
      utterance.lang = 'en-US';

      if (concierge.gender === 'male') {
        utterance.pitch = 0.85;
        utterance.volume = 1;
      } else {
        utterance.pitch = 1.15;
        utterance.volume = 1;
      }

      const voice = pickVoice(concierge.gender);
      if (voice) utterance.voice = voice;

      utterance.onend = () => {
        setIsPlaying(false);
        setShowContinue(true);
      };
      utterance.onerror = () => {
        setIsPlaying(false);
        setShowContinue(true);
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => {
        setIsPlaying(false);
        setShowContinue(true);
      }, 3000);
    }
  };

  const toggleMute = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setShowContinue(true);
    }
  };

  const handleContinue = () => {
    onSelectConcierge(selectedConcierge);
    onComplete();
  };

  return (
    <div className="max-w-md mx-auto text-center">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-light text-[#2d2d2d] mb-2">
          Welcome to
        </h1>
        <h2 className="text-3xl font-medium text-[#2d2d2d] mb-4">
          The Concierge
        </h2>
        <p className="text-[#6b7280]">
          Choose your personal style assistant
        </p>
      </motion.div>

      {/* Concierge Selection */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex justify-center gap-6 mb-8"
      >
        {concierges.map((concierge, idx) => (
          <motion.button
            key={concierge.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 + idx * 0.1 }}
            onClick={() => handleSelect(concierge)}
            className={`relative group transition-all ${
              selectedConcierge?.id === concierge.id ? 'scale-105' : ''
            }`}
          >
            <div className={`w-32 h-32 rounded-full overflow-hidden border-4 transition-all ${
              selectedConcierge?.id === concierge.id 
                ? 'border-[#c9a962] shadow-lg shadow-[#c9a962]/20' 
                : 'border-transparent group-hover:border-[#c9a962]/50'
            }`}>
              <img 
                src={concierge.image}
                alt={concierge.name}
                className="w-full h-full object-cover"
              />
            </div>
            <p className={`mt-3 font-medium transition-colors ${
              selectedConcierge?.id === concierge.id ? 'text-[#c9a962]' : 'text-[#2d2d2d]'
            }`}>
              {concierge.name}
            </p>
          </motion.button>
        ))}
      </motion.div>

      {/* Speech Bubble */}
      {selectedConcierge && (
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-[#e5e7eb] mb-8 relative"
        >
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-[#e5e7eb] rotate-45" />
          
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
              <img 
                src={selectedConcierge.image}
                alt={selectedConcierge.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[#2d2d2d] leading-relaxed">
                {selectedConcierge.greeting}
              </p>
            </div>
            <button
              onClick={toggleMute}
              className="w-10 h-10 rounded-full bg-[#f8f5f0] flex items-center justify-center shrink-0"
            >
              {isPlaying ? (
                <Volume2 className="w-5 h-5 text-[#c9a962] animate-pulse" />
              ) : (
                <VolumeX className="w-5 h-5 text-[#6b7280]" />
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Continue Button */}
      {showContinue && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <Button
            onClick={handleContinue}
            className="w-full h-14 bg-[#c9a962] hover:bg-[#b8944d] text-white rounded-xl font-medium text-base"
          >
            Let's Begin
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
      )}

      {!selectedConcierge && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-[#9ca3af] text-sm"
        >
          Tap to select your concierge
        </motion.p>
      )}
    </div>
  );
}