import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  showClose?: boolean;
  closeOnOutsideClick?: boolean;
}

/**
 * Base modal component with accessibility features and dark mode support
 * Handles focus trapping, keyboard navigation, and proper ARIA attributes
 */
export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-2xl',
  showClose = true,
  closeOnOutsideClick = true
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusElement = useRef<Element | null>(null);
  
  useEffect(() => {
    // Store the element that had focus before opening modal
    if (isOpen) {
      previousFocusElement.current = document.activeElement;
      
      // Focus the modal when it opens
      if (modalRef.current) {
        // Focus the first focusable element or the modal itself
        const firstFocusable = modalRef.current.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement;
        
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          modalRef.current.focus();
        }
      }
      
      // Disable body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      // Re-enable scroll when modal closes
      if (isOpen) {
        document.body.style.overflow = '';
        
        // Restore focus to previously focused element
        if (previousFocusElement.current) {
          (previousFocusElement.current as HTMLElement).focus();
        }
      }
    };
  }, [isOpen]);
  
  // Handle keyboard interactions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    
    // Trap focus within modal
    if (e.key === 'Tab') {
      if (!modalRef.current) return;
      
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      
      // If shift+tab on first element, focus last element
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
      // If tab on last element, focus first element
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[75] flex items-center justify-center p-4 overflow-y-auto"
      aria-modal="true"
      role="dialog"
      aria-labelledby={title ? 'modal-title' : undefined}
      onClick={closeOnOutsideClick ? onClose : undefined}
    >
      <div 
        ref={modalRef}
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl ${maxWidth} w-full max-h-[90vh] overflow-hidden animate-scale-in`}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700">
            <h2 id="modal-title" className="text-xl font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            {showClose && (
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        
        <div className="overflow-y-auto max-h-[calc(90vh-4rem)]">
          {children}
        </div>
      </div>
    </div>
  );
};

export default BaseModal;