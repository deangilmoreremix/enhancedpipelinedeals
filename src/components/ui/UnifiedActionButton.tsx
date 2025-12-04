import React from 'react';
import { ButtonAction, ButtonVariant, ButtonSize, getButtonConfig } from './ButtonRegistry';
import { Tooltip } from './Tooltip';

interface UnifiedActionButtonProps {
  action: ButtonAction;
  onClick?: (action: ButtonAction, event?: React.MouseEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
  showTooltip?: boolean;
}

export const UnifiedActionButton: React.FC<UnifiedActionButtonProps> = ({
  action,
  onClick,
  variant,
  size,
  disabled = false,
  className = '',
  showTooltip = true
}) => {
  const config = getButtonConfig(action);

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(action, e);
    }
  };

  const buttonVariant = variant || config.variant;
  const buttonSize = size || config.size;

  // Base button classes
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  // Variant classes
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 shadow-sm',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-900 focus:ring-gray-500 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200',
    ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-sm'
  };

  // Size classes
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs rounded',
    sm: 'px-3 py-2 text-sm rounded-md',
    md: 'px-4 py-2 text-sm rounded-md',
    lg: 'px-6 py-3 text-base rounded-md'
  };

  const buttonClasses = `${baseClasses} ${variantClasses[buttonVariant]} ${sizeClasses[buttonSize]} ${className}`;

  const Icon = config.icon;

  const button = (
    <button
      onClick={handleButtonClick}
      disabled={disabled}
      className={buttonClasses}
      title={!showTooltip ? config.tooltip : undefined}
    >
      <Icon className={`${
        buttonSize === 'xs' ? 'w-3 h-3' :
        buttonSize === 'sm' ? 'w-4 h-4' :
        'w-5 h-5'
      } ${config.label ? 'mr-2' : ''}`} />
      {config.label && <span>{config.label}</span>}
    </button>
  );

  if (showTooltip && config.tooltip) {
    return (
      <Tooltip content={config.tooltip} position="top">
        {button}
      </Tooltip>
    );
  }

  return button;
};

// Specialized button components for common actions
export const EmailButton: React.FC<Omit<UnifiedActionButtonProps, 'action'> & { ai?: boolean }> = ({
  ai = false,
  ...props
}) => (
  <UnifiedActionButton
    action={ai ? 'email-ai' : 'email'}
    {...props}
  />
);

export const CallButton: React.FC<Omit<UnifiedActionButtonProps, 'action'>> = (props) => (
  <UnifiedActionButton
    action="call"
    {...props}
  />
);

export const EditButton: React.FC<Omit<UnifiedActionButtonProps, 'action'>> = (props) => (
  <UnifiedActionButton
    action="edit"
    {...props}
  />
);

export const FavoriteButton: React.FC<Omit<UnifiedActionButtonProps, 'action'> & { isFavorite?: boolean }> = ({
  isFavorite = false,
  ...props
}) => (
  <UnifiedActionButton
    action={isFavorite ? 'unfavorite' : 'favorite'}
    {...props}
  />
);

export const AIAnalyzeButton: React.FC<Omit<UnifiedActionButtonProps, 'action'>> = (props) => (
  <UnifiedActionButton
    action="ai-analyze"
    {...props}
  />
);

export const AIEnrichButton: React.FC<Omit<UnifiedActionButtonProps, 'action'>> = (props) => (
  <UnifiedActionButton
    action="ai-enrich"
    {...props}
  />
);

export const AIScoreButton: React.FC<Omit<UnifiedActionButtonProps, 'action'>> = (props) => (
  <UnifiedActionButton
    action="ai-score"
    {...props}
  />
);

export const AIAutoEnrichButton: React.FC<Omit<UnifiedActionButtonProps, 'action'>> = (props) => (
  <UnifiedActionButton
    action="ai-auto-enrich"
    {...props}
  />
);

export const ShareButton: React.FC<Omit<UnifiedActionButtonProps, 'action'>> = (props) => (
  <UnifiedActionButton
    action="share"
    {...props}
  />
);

export const CalendarButton: React.FC<Omit<UnifiedActionButtonProps, 'action'>> = (props) => (
  <UnifiedActionButton
    action="calendar"
    {...props}
  />
);