import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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

export default function ClosetItemEditor({ item, onSave, onCancel, onAnalyze, saving = false }) {
  const [formData, setFormData] = useState({
    item_type: item?.item_type || '',
    size: item?.size || '',
    width_code: item?.width_code || '',
    color: item?.color || '',
    style_category: item?.style_category || '',
    description: item?.description || ''
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const handleAnalyze = async () => {
    if (!onAnalyze || analyzing || saving) return;
    setAnalyzing(true);
    setAnalysisMessage('');
    try {
      const result = await onAnalyze();
      const color = COLORS.find(value => value.toLowerCase() === String(result.color).trim().toLowerCase());
      const style = STYLE_CATEGORIES.find(value => value.id === String(result.style_category).trim().toLowerCase());
      setFormData(prev => ({ ...prev,
        item_type: prev.item_type || result.item_type.trim(),
        color: prev.color || color || '',
        style_category: prev.style_category && prev.style_category !== 'other' ? prev.style_category : (style?.id || prev.style_category),
        description: prev.description || String(result.description || '')
      }));
      setAnalysisMessage('Suggested details are ready. Review them and tap Save Item.');
    } catch {
      setAnalysisMessage('Automatic analysis is unavailable. Your saved photo and existing details are unchanged.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = () => {
    onSave(formData);
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog" aria-modal="true" aria-label="Item details"
      className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90dvh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 px-6 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">Item Details</h2>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center select-none">
            <X className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Image Preview */}
          {item?.image && (
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
              <img src={item.image} alt="Item" className="w-full h-full object-cover" />
            </div>
          )}

          {onAnalyze && (
            <div className="space-y-2">
              <Button type="button" variant="outline" className="w-full" disabled={analyzing || saving} onClick={handleAnalyze}>
                {analyzing ? 'Analyzing photo…' : 'Analyze saved photo'}
              </Button>
              <p className="text-xs text-muted-foreground">Sends this clothing photo to the AI service to suggest details. Review before saving.</p>
              {analysisMessage && <p role="status" className="text-sm text-foreground">{analysisMessage}</p>}
            </div>
          )}

          {/* Item Type */}
          <div>
            <Label className="text-slate-600 dark:text-slate-300 text-xs tracking-wide uppercase mb-2 block">
              Item Name
            </Label>
            <Input
              value={formData.item_type}
              onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
              placeholder="e.g., Blue Blazer, Summer Dress"
              className="h-12 rounded-xl border-[var(--color-border)] bg-[var(--color-background)] text-slate-900 dark:text-white focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Size Selection */}
          <div>
            <Label className="text-slate-600 dark:text-slate-300 text-xs tracking-wide uppercase mb-2 block">
              Size
            </Label>
            <div className="flex flex-wrap gap-2">
              {SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setFormData({ ...formData, size })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors select-none ${
                    formData.size === size
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-[var(--color-border)]'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-slate-600 dark:text-slate-300 text-xs tracking-wide uppercase mb-2 block">
              Footwear Width
            </Label>
            <Input
              value={formData.width_code}
              onChange={(e) => setFormData({ ...formData, width_code: e.target.value })}
              placeholder="Optional: D, 2E, Wide, Narrow"
              className="h-12 rounded-xl border-[var(--color-border)] bg-[var(--color-background)] text-slate-900 dark:text-white focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Color Selection */}
          <div>
            <Label className="text-slate-600 dark:text-slate-300 text-xs tracking-wide uppercase mb-2 block">
              Color
            </Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setFormData({ ...formData, color })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors select-none ${
                    formData.color === color
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-[var(--color-border)]'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs tracking-wide uppercase mb-2 block">Description</Label>
            <textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} className="w-full rounded-xl border p-3 bg-background text-foreground" rows={3} />
          </div>

          {/* Style Category */}
          <div>
            <Label className="text-slate-600 dark:text-slate-300 text-xs tracking-wide uppercase mb-2 block">
              Style Category
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFormData({ ...formData, style_category: cat.id })}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors select-none ${
                    formData.style_category === cat.id
                      ? 'bg-[var(--color-accent)] text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-[var(--color-border)]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 px-6 py-4 border-t border-[var(--color-border-light)]">
          <Button
            onClick={handleSave}
            disabled={saving || analyzing}
            className="w-full h-12 bg-slate-900 dark:bg-white hover:bg-slate-900 dark:bg-white/90 text-white dark:text-slate-900 rounded-xl select-none"
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
    </motion.div>,
    document.body
  );
}