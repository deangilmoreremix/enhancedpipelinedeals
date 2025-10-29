import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'light' | 'medium' | 'heavy';
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  variant = 'medium',
  onClick
}) => {
  const variantClasses = {
    light: 'glass-light',
    medium: 'glass-medium',
    heavy: 'glass-heavy',
  };

  return (
    <div
      className={`rounded-xl shadow-lg ${variantClasses[variant]} dark:shadow-gray-900/30 dark:border-gray-700 dark:text-gray-100 ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};