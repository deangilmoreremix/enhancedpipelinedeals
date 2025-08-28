import React, { useEffect, useRef } from 'react';
import FocusTrap from 'focus-trap-react';
import { X } from 'lucide-react';

interface AccessibleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
  closeOnEsc?: boolean;
  closeOnOutsideClick?: boolean;
}

/**
 * An accessible dialog component that follows WAI-ARIA best practices
 * with full keyboard navigation, focus management, and proper ARIA attributes.
 */
export const AccessibleDialog: React.FC<AccessibleDialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-md',
  closeOnEsc = true,
  closeOnOutsideClick = true
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  
  useEffect(() => {
    // Store the currently focused element so we can restore focus later
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
    
    // Add escape key listener for closing dialog
    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEsc && event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent scrolling of background content
      document.body.style.overflow = 'hidden';
    }
    
    // Cleanup function
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      
      if (isOpen) {
        // Re-enable scrolling when component unmounts if it was open
        document.body.style.overflow = '';
        
        // Return focus to the element that had focus before dialog was opened
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      }
    };
  }, [isOpen, onClose, closeOnEsc]);
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby={`dialog-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={closeOnOutsideClick ? onClose : undefined}
        aria-hidden="true"
      />
      
      {/* Dialog positioning */}
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        {/* Focus trap for accessibility */}
        <FocusTrap>
          <div
            ref={dialogRef}
            className={`relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all ${maxWidth} w-full`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gray-50 dark:bg-gray-750 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 
                  id={`dialog-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
                  className="text-lg font-medium text-gray-900 dark:text-white"
                >
                  {title}
                </h2>
                
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-transparent text-gray-400 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2"
                  aria-label="Close dialog"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              {description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              )}
            </div>
            
            {/* Content */}
            <div className="px-6 py-4 text-gray-900 dark:text-white">
              {children}
            </div>
          </div>
        </FocusTrap>
      </div>
    </div>
  );
};

export default AccessibleDialog;