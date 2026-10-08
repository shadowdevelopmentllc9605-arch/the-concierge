import { authClient } from '@/api/authClient';
import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, User, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import ConciergeGuide from './ConciergeGuide';

export default function ProfileSetup({ user, profile, concierge, onComplete }) {
  const [name, setName] = useState(user?.full_name || profile?.name || '');
  const [birthday, setBirthday] = useState(profile?.birthday || '');
  const [picture, setPicture] = useState(profile?.profile_picture || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPicture(file_url);
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name) return;
    setSaving(true);
    
    try {
      // Update user's full_name
      if (name !== user?.full_name) {
        await authClient.updateMe({ full_name: name });
      }
      
      await onComplete({ 
        birthday, 
        profile_picture: picture 
      });
    } finally {
      setSaving(false);
    }
  };

  const guideMessage = "Perfect! Let's start with the basics. Tell me a bit about yourself.";

  return (
    <div className="max-w-md mx-auto">
      <ConciergeGuide concierge={concierge} message={guideMessage} />
      
      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-4xl font-light text-[#2d2d2d] mb-2"
      >
        Let's get to
        <br />know you
      </motion.h1>
      <motion.p 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-[#6b7280] mb-10"
      >
        Set up your profile to personalize your experience
      </motion.p>

      {/* Profile Picture */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex justify-center mb-8"
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="relative w-32 h-32 rounded-full bg-[#e5e7eb] overflow-hidden group shadow-lg"
        >
          {picture ? (
            <img src={picture} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-12 h-12 text-[#9ca3af]" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Camera className="w-6 h-6 text-white" />
            )}
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </motion.div>

      {/* Form Fields */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-6"
      >
        <div>
          <Label className="text-[#6b7280] text-xs tracking-[0.1em] uppercase mb-2 block">
            Your Name
          </Label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9ca3af]" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="bg-white border-[#e5e7eb] text-[#2d2d2d] placeholder:text-[#9ca3af] h-14 pl-12 rounded-xl focus:ring-1 focus:ring-[#c9a962] focus:border-[#c9a962]"
            />
          </div>
        </div>

        <div>
          <Label className="text-[#6b7280] text-xs tracking-[0.1em] uppercase mb-2 block">
            Birthday
          </Label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9ca3af]" />
            <Input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="bg-white border-[#e5e7eb] text-[#2d2d2d] h-14 pl-12 rounded-xl focus:ring-1 focus:ring-[#c9a962] focus:border-[#c9a962]"
            />
          </div>
        </div>
      </motion.div>

      {/* Continue Button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-10"
      >
        <Button
          onClick={handleSubmit}
          disabled={!name || saving}
          className="w-full h-14 bg-[#c9a962] hover:bg-[#b8944d] text-white rounded-xl font-medium text-base"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Continue
              <ArrowRight className="ml-2 w-5 h-5" />
            </>
          )}
        </Button>
      </motion.div>
    </div>
  );
}