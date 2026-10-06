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
  { id: 'formal', label: 'Formal' },
  { id: 'evening', label: 'Evening' },
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'active', label: 'Active' },
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
        className="bg-[var(--color-surface)] rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--color-surface)] px-6 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Item Details</h2>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center select-none">
            <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Image Preview */}
          {item?.image && (
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-[var(--color-background-secondary)]">
              <img src={item.image} alt="Item" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Item Type */}
          <div>
            <Label className="text-[var(--color-text-secondary)] text-xs tracking-wide uppercase mb-2 block">
              Item Name
            </Label>
            <Input
              value={formData.item_type}
              onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
              placeholder="e.g., Blue Blazer, Summer Dress"
              className="h-12 rounded-xl border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Size Selection */}
          <div>
            <Label className="text-[var(--color-text-secondary)] text-xs tracking-wide uppercase mb-2 block">
              Size
            </Label>
            <div className="flex flex-wrap gap-2">
              {SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setFormData({ ...formData, size })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors select-none ${
                    formData.size === size
                      ? 'bg-[var(--color-text-primary)] text-[var(--color-background)]'
                      : 'bg-[var(--color-background-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <Label className="text-[var(--color-text-secondary)] text-xs tracking-wide uppercase mb-2 block">
              Color
            </Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setFormData({ ...formData, color })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors select-none ${
                    formData.color === color
                      ? 'bg-[var(--color-text-primary)] text-[var(--color-background)]'
                      : 'bg-[var(--color-background-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Style Category */}
          <div>
            <Label className="text-[var(--color-text-secondary)] text-xs tracking-wide uppercase mb-2 block">
              Style Category
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFormData({ ...formData, style_category: cat.id })}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors select-none ${
                    formData.style_category === cat.id
                      ? 'bg-[var(--color-accent)] text-[var(--color-background)]'
                      : 'bg-[var(--color-background-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[var(--color-surface)] px-6 py-4 border-t border-[var(--color-border-light)]">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 bg-[var(--color-text-primary)] hover:bg-[var(--color-text-primary)]/90 text-[var(--color-background)] rounded-xl select-none"
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