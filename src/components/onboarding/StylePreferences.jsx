import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import ConciergeGuide from './ConciergeGuide';

export default function StylePreferences({ profile, concierge, onComplete }) {
  const [selected, setSelected] = useState(profile?.style_preferences || []);
  const [saving, setSaving] = useState(false);

  const styles = [
    {
      id: 'business',
      name: 'Business',
      description: 'Suits, dress shirts, blouses, dress skirts, pants',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop'
    },
    {
      id: 'casual',
      name: 'Casual',
      description: 'Polos, jeans, t-shirts, shorts, skirts, tops',
      image: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&h=500&fit=crop'
    },
    {
      id: 'nightlife',
      name: 'Nightlife',
      description: 'Jackets, pattern shirts, evening dresses',
      image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=500&fit=crop'
    },
    {
      id: 'trendy',
      name: 'Trendy',
      description: 'Runway style, seasonal looks',
      image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=500&fit=crop'
    }
  ];

  const toggleStyle = (styleId) => {
    setSelected(prev => 
      prev.includes(styleId)
        ? prev.filter(s => s !== styleId)
        : [...prev, styleId]
    );
  };

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      await onComplete({ style_preferences: selected });
    } finally {
      setSaving(false);
    }
  };

  const guideMessage = "Excellent! Now tell me about your style preferences. What looks speak to you?";

  return (
    <div className="max-w-md mx-auto">
      <ConciergeGuide concierge={concierge} message={guideMessage} />
      
      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-4xl font-light text-[#2d2d2d] mb-2"
      >
        Your Style
      </motion.h1>
      <motion.p 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-[#6b7280] mb-8"
      >
        Select all styles that match your taste
      </motion.p>

      {/* Style Grid */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-4 mb-8"
      >
        {styles.map((style, idx) => (
          <motion.button
            key={style.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 + idx * 0.1 }}
            onClick={() => toggleStyle(style.id)}
            className={`relative aspect-[3/4] rounded-2xl overflow-hidden group ${
              selected.includes(style.id) ? 'ring-2 ring-[#c9a962]' : ''
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
            <img 
              src={style.image}
              alt={style.name}
              className="w-full h-full object-cover"
            />
            
            {/* Selection Indicator */}
            <div className={`absolute top-3 right-3 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              selected.includes(style.id) 
                ? 'bg-[#c9a962] scale-100' 
                : 'bg-white/20 scale-90'
            }`}>
              {selected.includes(style.id) && (
                <Check className="w-4 h-4 text-[#1a1a1a]" />
              )}
            </div>
            
            {/* Style Info */}
            <div className="absolute bottom-0 left-0 right-0 z-20 p-4">
              <p className="text-white font-medium mb-1">{style.name}</p>
              <p className="text-white/60 text-xs leading-relaxed">{style.description}</p>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* Continue Button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <Button
          onClick={handleSubmit}
          disabled={selected.length === 0 || saving}
          className="w-full h-14 bg-[#c9a962] hover:bg-[#b8944d] text-white rounded-xl font-medium text-base disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Continue
              <ArrowRight className="ml-2 w-5 h-5" />
            </>
          )}
        </Button>
        {selected.length === 0 && (
          <p className="text-center text-[#9ca3af] text-xs mt-3">
            Select at least one style to continue
          </p>
        )}
      </motion.div>
    </div>
  );
}