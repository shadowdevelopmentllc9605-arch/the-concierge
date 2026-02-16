import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Package, Calendar, Store, MapPin, Plus, Camera, Loader2, X, Shirt, Pencil } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from 'date-fns';
import ClosetItemEditor from '@/components/closet/ClosetItemEditor';

export default function Closet() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [ownedItems, setOwnedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [editingItem, setEditingItem] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const [userPurchases, closetItems] = await Promise.all([
        base44.entities.Purchase.filter({ user_id: user.id }, '-created_date'),
        base44.entities.ClosetItem.filter({ user_id: user.id }, '-created_date')
      ]);
      setPurchases(userPurchases);
      setOwnedItems(closetItems);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const user = await base44.auth.me();
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
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

        const newItem = await base44.entities.ClosetItem.create({
          user_id: user.id,
          image: file_url,
          item_type: analysis.item_type || '',
          color: analysis.color || '',
          size: '',
          style_category: analysis.style_category || 'other',
          description: analysis.description || '',
          source: 'uploaded'
        });
        
        setOwnedItems(prev => [newItem, ...prev]);
        // Open editor for the new item
        setEditingItem(newItem);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const removeItem = async (itemId) => {
    try {
      await base44.entities.ClosetItem.delete(itemId);
      setOwnedItems(prev => prev.filter(i => i.id !== itemId));
    } catch (error) {
      console.error(error);
    }
  };

  const updateItem = async (data) => {
    if (!editingItem) return;
    setSavingEdit(true);
    try {
      await base44.entities.ClosetItem.update(editingItem.id, data);
      setOwnedItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...data } : i));
      setEditingItem(null);
    } catch (error) {
      console.error(error);
    } finally {
      setSavingEdit(false);
    }
  };

  const totalItems = purchases.length + ownedItems.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-[#1a1a1a] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#fafafa]/95 backdrop-blur-lg px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-[#1a1a1a]" />
            </button>
            <div>
              <h1 className="text-2xl font-light text-[#1a1a1a]">My Closet</h1>
              <p className="text-sm text-[#64748b]">{totalItems} items</p>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowUploadOptions(!showUploadOptions)}
              disabled={uploading}
              className="w-10 h-10 rounded-full bg-[#c9a962] flex items-center justify-center shadow-sm"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Plus className="w-5 h-5 text-white" />
              )}
            </button>
            
            <AnimatePresence>
              {showUploadOptions && !uploading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  className="absolute right-0 top-12 bg-white rounded-xl shadow-lg border border-[#e5e7eb] overflow-hidden z-50"
                >
                  <button
                    onClick={() => { cameraInputRef.current?.click(); setShowUploadOptions(false); }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#f5f5f5] w-full text-left"
                  >
                    <Camera className="w-5 h-5 text-[#c9a962]" />
                    <span className="text-[#1a1a1a] text-sm font-medium">Take Photo</span>
                  </button>
                  <button
                    onClick={() => { fileInputRef.current?.click(); setShowUploadOptions(false); }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#f5f5f5] w-full text-left border-t border-[#f0f0f0]"
                  >
                    <ShoppingBag className="w-5 h-5 text-[#c9a962]" />
                    <span className="text-[#1a1a1a] text-sm font-medium">Upload Image</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleUpload}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4">
        <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start gap-2 bg-transparent h-auto mb-6 overflow-x-auto no-scrollbar">
            <TabsTrigger 
              value="all"
              className="rounded-full px-4 py-2 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white"
            >
              All ({totalItems})
            </TabsTrigger>
            <TabsTrigger 
              value="owned"
              className="rounded-full px-4 py-2 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white"
            >
              My Items ({ownedItems.length})
            </TabsTrigger>
            <TabsTrigger 
              value="purchased"
              className="rounded-full px-4 py-2 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white"
            >
              Purchased ({purchases.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {totalItems === 0 ? (
              <EmptyState onUpload={() => fileInputRef.current?.click()} uploading={uploading} />
            ) : (
              <>
                {ownedItems.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-[#64748b] mb-3">My Items</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {ownedItems.map((item, idx) => (
                        <OwnedItemCard key={item.id} item={item} idx={idx} onRemove={removeItem} onEdit={setEditingItem} />
                      ))}
                    </div>
                  </div>
                )}
                {purchases.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-[#64748b] mb-3">Purchased</h3>
                    <div className="space-y-4">
                      {purchases.map((item, idx) => (
                        <PurchaseCard key={item.id} item={item} idx={idx} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="owned">
            {ownedItems.length === 0 ? (
              <EmptyState onUpload={() => fileInputRef.current?.click()} uploading={uploading} type="owned" />
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {ownedItems.map((item, idx) => (
                  <OwnedItemCard key={item.id} item={item} idx={idx} onRemove={removeItem} onEdit={setEditingItem} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="purchased">
            {purchases.length === 0 ? (
              <EmptyState type="purchased" />
            ) : (
              <div className="space-y-4">
                {purchases.map((item, idx) => (
                  <PurchaseCard key={item.id} item={item} idx={idx} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingItem && (
          <ClosetItemEditor
            item={editingItem}
            onSave={updateItem}
            onCancel={() => setEditingItem(null)}
            saving={savingEdit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ onUpload, uploading, type = 'all' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-20 h-20 rounded-full bg-[#f5f5f0] flex items-center justify-center mb-6">
        {type === 'owned' ? <Shirt className="w-8 h-8 text-[#64748b]" /> : <Package className="w-8 h-8 text-[#64748b]" />}
      </div>
      <h2 className="text-xl font-medium text-[#1a1a1a] mb-2">
        {type === 'purchased' ? 'No purchases yet' : 'Your closet is empty'}
      </h2>
      <p className="text-[#64748b] text-center mb-6">
        {type === 'purchased' ? 'Items you buy will appear here' : 'Add items from your wardrobe'}
      </p>
      {type !== 'purchased' && onUpload && (
        <button
          onClick={onUpload}
          disabled={uploading}
          className="flex items-center gap-2 px-6 py-3 bg-[#1a1a1a] text-white rounded-xl font-medium"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
          Add Items
        </button>
      )}
    </div>
  );
}

function OwnedItemCard({ item, idx, onRemove, onEdit }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: idx * 0.03 }}
      className="relative aspect-square rounded-xl overflow-hidden bg-[#e5e5e5] group"
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
          onClick={() => onEdit(item)}
          className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
        >
          <Pencil className="w-3 h-3 text-white" />
        </button>
        <button
          onClick={() => onRemove(item.id)}
          className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>
    </motion.div>
  );
}

function PurchaseCard({ item, idx }) {
  const statusColors = {
    processing: 'bg-yellow-100 text-yellow-800',
    shipped: 'bg-blue-100 text-blue-800',
    delivered: 'bg-green-100 text-green-800',
    completed: 'bg-[#f5f5f0] text-[#64748b]'
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: idx * 0.05 }}
      className="bg-white rounded-2xl p-4 shadow-sm"
    >
      <div className="flex gap-4">
        <div className="w-20 h-20 rounded-xl bg-[#e5e5e5] overflow-hidden shrink-0">
          {item.product_image ? (
            <img 
              src={item.product_image}
              alt={item.product_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-6 h-6 text-[#64748b]" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-[#1a1a1a] truncate">{item.product_name}</h3>
          <p className="text-sm text-[#64748b] mt-1">
            Size: {item.size} {item.color && `• ${item.color}`}
          </p>
          
          <div className="flex items-center gap-4 mt-2 text-xs text-[#64748b]">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {item.created_date ? format(new Date(item.created_date), 'MMM d, yyyy') : 'N/A'}
            </span>
            <span className="flex items-center gap-1">
              {item.purchase_type === 'in_store' ? <Store className="w-3 h-3" /> : <Package className="w-3 h-3" />}
              {item.purchase_type === 'in_store' ? 'In Store' : 'Online'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold text-[#1a1a1a]">${item.product_price?.toFixed(2)}</p>
          <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs capitalize ${statusColors[item.status] || statusColors.completed}`}>
            {item.status || 'completed'}
          </span>
        </div>
      </div>
      
      {item.vendor_name && (
        <div className="mt-3 pt-3 border-t border-[#f5f5f0] flex items-center gap-2 text-sm text-[#64748b]">
          <MapPin className="w-4 h-4" />
          {item.vendor_name}
        </div>
      )}
    </motion.div>
  );
}