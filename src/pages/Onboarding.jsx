import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ProfileSetup from '@/components/onboarding/ProfileSetup';
import BodyScan from '@/components/onboarding/BodyScan';
import StylePreferences from '@/components/onboarding/StylePreferences';
import AddFriends from '@/components/onboarding/AddFriends';

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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
        setStep(profiles[0].onboarding_step || 1);
        
        if (profiles[0].onboarding_completed) {
          navigate(createPageUrl('Home'));
          return;
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStepComplete = async (stepData) => {
    try {
      const nextStep = step + 1;
      const isComplete = nextStep > 4;
      
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
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-[#c9a962] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const steps = [
    { component: ProfileSetup, title: 'Your Profile' },
    { component: BodyScan, title: 'Body Scan' },
    { component: StylePreferences, title: 'Your Style' },
    { component: AddFriends, title: 'Add Friends' },
  ];

  const CurrentStepComponent = steps[step - 1].component;

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 pt-6">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-[#c9a962]' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
        <p className="text-white/60 text-xs mt-4 tracking-[0.2em] uppercase">
          Step {step} of 4 • {steps[step - 1].title}
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
            onComplete={handleStepComplete}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}