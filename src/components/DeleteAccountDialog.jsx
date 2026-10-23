import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Mail } from 'lucide-react';
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = 'shadowdevelopmentllc9605@gmail.com';

export default function DeleteAccountDialog({ isOpen, onClose, userEmail }) {
  if (!isOpen) return null;

  // No automated deletion endpoint has been approved. The existing backend
  // rejects deletion requests; do not claim data was erased or call it here.
  const subject = 'The Concierge — account deletion request';
  const body = [
    'Hello Shadow Development LLC,',
    '',
    'I would like to request deletion of my The Concierge shopper account.',
    userEmail ? 'Account email: ' + userEmail : 'Account email: (please enter)',
    '',
    'Please tell me how to verify my identity and what information can be',
    'removed or must be retained for legal, payment, and order obligations.',
    '',
    'I understand this email is a request, not confirmation of deletion.'
  ].join('\n');
  const mailto = 'mailto:' + SUPPORT_EMAIL +
    '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body);

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
          initial={{ y: 70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 70, opacity: 0 }}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-request-title"
          aria-describedby="delete-request-description"
          className="w-full max-w-md max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 text-black shadow-2xl"
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-700" aria-hidden="true" />
            </div>
            <button type="button" onClick={onClose}
              aria-label="Close account deletion request"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-black">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <h2 id="delete-request-title" className="mb-3 text-xl font-semibold text-black">
            Request Account Deletion
          </h2>
          <p id="delete-request-description" className="mb-4 text-sm leading-relaxed text-gray-900">
            Account deletion is not automatic yet. To protect your information, Shadow Development LLC
            must verify your identity and review which records can be removed and which must be kept
            for legal or transaction requirements. Your account and data have not been deleted.
          </p>
          <p className="mb-5 text-sm leading-relaxed text-gray-900">
            Use the button below to open an email draft to <span className="font-semibold">{SUPPORT_EMAIL}</span>.
            Please send it from your account email, if possible. No request is sent until you send the email
            yourself. Do not include your password or sign-in links.
          </p>
          <div className="flex gap-3">
            <Button type="button" onClick={onClose} variant="outline"
              className="h-12 flex-1 rounded-xl border-gray-400 !bg-white !text-black">
              Cancel
            </Button>
            <a
              href={mailto}
              aria-label="Open email draft requesting account deletion"
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-red-700 px-2 text-center text-sm font-medium text-white hover:bg-red-800"
            >
              <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
              Compose request
            </a>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-700">
            Sending an email begins the review; it does not automatically erase your account.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
