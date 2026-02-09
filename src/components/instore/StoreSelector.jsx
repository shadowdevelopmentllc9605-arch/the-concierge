import React from 'react';
import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Store, MapPin, ChevronRight } from 'lucide-react';

export default function StoreSelector({ open, onClose, stores, onSelect }) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Select a Store</SheetTitle>
        </SheetHeader>
        
        <div className="space-y-3 overflow-y-auto max-h-[calc(70vh-100px)]">
          {stores.length === 0 ? (
            <div className="text-center py-12">
              <Store className="w-12 h-12 text-[#e5e5e5] mx-auto mb-4" />
              <p className="text-[#64748b]">No stores available</p>
            </div>
          ) : (
            stores.map((store, idx) => (
              <motion.button
                key={store.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => onSelect(store)}
                className="w-full flex items-center gap-4 p-4 bg-[#f5f5f0] rounded-2xl hover:bg-[#e5e5e5] transition-colors"
              >
                <div className="w-14 h-14 rounded-xl bg-white overflow-hidden shrink-0">
                  {store.business_picture ? (
                    <img 
                      src={store.business_picture} 
                      alt={store.business_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Store className="w-6 h-6 text-[#64748b]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-medium text-[#1a1a1a]">{store.business_name}</h3>
                  {store.locations?.[0]?.address && (
                    <p className="text-sm text-[#64748b] flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {store.locations[0].address}
                    </p>
                  )}
                  {store.style_categories?.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {store.style_categories.slice(0, 3).map(cat => (
                        <span 
                          key={cat}
                          className="px-2 py-0.5 bg-white rounded-full text-xs text-[#64748b] capitalize"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-[#64748b]" />
              </motion.button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}