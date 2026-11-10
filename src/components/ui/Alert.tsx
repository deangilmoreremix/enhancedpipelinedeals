import React from 'react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error' | 'destructive';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

const variantClasses: Record<AlertVariant, string> = {
  info: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800',
  success: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800',
  error: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800',
  destructive: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800'
};

export const Alert: React.FC<AlertProps> = ({ variant = 'info', className = '', children, ...rest }) => (
  <div
    role={variant === 'error' || variant === 'destructive' || variant === 'warning' ? 'alert' : 'status'}
    className={`flex items-start gap-2 rounded-md border p-3 ${variantClasses[variant]} ${className}`}
    {...rest}
  >
    {children}
  </div>
);

export default Alert;
