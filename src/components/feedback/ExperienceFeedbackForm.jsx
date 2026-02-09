import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Store, Star, Loader2, ThumbsUp, ThumbsDown, User, Smartphone } from 'lucide-react';

export default function ExperienceFeedbackForm({ purchase, user, onComplete, onSkip }) {
  const [overallRating, setOverallRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [appExperienceRating, setAppExperienceRating] = useState(0);
  const [employeeRating, setEmployeeRating] = useState(0);
  const [wouldReturn, setWouldReturn] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (overallRating === 0) return;

    setSubmitting(true);
    try {
      await base44.entities.ShoppingExperience.create({
        user_id: user.id,
        vendor_id: purchase.vendor_id,
        vendor_name: purchase.vendor_name,
        experience_type: purchase.purchase_type,
        overall_rating: overallRating,
        service_rating: serviceRating,
        app_experience_rating: appExperienceRating,
        employee_rating: employeeRating,
        feedback_text: feedbackText,
        would_return: wouldReturn,
        purchase_id: purchase.id
      });
      onComplete();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const RatingRow = ({ icon: Icon, label, value, onChange }) => (
    <div className="flex items-center justify-between py-3 border-b border-[#f5f5f0] last:border-0">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-[#64748b]" />
        <span className="text-sm text-[#1a1a1a]">{label}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} onClick={() => onChange(star)}>
            <Star className={`w-5 h-5 ${star <= value ? 'text-[#c9a962] fill-current' : 'text-[#e5e5e5]'}`} />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-[#1a1a1a] rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
            <Store className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-medium text-white">{purchase.vendor_name || 'Store'}</h2>
            <p className="text-white/60 text-sm">Rate your shopping experience</p>
          </div>
        </div>
      </div>

      {/* Overall Rating */}
      <div className="bg-white rounded-2xl p-6 text-center">
        <h3 className="font-medium text-[#1a1a1a] mb-4">Overall Experience</h3>
        <div className="flex justify-center gap-2 mb-2">
          {[1, 2, 3, 4, 5].map(star => (
            <button key={star} onClick={() => setOverallRating(star)} className="p-1">
              <Star 
                className={`w-10 h-10 transition-colors ${
                  star <= overallRating ? 'text-[#c9a962] fill-current' : 'text-[#e5e5e5]'
                }`}
              />
            </button>
          ))}
        </div>
        <p className="text-sm text-[#64748b]">
          {overallRating === 0 ? 'Tap to rate' : ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][overallRating]}
        </p>
      </div>

      {/* Detailed Ratings */}
      <div className="bg-white rounded-2xl p-6">
        <h3 className="font-medium text-[#1a1a1a] mb-4">Rate the details</h3>
        <RatingRow icon={User} label="Staff Service" value={serviceRating} onChange={setServiceRating} />
        <RatingRow icon={Smartphone} label="App Experience" value={appExperienceRating} onChange={setAppExperienceRating} />
        {purchase.assigned_employee_name && (
          <RatingRow icon={User} label={`${purchase.assigned_employee_name}'s Help`} value={employeeRating} onChange={setEmployeeRating} />
        )}
      </div>

      {/* Would Return */}
      <div className="bg-white rounded-2xl p-6">
        <h3 className="font-medium text-[#1a1a1a] mb-4">Would you shop here again?</h3>
        <div className="flex gap-3">
          <button
            onClick={() => setWouldReturn(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors ${
              wouldReturn === true ? 'bg-green-100 text-green-700' : 'bg-[#f5f5f0] text-[#64748b]'
            }`}
          >
            <ThumbsUp className="w-5 h-5" />
            Definitely
          </button>
          <button
            onClick={() => setWouldReturn(false)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors ${
              wouldReturn === false ? 'bg-red-100 text-red-700' : 'bg-[#f5f5f0] text-[#64748b]'
            }`}
          >
            <ThumbsDown className="w-5 h-5" />
            Unlikely
          </button>
        </div>
      </div>

      {/* Additional Feedback */}
      <div className="bg-white rounded-2xl p-6">
        <h3 className="font-medium text-[#1a1a1a] mb-4">Additional Comments (Optional)</h3>
        <Textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Tell us more about your experience..."
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
          disabled={overallRating === 0 || submitting}
          className="flex-1 h-14 rounded-xl bg-[#1a1a1a] hover:bg-[#2a2a2a]"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit'}
        </Button>
      </div>
    </motion.div>
  );
}