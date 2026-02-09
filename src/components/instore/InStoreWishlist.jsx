import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Check, ChevronRight } from 'lucide-react';

export default function InStoreWishlist({ items, selectedItems, onToggleSelect, onViewAll }) {
  if (items.length === 0) {
    return (
      <div className="px-6 mt-8">
        <div className="bg-white rounded-2xl p-6 text-center">
          <Heart className="w-10 h-10 text-[#e5e5e5] mx-auto mb-3" />
          <h3 className="font-medium text-[#1a1a1a] mb-1">No wishlist items here</h3>
          <p className="text-sm text-[#64748b] mb-4">
            Browse the store to add items to your wishlist
          </p>
          <button
            onClick={onViewAll}
            className="text-sm text-[#c9a962] font-medium"
          >
            View full wishlist
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 mt-8">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-medium text-[#1a1a1a]">Your Wishlist</h2>
          <p className="text-sm text-[#64748b]">{items.length} items available here</p>
        </div>
        <button 
          onClick={onViewAll}
          className="text-sm text-[#c9a962] font-medium flex items-center"
        >
          View all <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item, idx) => {
          const isSelected = selectedItems.find(i => i.id === item.id);
          return (
            <motion.button
              key={item.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onToggleSelect(item)}
              className={`relative bg-white rounded-2xl overflow-hidden transition-all ${
                isSelected ? 'ring-2 ring-[#c9a962]' : ''
              }`}
            >
              <div className="aspect-square bg-[#e5e5e5]">
                {item.product_image ? (
                  <img 
                    src={item.product_image}
                    alt={item.product_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#64748b]">
                    No image
                  </div>
                )}
              </div>
              
              {/* Selection indicator */}
              <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                isSelected ? 'bg-[#c9a962]' : 'bg-white/80'
              }`}>
                {isSelected && <Check className="w-4 h-4 text-[#1a1a1a]" />}
              </div>

              <div className="p-3">
                <h3 className="text-sm font-medium text-[#1a1a1a] truncate">{item.product_name}</h3>
                <p className="text-sm font-semibold text-[#1a1a1a] mt-1">${item.product_price?.toFixed(2)}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {selectedItems.length > 0 && (
        <p className="text-center text-sm text-[#64748b] mt-4">
          {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected for try-on
        </p>
      )}
    </div>
  );
}