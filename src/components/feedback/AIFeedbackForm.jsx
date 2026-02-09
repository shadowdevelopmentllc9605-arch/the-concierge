import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Shirt, Ruler, Star, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';

export default function AIFeedbackForm({ purchase, user, onComplete, onSkip }) {
  const [sizeSuggestionAccurate, setSizeSuggestionAccurate] = useState(null);
  const [actualSizeNeeded, setActualSizeNeeded] = useState('');
  const [tryOnAccuracy, setTryOnAccuracy] = useState(0);
  const [recommendationRelevance, setRecommendationRelevance] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Submit size feedback
      if (sizeSuggestionAccurate !== null) {
        await base44.entities.AIFeedback.create({
          user_id: user.id,
          feedback_type: 'size_suggestion',
          product_id: purchase.product_id,
          rating: sizeSuggestionAccurate ? 5 : 2,
          accuracy_rating: sizeSuggestionAccurate ? 5 : 2,
          was_helpful: sizeSuggestionAccurate,
          suggested_size: purchase.size,
          actual_size_needed: actualSizeNeeded || purchase.size,
          feedback_text: feedbackText
        });
      }

      // Submit try-on feedback
      if (tryOnAccuracy > 0) {
        await base44.entities.AIFeedback.create({
          user_id: user.id,
          feedback_type: 'try_on',
          product_id: purchase.product_id,
          rating: tryOnAccuracy,
          accuracy_rating: tryOnAccuracy,
          was_helpful: tryOnAccuracy >= 3
        });
      }

      // Submit recommendation feedback
      if (recommendationRelevance > 0) {
        await base44.entities.AIFeedback.create({
          user_id: user.id,
          feedback_type: 'recommendation',
          product_id: purchase.product_id,
          rating: recommendationRelevance,
          accuracy_rating: recommendationRelevance,
          was_helpful: recommendationRelevance >= 3
        });
      }

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
      {/* Header */}
      <div className="bg-[#1a1a1a] rounded-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-[#c9a962]/20 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7 text-[#c9a962]" />
        </div>
        <h2 className="text-xl font-medium text-white mb-1">AI Feedback</h2>
        <p className="text-white/60 text-sm">Help us improve our recommendations</p>
      </div>

      {/* Size Suggestion Accuracy */}
      <div className="bg-white rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Ruler className="w-5 h-5 text-[#c9a962]" />
          <h3 className="font-medium text-[#1a1a1a]">Size Suggestion</h3>
        </div>
        <p className="text-sm text-[#64748b] mb-4">
          We suggested size <span className="font-semibold text-[#1a1a1a]">{purchase.size}</span>. Was it accurate?
        </p>
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setSizeSuggestionAccurate(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors ${
              sizeSuggestionAccurate === true ? 'bg-green-100 text-green-700' : 'bg-[#f5f5f0] text-[#64748b]'
            }`}
          >
            <ThumbsUp className="w-5 h-5" />
            Perfect!
          </button>
          <button
            onClick={() => setSizeSuggestionAccurate(false)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors ${
              sizeSuggestionAccurate === false ? 'bg-red-100 text-red-700' : 'bg-[#f5f5f0] text-[#64748b]'
            }`}
          >
            <ThumbsDown className="w-5 h-5" />
            Not quite
          </button>
        </div>

        {sizeSuggestionAccurate === false && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
          >
            <p className="text-sm text-[#64748b] mb-2">What size did you actually need?</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map(size => (
                <button
                  key={size}
                  onClick={() => setActualSizeNeeded(size)}
                  className={`px-4 py-2 rounded-full text-sm transition-colors ${
                    actualSizeNeeded === size
                      ? 'bg-[#1a1a1a] text-white'
                      : 'bg-[#f5f5f0] text-[#1a1a1a]'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Virtual Try-On Accuracy */}
      <div className="bg-white rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shirt className="w-5 h-5 text-[#c9a962]" />
          <h3 className="font-medium text-[#1a1a1a]">Virtual Try-On</h3>
        </div>
        <p className="text-sm text-[#64748b] mb-4">
          How accurate was the virtual try-on preview?
        </p>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map(star => (
            <button key={star} onClick={() => setTryOnAccuracy(star)} className="p-1">
              <Star 
                className={`w-8 h-8 transition-colors ${
                  star <= tryOnAccuracy ? 'text-[#c9a962] fill-current' : 'text-[#e5e5e5]'
                }`}
              />
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-[#64748b] mt-2">
          {tryOnAccuracy === 0 ? 'Tap to rate' : ['', 'Very inaccurate', 'Somewhat off', 'Okay', 'Pretty close', 'Spot on!'][tryOnAccuracy]}
        </p>
      </div>

      {/* Recommendation Relevance */}
      <div className="bg-white rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-5 h-5 text-[#c9a962]" />
          <h3 className="font-medium text-[#1a1a1a]">AI Recommendations</h3>
        </div>
        <p className="text-sm text-[#64748b] mb-4">
          How relevant were our style recommendations?
        </p>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map(star => (
            <button key={star} onClick={() => setRecommendationRelevance(star)} className="p-1">
              <Star 
                className={`w-8 h-8 transition-colors ${
                  star <= recommendationRelevance ? 'text-[#c9a962] fill-current' : 'text-[#e5e5e5]'
                }`}
              />
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-[#64748b] mt-2">
          {recommendationRelevance === 0 ? 'Tap to rate' : ['', 'Not my style', 'Rarely matched', 'Sometimes good', 'Usually great', 'Perfect taste!'][recommendationRelevance]}
        </p>
      </div>

      {/* Additional Feedback */}
      <div className="bg-white rounded-2xl p-6">
        <h3 className="font-medium text-[#1a1a1a] mb-4">Additional Feedback (Optional)</h3>
        <Textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Any suggestions to improve our AI features?"
          className="min-h-[100px] resize-none"
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
          disabled={submitting}
          className="flex-1 h-14 rounded-xl bg-[#1a1a1a] hover:bg-[#2a2a2a]"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
        </Button>
      </div>
    </motion.div>
  );
}