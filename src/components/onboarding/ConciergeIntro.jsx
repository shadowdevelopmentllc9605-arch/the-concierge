import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { ArrowRight, Volume2, VolumeX } from 'lucide-react';

const TylerTTS = {
  voices: [],
  selectedVoice: null,

  async init() {
    this.voices = await this.loadVoices();
    this.selectedVoice = this.pickBestVoice(this.voices);
    console.log('Available voices:', this.voices.map(v => `${v.name} | ${v.lang}`).join(' || '));
    console.log('Selected Tyler voice:', this.selectedVoice ? `${this.selectedVoice.name} | ${this.selectedVoice.lang}` : 'none');
  },

  loadVoices() {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      const tryLoad = () => {
        const voices = synth.getVoices();
        if (voices && voices.length > 0) { resolve(voices); return true; }
        return false;
      };
      if (tryLoad()) return;
      synth.onvoiceschanged = () => resolve(synth.getVoices());
      setTimeout(() => resolve(synth.getVoices() || []), 1200);
    });
  },

  pickBestVoice(voices) {
    if (!voices || !voices.length) return null;
    const englishVoices = voices.filter(v => (v.lang || '').toLowerCase().startsWith('en'));
    const preferredOrder = [
      'Google UK English Male', 'Microsoft Guy Online (Natural)',
      'Microsoft Ryan Online (Natural)', 'Microsoft Davis Online (Natural)',
      'Samsung English (United States)', 'Alex', 'Daniel', 'Thomas', 'Aaron', 'Arthur', 'Fred'
    ];
    for (const preferred of preferredOrder) {
      const match = englishVoices.find(v => v.name.toLowerCase().includes(preferred.toLowerCase()));
      if (match) return match;
    }
    const masculineKeywords = ['male', 'guy', 'david', 'davis', 'ryan', 'alex', 'daniel', 'thomas', 'aaron', 'arthur', 'fred', 'samsung'];
    const keywordMatch = englishVoices.find(v => masculineKeywords.some(k => v.name.toLowerCase().includes(k)));
    return keywordMatch || englishVoices[0] || voices[0] || null;
  },

  speak(text, options = {}) {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
      utterance.lang = this.selectedVoice.lang || 'en-US';
    } else {
      utterance.lang = 'en-US';
    }
    utterance.rate = options.rate ?? 0.92;
    utterance.pitch = options.pitch ?? 0.72;
    utterance.volume = options.volume ?? 1.0;
    utterance.onstart = () => console.log('Tyler speaking...');
    utterance.onend = () => { console.log('Tyler done.'); if (options.onend) options.onend(); };
    utterance.onerror = (e) => { console.error('Tyler TTS error:', e); if (options.onerror) options.onerror(e); };
    synth.speak(utterance);
  }
};

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
    if ('speechSynthesis' in window) TylerTTS.init();
  }, []);

  const handleSelect = async (concierge) => {
    setSelectedConcierge(concierge);
    setIsPlaying(true);

    if (!('speechSynthesis' in window)) {
      setTimeout(() => { setIsPlaying(false); setShowContinue(true); }, 3000);
      return;
    }

    const done = () => { setIsPlaying(false); setShowContinue(true); };

    if (concierge.gender === 'male') {
      await TylerTTS.init();
      TylerTTS.speak(concierge.greeting, { onend: done, onerror: done });
    } else {
      // Megan: simple feminine voice
      const voices = await TylerTTS.loadVoices();
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(concierge.greeting);
      const femaleKeywords = ['samantha', 'susan', 'karen', 'victoria', 'zira', 'moira', 'fiona', 'lisa', 'emily', 'ava', 'allison', 'kate', 'female'];
      const engVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
      const voice = engVoices.find(v => femaleKeywords.some(k => v.name.toLowerCase().includes(k))) || engVoices[engVoices.length - 1] || null;
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang || 'en-US'; } else { utterance.lang = 'en-US'; }
      utterance.rate = 0.92; utterance.pitch = 1.2; utterance.volume = 1.0;
      utterance.onend = done; utterance.onerror = done;
      window.speechSynthesis.speak(utterance);
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
        <p className="text-[#6b7280] leading-relaxed mb-4">
          Your AI-powered personal style concierge. Discover curated fashion, virtually try on clothes, get personalized size recommendations, and enjoy a seamless in-store or online shopping experience — all in one place.
        </p>
        <p className="text-[#6b7280] font-medium">
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
            Find Your Fit
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