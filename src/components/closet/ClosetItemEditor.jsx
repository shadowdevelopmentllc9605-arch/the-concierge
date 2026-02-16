import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Check, Loader2 } from 'lucide-react';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLORS = ['Black', 'White', 'Navy', 'Gray', 'Brown', 'Beige', 'Red', 'Blue', 'Green', 'Pink', 'Purple', 'Orange', 'Yellow', 'Multi'];
const STYLE_CATEGORIES = [
  { id: 'business', label: 'Business' },
  { id: 'casual', label: 'Casual' },
  { id: 'trendy', label: 'Trendy' },
  { id: 'nightlife', label: 'Nightlife' }
];

export default function ClosetItemEditor({ item, onSave, onCancel, saving = false }) {
  const [formData, setFormData] = useState({
    item_type: item?.item_type || '',
    size: item?.size || '',
    color: item?.color || '',
    style_category: item?.style_category || ''
  });

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
          <h2 className="text-lg font-medium text-[#1a1a1a]">Item Details</h2>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-[#f5f5f5] flex items-center justify-center">
            <X className="w-4 h-4 text-[#64748b]" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Image Preview */}
          {item?.image && (
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-[#f5f5f5]">
              <img src={item.image} alt="Item" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Item Type */}
          <div>
            <Label className="text-[#6b7280] text-xs tracking-wide uppercase mb-2 block">
              Item Name
            </Label>
            <Input
              value={formData.item_type}
              onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
              placeholder="e.g., Blue Blazer, Summer Dress"
              className="h-12 rounded-xl border-[#e5e7eb] focus:ring-[#c9a962] focus:border-[#c9a962]"
            />
          </div>

          {/* Size Selection */}
          <div>
            <Label className="text-[#6b7280] text-xs tracking-wide uppercase mb-2 block">
              Size
            </Label>
            <div className="flex flex-wrap gap-2">
              {SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setFormData({ ...formData, size })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.size === size
                      ? 'bg-[#1a1a1a] text-white'
                      : 'bg-[#f5f5f5] text-[#1a1a1a] hover:bg-[#e5e5e5]'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <Label className="text-[#6b7280] text-xs tracking-wide uppercase mb-2 block">
              Color
            </Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setFormData({ ...formData, color })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.color === color
                      ? 'bg-[#1a1a1a] text-white'
                      : 'bg-[#f5f5f5] text-[#1a1a1a] hover:bg-[#e5e5e5]'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Style Category */}
          <div>
            <Label className="text-[#6b7280] text-xs tracking-wide uppercase mb-2 block">
              Style Category
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFormData({ ...formData, style_category: cat.id })}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    formData.style_category === cat.id
                      ? 'bg-[#c9a962] text-white'
                      : 'bg-[#f5f5f5] text-[#1a1a1a] hover:bg-[#e5e5e5]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-[#f0f0f0]">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 bg-[#1a1a1a] hover:bg-[#2d2d2d] text-white rounded-xl"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                Save Item
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}