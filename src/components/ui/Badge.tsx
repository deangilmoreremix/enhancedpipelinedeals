import React from 'react';

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  outline: 'border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200',
  destructive: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  success: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', className = '', children, ...rest }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    {...rest}
  >
    {children}
  </span>
);

export default Badge;
