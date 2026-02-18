import React, { useState } from 'react';
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[var(--color-surface)] rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center"
            >
              <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>
          </div>

          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            Delete Account
          </h2>
          <p className="text-[var(--color-text-secondary)] text-sm mb-6">
            This action is permanent and cannot be undone. All your data, including your closet items, wishlist, and purchase history will be permanently deleted.
          </p>

          <div className="mb-6">
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">
              Type <span className="font-mono font-semibold text-red-600">DELETE</span> to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="DELETE"
              className="h-12 rounded-xl border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-12 rounded-xl border-[var(--color-border)]"
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
    </AnimatePresence>
  );
}