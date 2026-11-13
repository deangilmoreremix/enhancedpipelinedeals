import React from 'react';

export type ButtonVariant = 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
  secondary:
    'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 focus-visible:ring-gray-500',
  outline:
    'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 focus-visible:ring-gray-500',
  ghost:
    'bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 focus-visible:ring-gray-500',
  destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500'
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-4 text-base'
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...rest
}) => (
  <button
    type={type}
    className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    {...rest}
  >
    {children}
  </button>
);

export default Button;
