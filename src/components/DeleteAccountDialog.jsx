import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function DeleteAccountDialog({ isOpen, onClose, onConfirm, userEmail }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  // Render at document root so layout opacity/transforms never wash out the dialog.
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center px-4 py-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          aria-describedby="delete-account-description"
          className="w-full max-w-md max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 text-black shadow-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <button
              onClick={onClose}
              type="button"
              aria-label="Close account deletion dialog"
              className="w-10 h-10 rounded-full bg-gray-100 text-black flex items-center justify-center"
            >
              <X className="w-5 h-5 text-black" />
            </button>
          </div>

          <h2 id="delete-account-title" className="text-xl font-semibold text-black mb-2">
            Delete Account
          </h2>
          <p id="delete-account-description" className="text-base leading-relaxed text-gray-900 mb-6">
            This permanently deletes your Concierge records and your Base44 sign-in account, including your profile, closet, wishlist, cart, purchase history, check-ins, payment metadata, reviews, feedback, and friend connections. Base44 does not currently expose an SDK method to purge previously uploaded files from storage, so uploaded images may require separate platform-level removal.
          </p>

          <div className="mb-6">
            <p className="text-sm font-medium text-black mb-2">
              Type <span className="font-mono font-semibold text-red-600">DELETE</span> to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="DELETE"
              aria-label="Type DELETE to confirm account deletion"
              className="h-12 rounded-xl border border-gray-400 !bg-white !text-black placeholder:!text-gray-500"
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-12 rounded-xl border border-gray-400 !bg-white !text-black"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || deleting}
              className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Delete Account'
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}