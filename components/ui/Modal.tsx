
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  singleButton?: boolean;
  children?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm, title, description, singleButton = false, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="bg-zinc-900 border border-zinc-700 w-full max-w-md p-6 pointer-events-auto shadow-2xl relative mx-4">
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-zinc-500 hover:text-white"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-amber-600/20 rounded-full">
                   <AlertTriangle className="text-amber-600" size={24} />
                </div>
                <div>
                   <h3 className="text-xl font-bold text-white uppercase">{title}</h3>
                   <p className="text-zinc-400 mt-2 text-sm leading-relaxed">{description}</p>
                </div>
              </div>

              {children && (
                <div className="mb-6 pl-1">
                  {children}
                </div>
              )}

              <div className="flex gap-3 mt-4 justify-end">
                {!singleButton && (
                   <Button variant="outline" onClick={onClose} className="text-sm py-2">Отмена</Button>
                )}
                <Button variant="danger" onClick={onConfirm} className="text-sm py-2">{singleButton ? 'Понятно' : 'Подтвердить'}</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
