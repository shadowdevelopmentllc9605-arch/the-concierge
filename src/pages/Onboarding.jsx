import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ConciergeIntro from '@/components/onboarding/ConciergeIntro';
import ProfileSetup from '@/components/onboarding/ProfileSetup';
import BodyScan from '@/components/onboarding/BodyScan';
import StylePreferences from '@/components/onboarding/StylePreferences';
import ClosetUpload from '@/components/onboarding/ClosetUpload';
import AddFriends from '@/components/onboarding/AddFriends';

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // Start at 0 for intro
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedConcierge, setSelectedConcierge] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const profiles = await base44.entities.UserProfile.filter({ user_id: currentUser.id });
      if (profiles.length > 0) {
        setProfile(profiles[0]);
        if (profiles[0].onboarding_completed) {
          navigate(createPageUrl('Home'));
          return;
        }
        // If returning user, skip intro
        if (profiles[0].onboarding_step > 0) {
          setStep(profiles[0].onboarding_step);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleIntroComplete = () => {
    setStep(1);
  };

  const handleStepComplete = async (stepData) => {
    try {
      const nextStep = step + 1;
      const isComplete = nextStep > 5;
      
      const updateData = {
        ...stepData,
        onboarding_step: nextStep,
        onboarding_completed: isComplete
      };

      if (profile) {
        await base44.entities.UserProfile.update(profile.id, updateData);
        setProfile({ ...profile, ...updateData });
      } else {
        const newProfile = await base44.entities.UserProfile.create({
          user_id: user.id,
          ...updateData
        });
        setProfile(newProfile);
      }

      if (isComplete) {
        navigate(createPageUrl('Home'));
      } else {
        setStep(nextStep);
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#faf8f5] to-[#f5f0ea] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-[#c9a962] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const steps = [
    { component: ProfileSetup, title: 'Your Profile', guideMessage: "Perfect! Let's start with the basics. Tell me a bit about yourself." },
    { component: BodyScan, title: 'Body Scan', guideMessage: "Now I'll need to see how clothes will fit you. Let's capture your measurements." },
    { component: StylePreferences, title: 'Your Style', guideMessage: "Excellent! Now tell me about your style preferences. What looks speak to you?" },
    { component: ClosetUpload, title: 'Your Closet', guideMessage: "Let's see what you already have! This helps me understand your taste better." },
    { component: AddFriends, title: 'Add Friends', guideMessage: "Almost done! Would you like to connect with friends to share style inspiration?" },
  ];

  // Handle intro step
  if (step === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#faf8f5] to-[#f5f0ea]">
        <div className="pt-20 pb-8 px-6">
          <ConciergeIntro 
            user={user}
            onComplete={handleIntroComplete}
            onSelectConcierge={setSelectedConcierge}
          />
        </div>
      </div>
    );
  }

  const CurrentStepComponent = steps[step - 1].component;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#faf8f5] to-[#f5f0ea]">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 pt-6 bg-gradient-to-b from-[#faf8f5] to-transparent pb-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <div 
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-[#c9a962]' : 'bg-[#d1d5db]/50'
              }`}
            />
          ))}
        </div>
        <p className="text-[#6b7280] text-xs mt-4 tracking-[0.2em] uppercase">
          Step {step} of 5 • {steps[step - 1].title}
        </p>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="pt-24 pb-8 px-6"
        >
          <CurrentStepComponent 
            user={user}
            profile={profile}
            concierge={selectedConcierge}
            onComplete={handleStepComplete}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}