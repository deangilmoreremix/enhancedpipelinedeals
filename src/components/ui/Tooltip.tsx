import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
  delay?: number;
  maxWidth?: string;
}

/**
 * Accessible tooltip component with dark mode support
 */
export const Tooltip: React.FC<TooltipProps> = ({ 
  children, 
  content,
  position = 'top',
  delay = 300,
  maxWidth = 'max-w-xs'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>();

  // Position calculations
  const getTooltipPositionClasses = () => {
    switch(position) {
      case 'top':
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
      case 'right': 
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  };

  // Handle keyboard interactions and focus management
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        setIsVisible(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  // Handle mouse/touch events
  const handleMouseEnter = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current);
    if (!isFocused) {
      timerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 100);
    }
  };

  // Handle focus events
  const handleFocus = () => {
    clearTimeout(timerRef.current);
    setIsFocused(true);
    setIsVisible(true);
  };

  const handleBlur = () => {
    clearTimeout(timerRef.current);
    setIsFocused(false);
    setIsVisible(false);
  };

  // Clean up timer
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <div 
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      ref={triggerRef}
    >
      {/* Trigger element */}
      <div 
        tabIndex={0} 
        className="inline-flex" 
        role="button" 
        aria-describedby="tooltip"
      >
        {children}
      </div>
      
      {/* Tooltip */}
      {isVisible && (
        <div 
          id="tooltip"
          role="tooltip" 
          ref={tooltipRef}
          className={`absolute z-50 ${getTooltipPositionClasses()} ${maxWidth} px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-md shadow-lg animate-fade-in pointer-events-none`}
        >
          <div className="relative">
            {content}
            
            {/* Arrow */}
            <div className={`absolute ${
              position === 'top' ? 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 dark:border-t-gray-700 border-t-8 border-x-transparent border-x-8 border-b-0' :
              position === 'right' ? 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 dark:border-r-gray-700 border-r-8 border-y-transparent border-y-8 border-l-0' :
              position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 dark:border-b-gray-700 border-b-8 border-x-transparent border-x-8 border-t-0' :
              'left-full top-1/2 -translate-y-1/2 border-l-gray-900 dark:border-l-gray-700 border-l-8 border-y-transparent border-y-8 border-r-0'
            }`}></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;