import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Camera, X, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';

export default function ProductReviewForm({ purchase, user, onComplete, onSkip }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [fitRating, setFitRating] = useState('');
  const [qualityRating, setQualityRating] = useState(0);
  const [valueRating, setValueRating] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const fitOptions = [
    { value: 'too_small', label: 'Too Small' },
    { value: 'slightly_small', label: 'Slightly Small' },
    { value: 'perfect', label: 'Perfect Fit' },
    { value: 'slightly_large', label: 'Slightly Large' },
    { value: 'too_large', label: 'Too Large' }
  ];

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setPhotos(prev => [...prev, file_url]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (rating === 0) return;

    setSubmitting(true);
    try {
      await base44.entities.ProductReview.create({
        user_id: user.id,
        user_name: user.full_name,
        user_picture: user.profile_picture,
        product_id: purchase.product_id,
        product_name: purchase.product_name,
        purchase_id: purchase.id,
        vendor_id: purchase.vendor_id,
        rating,
        review_text: reviewText,
        fit_rating: fitRating,
        quality_rating: qualityRating,
        value_rating: valueRating,
        would_recommend: wouldRecommend,
        photos,
        helpful_count: 0
      });
      onComplete();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="space-y-6"
    >
      {/* Product Info */}
      <div className="flex items-center gap-4 bg-white rounded-2xl p-4">
        <div className="w-16 h-16 rounded-xl bg-[#e5e5e5] overflow-hidden">
          {purchase.product_image && (
            <img src={purchase.product_image} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div>
          <h3 className="font-medium text-[#1a1a1a]">{purchase.product_name}</h3>
          <p className="text-sm text-[#64748b]">Size: {purchase.size}</p>
        </div>
      </div>

      {/* Overall Rating */}
      <div className="bg-white rounded-2xl p-6">
        <h3 className="font-medium text-[#1a1a1a] mb-4">Overall Rating</h3>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              className="p-1"
            >
              <Star 
                className={`w-10 h-10 transition-colors ${
                  star <= (hoverRating || rating)
                    ? 'text-[#c9a962] fill-current'
                    : 'text-[#e5e5e5]'
                }`}
              />
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-[#64748b] mt-2">
          {rating === 0 ? 'Tap to rate' : ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
        </p>
      </div>

      {/* Fit Rating */}
      <div className="bg-white rounded-2xl p-6">
        <h3 className="font-medium text-[#1a1a1a] mb-4">How did it fit?</h3>
        <div className="flex flex-wrap gap-2">
          {fitOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFitRating(opt.value)}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                fitRating === opt.value
                  ? 'bg-[#1a1a1a] text-white'
                  : 'bg-[#f5f5f0] text-[#1a1a1a]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quality & Value */}
      <div className="bg-white rounded-2xl p-6 space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-[#64748b]">Quality</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setQualityRating(star)}>
                  <Star className={`w-5 h-5 ${star <= qualityRating ? 'text-[#c9a962] fill-current' : 'text-[#e5e5e5]'}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-[#64748b]">Value for Money</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setValueRating(star)}>
                  <Star className={`w-5 h-5 ${star <= valueRating ? 'text-[#c9a962] fill-current' : 'text-[#e5e5e5]'}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Would Recommend */}
      <div className="bg-white rounded-2xl p-6">
        <h3 className="font-medium text-[#1a1a1a] mb-4">Would you recommend this?</h3>
        <div className="flex gap-3">
          <button
            onClick={() => setWouldRecommend(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors ${
              wouldRecommend === true ? 'bg-green-100 text-green-700' : 'bg-[#f5f5f0] text-[#64748b]'
            }`}
          >
            <ThumbsUp className="w-5 h-5" />
            Yes
          </button>
          <button
            onClick={() => setWouldRecommend(false)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors ${
              wouldRecommend === false ? 'bg-red-100 text-red-700' : 'bg-[#f5f5f0] text-[#64748b]'
            }`}
          >
            <ThumbsDown className="w-5 h-5" />
            No
          </button>
        </div>
      </div>

      {/* Written Review */}
      <div className="bg-white rounded-2xl p-6">
        <h3 className="font-medium text-[#1a1a1a] mb-4">Write a Review (Optional)</h3>
        <Textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="Share your experience with this product..."
          className="min-h-[120px] resize-none"
        />
      </div>

      {/* Photo Upload */}
      <div className="bg-white rounded-2xl p-6">
        <h3 className="font-medium text-[#1a1a1a] mb-4">Add Photos (Optional)</h3>
        <div className="flex flex-wrap gap-3">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden">
              <img src={photo} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(idx)}
                className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-[#e5e5e5] flex items-center justify-center"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-[#64748b]" />
            ) : (
              <Camera className="w-6 h-6 text-[#64748b]" />
            )}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoUpload}
          className="hidden"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pb-6">
        <Button
          variant="outline"
          onClick={onSkip}
          className="flex-1 h-14 rounded-xl"
        >
          Skip
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="flex-1 h-14 rounded-xl bg-[#1a1a1a] hover:bg-[#2a2a2a]"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Review'}
        </Button>
      </div>
    </motion.div>
  );
}