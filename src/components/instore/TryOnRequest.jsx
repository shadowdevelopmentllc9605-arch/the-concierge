import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Shirt, Sparkles, X, Loader2 } from 'lucide-react';

export default function TryOnRequest({ items, userProfile, onRequest, onCancel }) {
  const [requesting, setRequesting] = useState(false);

  const handleRequest = async () => {
    setRequesting(true);
    await onRequest();
    setRequesting(false);
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="mx-6 mt-6"
    >
      <div className="bg-[#1a1a1a] rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#c9a962]/20 flex items-center justify-center">
              <Shirt className="w-6 h-6 text-[#c9a962]" />
            </div>
            <div>
              <h3 className="text-white font-medium">Ready to try on?</h3>
              <p className="text-white/60 text-sm">{items.length} item{items.length > 1 ? 's' : ''} selected</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-white/40 hover:text-white/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected items preview */}
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
          {items.map(item => (
            <div 
              key={item.id}
              className="w-16 h-16 rounded-lg bg-white/10 overflow-hidden shrink-0"
            >
              {item.product_image ? (
                <img src={item.product_image} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
                  No img
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Size info */}
        {userProfile?.suggested_sizes && (
          <div className="flex items-center gap-2 mb-4 text-sm">
            <Sparkles className="w-4 h-4 text-[#c9a962]" />
            <span className="text-white/60">Your sizes: </span>
            <span className="text-white">
              Top {userProfile.suggested_sizes.tops} • Bottom {userProfile.suggested_sizes.bottoms}
            </span>
          </div>
        )}

        <Button
          onClick={handleRequest}
          disabled={requesting}
          className="w-full h-12 bg-[#c9a962] hover:bg-[#b8944d] text-[#1a1a1a] rounded-xl font-medium"
        >
          {requesting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Shirt className="w-5 h-5 mr-2" />
              Request Try-On
            </>
          )}
        </Button>

        <p className="text-center text-white/40 text-xs mt-3">
          A team member will bring these items to you
        </p>
      </div>
    </motion.div>
  );
}