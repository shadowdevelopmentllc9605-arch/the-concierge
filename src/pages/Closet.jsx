import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Package, Calendar, Store, MapPin } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from 'date-fns';

export default function Closet() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    try {
      const user = await base44.auth.me();
      const userPurchases = await base44.entities.Purchase.filter({ user_id: user.id }, '-created_date');
      setPurchases(userPurchases);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const groupByCategory = () => {
    const grouped = {};
    purchases.forEach(p => {
      const cat = p.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    return grouped;
  };

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

  const groupedPurchases = groupByCategory();

  return (
    <div className="min-h-screen bg-[#fafafa] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#fafafa]/95 backdrop-blur-lg px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-[#1a1a1a]" />
          </button>
          <div>
            <h1 className="text-2xl font-light text-[#1a1a1a]">My Closet</h1>
            <p className="text-sm text-[#64748b]">{purchases.length} items purchased</p>
          </div>
        </div>
      </div>

      {purchases.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] px-6">
          <div className="w-20 h-20 rounded-full bg-[#f5f5f0] flex items-center justify-center mb-6">
            <Package className="w-8 h-8 text-[#64748b]" />
          </div>
          <h2 className="text-xl font-medium text-[#1a1a1a] mb-2">No purchases yet</h2>
          <p className="text-[#64748b] text-center mb-8">Items you buy will appear here</p>
        </div>
      ) : (
        <div className="px-6 pt-4">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full justify-start gap-2 bg-transparent h-auto mb-6 overflow-x-auto no-scrollbar">
              <TabsTrigger 
                value="all"
                className="rounded-full px-4 py-2 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white"
              >
                All
              </TabsTrigger>
              {Object.keys(groupedPurchases).map(cat => (
                <TabsTrigger 
                  key={cat}
                  value={cat}
                  className="rounded-full px-4 py-2 data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white capitalize whitespace-nowrap"
                >
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all">
              <div className="space-y-4">
                {purchases.map((item, idx) => (
                  <PurchaseCard key={item.id} item={item} idx={idx} />
                ))}
              </div>
            </TabsContent>

            {Object.entries(groupedPurchases).map(([cat, items]) => (
              <TabsContent key={cat} value={cat}>
                <div className="space-y-4">
                  {items.map((item, idx) => (
                    <PurchaseCard key={item.id} item={item} idx={idx} />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </div>
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