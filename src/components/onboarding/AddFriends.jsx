import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Mail, X, UserPlus, Loader2, Check } from 'lucide-react';

export default function AddFriends({ user, onComplete }) {
  const [email, setEmail] = useState('');
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const addFriend = async () => {
    if (!email || friends.find(f => f.email === email)) return;
    if (email === user?.email) return;
    
    setLoading(true);
    try {
      // Check if user exists
      const users = await base44.entities.User.filter({ email });
      
      const friendData = {
        email,
        name: users.length > 0 ? users[0].full_name : email.split('@')[0],
        exists: users.length > 0
      };
      
      setFriends(prev => [...prev, friendData]);
      setEmail('');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const removeFriend = (email) => {
    setFriends(prev => prev.filter(f => f.email !== email));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // Create friend requests for existing users
      for (const friend of friends) {
        if (friend.exists) {
          const existingUsers = await base44.entities.User.filter({ email: friend.email });
          if (existingUsers.length > 0) {
            await base44.entities.Friend.create({
              user_id: user.id,
              friend_user_id: existingUsers[0].id,
              friend_name: existingUsers[0].full_name,
              friend_picture: existingUsers[0].profile_picture,
              status: 'pending'
            });
          }
        }
      }
      
      await onComplete({});
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await onComplete({});
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-4xl font-light text-white mb-2"
      >
        Add Friends
      </motion.h1>
      <motion.p 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-white/60 mb-8"
      >
        Share wishlists and get gift suggestions
      </motion.p>

      {/* Email Input */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex gap-2 mb-6"
      >
        <div className="relative flex-1">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addFriend()}
            placeholder="Enter friend's email"
            className="bg-white/10 border-0 text-white placeholder:text-white/30 h-14 pl-12 rounded-xl focus:ring-1 focus:ring-[#c9a962]"
          />
        </div>
        <Button
          onClick={addFriend}
          disabled={!email || loading}
          className="h-14 w-14 bg-[#c9a962] hover:bg-[#b8944d] rounded-xl p-0"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#1a1a1a]" />
          ) : (
            <UserPlus className="w-5 h-5 text-[#1a1a1a]" />
          )}
        </Button>
      </motion.div>

      {/* Friends List */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-2 mb-8 min-h-[160px]"
      >
        {friends.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-white/30">
            <UserPlus className="w-10 h-10 mb-3" />
            <p className="text-sm">No friends added yet</p>
          </div>
        ) : (
          friends.map((friend, idx) => (
            <motion.div
              key={friend.email}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-center justify-between bg-white/10 rounded-xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-white font-medium">
                    {friend.name[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{friend.name}</p>
                  <p className="text-white/40 text-xs">{friend.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {friend.exists && (
                  <span className="text-[#c9a962] text-xs flex items-center gap-1">
                    <Check className="w-3 h-3" /> On app
                  </span>
                )}
                <button
                  onClick={() => removeFriend(friend.email)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Buttons */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full h-14 bg-[#c9a962] hover:bg-[#b8944d] text-[#1a1a1a] rounded-xl font-medium text-base"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {friends.length > 0 ? 'Continue' : 'Start Shopping'}
              <ArrowRight className="ml-2 w-5 h-5" />
            </>
          )}
        </Button>
        {friends.length === 0 && (
          <button
            onClick={handleSkip}
            disabled={saving}
            className="w-full text-white/40 text-sm hover:text-white/60 transition-colors"
          >
            Skip for now
          </button>
        )}
      </motion.div>
    </div>
  );
}