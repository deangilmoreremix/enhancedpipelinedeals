import React, { useCallback } from 'react';
import { Tooltip } from './Tooltip';
import { ModernButton } from './ModernButton';
import {
  ButtonAction,
  ButtonVariant,
  ButtonSize,
  ButtonContext,
  getButtonConfig,
  getButtonAnalytics
} from './ButtonRegistry';

interface UnifiedActionButtonProps {
  action: ButtonAction;
  onClick?: (action: ButtonAction, event: React.MouseEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  context?: ButtonContext;
  entityId?: string;
  entityType?: string;
  className?: string;
  showTooltip?: boolean;
  showShortcut?: boolean;
  analyticsEnabled?: boolean;
}

export const UnifiedActionButton: React.FC<UnifiedActionButtonProps> = ({
  action,
  onClick,
  disabled = false,
  loading = false,
  variant,
  size,
  context,
  entityId,
  entityType,
  className,
  showTooltip = true,
  showShortcut = false,
  analyticsEnabled = true
}) => {
  const config = getButtonConfig(action);

  const handleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();

    // Track analytics if enabled
    if (analyticsEnabled && config.analytics) {
      try {
        // Send analytics event
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', config.analytics.action, {
            event_category: config.analytics.category,
            event_label: config.analytics.label || `${entityType}_${entityId}`,
            custom_parameters: {
              action,
              context,
              entityId,
              entityType
            }
          });
        }

        // Also track with custom analytics service if available
        console.log('📊 Button analytics:', {
          action,
          category: config.analytics.category,
          label: config.analytics.label,
          context,
          entityId,
          entityType,
          timestamp: Date.now()
        });
      } catch (error) {
        console.warn('Analytics tracking failed:', error);
      }
    }

    // Call the provided onClick handler
    if (onClick) {
      onClick(action, event);
    }
  }, [action, onClick, analyticsEnabled, config, context, entityId, entityType]);

  const buttonVariant = variant || config.variant;
  const buttonSize = size || config.size;

  const buttonContent = (
    <ModernButton
      variant={buttonVariant}
      size={buttonSize}
      onClick={handleClick}
      disabled={disabled || loading}
      loading={loading}
      className={className}
      title={config.tooltip}
    >
      <config.icon className={`w-4 h-4 ${buttonSize === 'xs' ? 'w-3 h-3' : buttonSize === 'lg' ? 'w-5 h-5' : 'w-4 h-4'}`} />
      {config.label}
      {showShortcut && config.shortcut && (
        <span className="ml-1 text-xs opacity-60">
          ({config.shortcut})
        </span>
      )}
    </ModernButton>
  );

  if (showTooltip && config.tooltip) {
    return (
      <Tooltip content={config.tooltip} position="top">
        {buttonContent}
      </Tooltip>
    );
  }

  return buttonContent;
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

// Export types for external use
export type { ButtonAction, ButtonVariant, ButtonSize, ButtonContext };