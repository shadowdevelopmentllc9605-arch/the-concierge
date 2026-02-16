import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Upload, X, Plus, ArrowRight, Loader2, Shirt, Camera, Pencil } from 'lucide-react';
import ConciergeGuide from './ConciergeGuide';
import ClosetItemEditor from '@/components/closet/ClosetItemEditor';

export default function ClosetUpload({ profile, concierge, onComplete }) {
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const guideMessage = "Now let's see what's already in your closet! Upload photos of your favorite pieces so I can learn your style.";

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        // Analyze each item
        const analysis = await base44.integrations.Core.InvokeLLM({
          prompt: "Analyze this clothing item. Identify the type of clothing, color, style category (business/casual/nightlife/trendy), and any notable features.",
          file_urls: [file_url],
          response_json_schema: {
            type: "object",
            properties: {
              item_type: { type: "string" },
              color: { type: "string" },
              style_category: { type: "string" },
              description: { type: "string" }
            }
          }
        });

        const newItem = {
          image: file_url,
          item_type: analysis.item_type || '',
          color: analysis.color || '',
          style_category: analysis.style_category || '',
          size: '',
          description: analysis.description || ''
        };
        
        setItems(prev => {
          const newItems = [...prev, newItem];
          // Open editor for the new item
          setEditingIndex(newItems.length - 1);
          return newItems;
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index, data) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...data } : item));
    setEditingIndex(null);
  };

  const handleContinue = async () => {
    setAnalyzing(true);
    try {
      // Save each item to ClosetItem entity
      const user = await base44.auth.me();
      for (const item of items) {
        await base44.entities.ClosetItem.create({
          user_id: user.id,
          image: item.image,
          item_type: item.item_type,
          color: item.color,
          size: item.size,
          style_category: item.style_category || 'other',
          description: item.description,
          source: 'uploaded'
        });
      }
      
      await onComplete({});
    } catch (error) {
      console.error(error);
      await onComplete({});
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <ConciergeGuide concierge={concierge} message={guideMessage} />

      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-4xl font-light text-[#2d2d2d] mb-2"
      >
        Your Closet
      </motion.h1>
      <motion.p 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-[#6b7280] mb-8"
      >
        Upload items you already own to personalize recommendations
      </motion.p>

      {/* Upload Area */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        {uploading ? (
          <div className="w-full aspect-video bg-white border-2 border-dashed border-[#d1d5db] rounded-2xl flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-[#c9a962] animate-spin" />
            <span className="text-[#6b7280]">Analyzing...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="aspect-square bg-white border-2 border-dashed border-[#d1d5db] rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-[#c9a962] hover:bg-[#faf8f5] transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#f8f5f0] flex items-center justify-center">
                <Camera className="w-5 h-5 text-[#c9a962]" />
              </div>
              <p className="text-[#2d2d2d] font-medium text-sm">Take Photo</p>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square bg-white border-2 border-dashed border-[#d1d5db] rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-[#c9a962] hover:bg-[#faf8f5] transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#f8f5f0] flex items-center justify-center">
                <Upload className="w-5 h-5 text-[#c9a962]" />
              </div>
              <p className="text-[#2d2d2d] font-medium text-sm">Upload Image</p>
            </button>
          </div>
        )}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </motion.div>

      {/* Uploaded Items Grid */}
      {items.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <p className="text-sm text-[#6b7280] mb-3">{items.length} items added</p>
          <div className="grid grid-cols-3 gap-3">
            <AnimatePresence>
              {items.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="relative aspect-square rounded-xl overflow-hidden bg-[#f3f4f6] group"
                >
                  <img 
                    src={item.image}
                    alt={item.item_type}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-white text-xs font-medium truncate">{item.item_type || 'Untitled'}</p>
                      <p className="text-white/70 text-xs capitalize">{item.size && `${item.size} • `}{item.style_category || 'No category'}</p>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingIndex(idx)}
                      className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                    >
                      <Pencil className="w-3 h-3 text-white" />
                    </button>
                    <button
                      onClick={() => removeItem(idx)}
                      className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </motion.div>
              ))}
              
              {/* Add More Button */}
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-xl border-2 border-dashed border-[#d1d5db] flex items-center justify-center hover:border-[#c9a962] hover:bg-[#faf8f5] transition-colors"
              >
                <Plus className="w-6 h-6 text-[#9ca3af]" />
              </motion.button>
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Continue Button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Button
          onClick={handleContinue}
          disabled={analyzing}
          className="w-full h-14 bg-[#c9a962] hover:bg-[#b8944d] text-white rounded-xl font-medium text-base"
        >
          {analyzing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {items.length > 0 ? 'Continue' : 'Skip for now'}
              <ArrowRight className="ml-2 w-5 h-5" />
            </>
          )}
        </Button>
        {items.length === 0 && (
          <p className="text-center text-[#9ca3af] text-xs mt-3">
            You can always add items later
          </p>
        )}
      </motion.div>

      {/* Item Editor Modal */}
      <AnimatePresence>
        {editingIndex !== null && items[editingIndex] && (
          <ClosetItemEditor
            item={items[editingIndex]}
            onSave={(data) => updateItem(editingIndex, data)}
            onCancel={() => setEditingIndex(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}