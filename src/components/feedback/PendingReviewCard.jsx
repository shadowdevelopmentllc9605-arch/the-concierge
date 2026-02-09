import React from 'react';
import { motion } from 'framer-motion';
import { Star, ChevronRight, Store, Package } from 'lucide-react';
import { format } from 'date-fns';

export default function PendingReviewCard({ purchase, index, onSelect }) {
  return (
    <motion.button
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      onClick={onSelect}
      className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="w-20 h-20 rounded-xl bg-[#e5e5e5] overflow-hidden shrink-0">
        {purchase.product_image ? (
          <img 
            src={purchase.product_image}
            alt={purchase.product_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-6 h-6 text-[#64748b]" />
          </div>
        )}
      </div>
      
      <div className="flex-1 text-left min-w-0">
        <h3 className="font-medium text-[#1a1a1a] truncate">{purchase.product_name}</h3>
        <p className="text-sm text-[#64748b] mt-1">
          {purchase.created_date ? format(new Date(purchase.created_date), 'MMM d, yyyy') : 'Recent purchase'}
        </p>
        <div className="flex items-center gap-2 mt-2">
          {purchase.purchase_type === 'in_store' ? (
            <span className="flex items-center gap-1 text-xs text-[#64748b] bg-[#f5f5f0] px-2 py-1 rounded-full">
              <Store className="w-3 h-3" /> {purchase.vendor_name || 'In-Store'}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-[#64748b] bg-[#f5f5f0] px-2 py-1 rounded-full">
              <Package className="w-3 h-3" /> Online
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(star => (
            <Star key={star} className="w-4 h-4 text-[#e5e5e5]" />
          ))}
        </div>
        <span className="text-xs text-[#c9a962]">Rate now</span>
      </div>

      <ChevronRight className="w-5 h-5 text-[#64748b]" />
    </motion.button>
  );
}