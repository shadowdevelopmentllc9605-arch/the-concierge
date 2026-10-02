import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, Loader2 } from 'lucide-react';
import PendingReviewCard from '@/components/feedback/PendingReviewCard';
import ProductReviewForm from '@/components/feedback/ProductReviewForm';
import AIFeedbackForm from '@/components/feedback/AIFeedbackForm';
import ExperienceFeedbackForm from '@/components/feedback/ExperienceFeedbackForm';

export default function Feedback() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const purchaseId = urlParams.get('purchase');
  const feedbackType = urlParams.get('type') || 'product';

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [currentStep, setCurrentStep] = useState('select'); // select, product, ai, experience

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Get purchases without reviews
      const purchases = await base44.entities.Purchase.filter({ 
        user_id: currentUser.id 
      }, '-created_date', 20);

      const reviews = await base44.entities.ProductReview.filter({ 
        user_id: currentUser.id 
      });
      const reviewedProductIds = reviews.map(r => r.product_id);

      const pending = purchases.filter(p => !reviewedProductIds.includes(p.product_id));
      setPendingReviews(pending);

      // If specific purchase requested
      if (purchaseId) {
        const purchase = purchases.find(p => p.id === purchaseId);
        if (purchase) {
          setSelectedPurchase(purchase);
          setCurrentStep(feedbackType);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPurchase = (purchase) => {
    setSelectedPurchase(purchase);
    setCurrentStep('product');
  };

  const handleProductReviewComplete = () => {
    setCurrentStep('ai');
  };

  const handleAIFeedbackComplete = () => {
    if (selectedPurchase?.purchase_type === 'in_store') {
      setCurrentStep('experience');
    } else {
      handleAllComplete();
    }
  };

  const handleAllComplete = () => {
    setPendingReviews(prev => prev.filter(p => p.id !== selectedPurchase?.id));
    setSelectedPurchase(null);
    setCurrentStep('select');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#fafafa]/95 backdrop-blur-lg px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (currentStep !== 'select') {
                setCurrentStep('select');
                setSelectedPurchase(null);
              } else {
                navigate(-1);
              }
            }}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-[#1a1a1a]" />
          </button>
          <div>
            <h1 className="text-2xl font-light text-[#1a1a1a]">Feedback</h1>
            <p className="text-sm text-[#64748b]">
              {currentStep === 'select' && `${pendingReviews.length} items to review`}
              {currentStep === 'product' && 'Rate your purchase'}
              {currentStep === 'ai' && 'AI & Try-On feedback'}
              {currentStep === 'experience' && 'Shopping experience'}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pt-4">
        {currentStep === 'select' && (
          <>
            {pendingReviews.length === 0 ? (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center py-20"
              >
                <div className="w-20 h-20 rounded-full bg-[#f5f5f0] flex items-center justify-center mx-auto mb-6">
                  <Package className="w-8 h-8 text-[#64748b]" />
                </div>
                <h2 className="text-xl font-medium text-[#1a1a1a] mb-2">All caught up!</h2>
                <p className="text-[#64748b]">No pending reviews at the moment</p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {pendingReviews.map((purchase, idx) => (
                  <PendingReviewCard
                    key={purchase.id}
                    purchase={purchase}
                    index={idx}
                    onSelect={() => handleSelectPurchase(purchase)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {currentStep === 'product' && selectedPurchase && (
          <ProductReviewForm
            purchase={selectedPurchase}
            user={user}
            onComplete={handleProductReviewComplete}
            onSkip={handleProductReviewComplete}
          />
        )}

        {currentStep === 'ai' && selectedPurchase && (
          <AIFeedbackForm
            purchase={selectedPurchase}
            user={user}
            onComplete={handleAIFeedbackComplete}
            onSkip={handleAIFeedbackComplete}
          />
        )}

        {currentStep === 'experience' && selectedPurchase && (
          <ExperienceFeedbackForm
            purchase={selectedPurchase}
            user={user}
            onComplete={handleAllComplete}
            onSkip={handleAllComplete}
          />
        )}
      </div>
    </div>
  );
}