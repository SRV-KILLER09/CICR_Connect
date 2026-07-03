import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function SideDrawer({ isOpen, onClose, title, children, width = 'max-w-md' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`relative w-full ${width} h-full bg-white border border-slate-200 shadow-sm rounded-2xl rounded-l-2xl border-l border-slate-200 flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.5)]`}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-100">
              <h2 className="text-xl font-brand font-bold text-slate-900">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto scrollbar-hide flex-1">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
