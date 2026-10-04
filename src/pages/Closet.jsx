import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Package, Calendar, Store, MapPin, Camera, Loader2, X, Shirt, Pencil, ImagePlus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from 'date-fns';
import ClosetItemEditor from '@/components/closet/ClosetItemEditor';
import PullToRefresh from '@/components/PullToRefresh';

function EmptyState({ onTakePhoto, onUploadImage, uploading, type = 'all' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-20 h-20 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center mb-6">
        {type === 'owned' ? <Shirt className="w-8 h-8 text-[var(--color-text-secondary)]" /> : <Package className="w-8 h-8 text-[var(--color-text-secondary)]" />}
      </div>
      <h2 className="text-xl font-medium text-[var(--color-text-primary)] mb-2">
        {type === 'purchased' ? 'No purchases yet' : 'Start building your digital wardrobe'}
      </h2>
      <p className="text-[var(--color-text-secondary)] text-center mb-6">
        {type === 'purchased' ? 'Items you buy will appear here' : 'Add your clothes to get AI-powered outfit suggestions and perfect-fit recommendations'}
      </p>
      {type !== 'purchased' && onTakePhoto && onUploadImage && (
        <div className="flex gap-3">
          <button
            onClick={onTakePhoto}
            disabled={uploading}
            className="flex items-center gap-2 px-5 py-3 bg-[var(--color-text-primary)] text-[var(--color-background)] rounded-xl font-medium select-none"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            Take Photo
          </button>
          <button
            onClick={onUploadImage}
            disabled={uploading}
            className="flex items-center gap-2 px-5 py-3 bg-[var(--color-text-primary)] text-[var(--color-background)] rounded-xl font-medium select-none"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
            Upload
          </button>
        </div>
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
      className="relative aspect-square rounded-xl overflow-hidden bg-[var(--color-placeholder)] group"
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
    completed: 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]'
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: idx * 0.05 }}
      className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm"
    >
      <div className="flex gap-4">
        <div className="w-20 h-20 rounded-xl bg-[var(--color-placeholder)] overflow-hidden shrink-0">
          {item.product_image ? (
            <img 
              src={item.product_image}
              alt={item.product_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-6 h-6 text-[var(--color-text-secondary)]" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-[var(--color-text-primary)] truncate">{item.product_name}</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Size: {item.size} {item.color && `• ${item.color}`}
          </p>
          
          <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-secondary)]">
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
          <p className="font-semibold text-[var(--color-text-primary)]">${item.product_price?.toFixed(2)}</p>
          <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs capitalize ${statusColors[item.status] || statusColors.completed}`}>
            {item.status || 'completed'}
          </span>
        </div>
      </div>
      
      {item.vendor_name && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border-light)] flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <MapPin className="w-4 h-4" />
          {item.vendor_name}
        </div>
      )}
    </motion.div>
  );
}

export default function Closet() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [ownedItems, setOwnedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [editingItem, setEditingItem] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = useCallback(async () => {
    await loadData();
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
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });

        const analysisRes = await base44.functions.invoke('analyzeClothingItem', { file_url });
        const analysis = analysisRes.data || {};

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
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-[var(--color-text-primary)] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen bg-[var(--color-background)] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--color-background)]/95 backdrop-blur-lg px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-[var(--color-surface)] shadow-sm flex items-center justify-center select-none"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--color-text-primary)]" />
            </button>
            <div>
              <h1 className="text-2xl font-light text-[var(--color-text-primary)]">My Closet</h1>
              <p className="text-sm text-[var(--color-text-secondary)]">{totalItems} items</p>
            </div>
          </div>
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

      {/* Tabs */}
      <div className="px-6 pt-4">
        <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start gap-2 bg-transparent h-auto mb-6 overflow-x-auto no-scrollbar">
            <TabsTrigger 
              value="all"
              className="rounded-full px-4 py-2 data-[state=active]:bg-[var(--color-text-primary)] data-[state=active]:text-[var(--color-background)]"
            >
              All ({totalItems})
            </TabsTrigger>
            <TabsTrigger 
              value="owned"
              className="rounded-full px-4 py-2 data-[state=active]:bg-[var(--color-text-primary)] data-[state=active]:text-[var(--color-background)]"
            >
              My Items ({ownedItems.length})
            </TabsTrigger>
            <TabsTrigger 
              value="purchased"
              className="rounded-full px-4 py-2 data-[state=active]:bg-[var(--color-text-primary)] data-[state=active]:text-[var(--color-background)]"
            >
              Purchased ({purchases.length})
            </TabsTrigger>
            
            {/* Add Items Button */}
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-text-primary)] text-[var(--color-background)] rounded-full text-sm font-medium select-none"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-text-primary)] text-[var(--color-background)] rounded-full text-sm font-medium select-none"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                Upload
              </button>
            </div>
          </TabsList>

          <TabsContent value="all">
            {totalItems === 0 ? (
              <EmptyState onTakePhoto={() => cameraInputRef.current?.click()} onUploadImage={() => fileInputRef.current?.click()} uploading={uploading} />
            ) : (
              <>
                {ownedItems.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">My Items</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {ownedItems.map((item, idx) => (
                        <OwnedItemCard key={item.id} item={item} idx={idx} onRemove={removeItem} onEdit={setEditingItem} />
                      ))}
                    </div>
                  </div>
                )}
                {purchases.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Purchased</h3>
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
              <EmptyState onTakePhoto={() => cameraInputRef.current?.click()} onUploadImage={() => fileInputRef.current?.click()} uploading={uploading} type="owned" />
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
    </PullToRefresh>
  );
}