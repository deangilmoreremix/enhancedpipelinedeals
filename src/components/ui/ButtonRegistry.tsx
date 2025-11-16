import React from 'react';
import {
  Mail,
  Phone,
  Edit,
  Heart,
  HeartOff,
  Brain,
  Wand2,
  Target,
  BarChart3,
  Search,
  Calendar,
  Share2,
  Camera,
  Plus,
  UserPlus,
  FileText,
  ExternalLink,
  Download,
  Upload,
  Paperclip,
  Copy,
  Link,
  ChevronDown,
  ChevronRight,
  UserX,
  Sparkles,
  TrendingUp,
  Zap,
  Users,
  Activity,
  Settings,
  Database,
  Shield,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  Save,
  Ambulance as Cancel,
  Tag,
  Star,
  Globe,
  Clock,
  Building2,
  Briefcase,
  Award,
  Smartphone,
  Video,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  MapPin,
  User,
  MoreHorizontal,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  X
} from 'lucide-react';

export type ButtonAction =
  | 'email'
  | 'email-ai'
  | 'call'
  | 'edit'
  | 'favorite'
  | 'unfavorite'
  | 'ai-analyze'
  | 'ai-enrich'
  | 'ai-score'
  | 'ai-auto-enrich'
  | 'find-image'
  | 'share'
  | 'calendar'
  | 'add-field'
  | 'add-contact'
  | 'remove-contact'
  | 'change-contact'
  | 'add-tag'
  | 'add-link'
  | 'add-file'
  | 'download'
  | 'upload'
  | 'copy'
  | 'view-files'
  | 'view-insights'
  | 'view-journey'
  | 'view-communication'
  | 'view-analytics'
  | 'view-automation'
  | 'close'
  | 'save'
  | 'cancel'
  | 'feedback-positive'
  | 'feedback-negative';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type ButtonContext = 'deal' | 'contact' | 'global' | 'card' | 'detail' | 'toolbar';

export interface ButtonConfig {
  action: ButtonAction;
  label: string;
  icon: React.ComponentType<any>;
  variant: ButtonVariant;
  size: ButtonSize;
  tooltip?: string;
  shortcut?: string;
  contexts: ButtonContext[];
  requiresPermission?: string[];
  analytics?: {
    category: string;
    action: string;
    label?: string;
  };
}

export const BUTTON_REGISTRY: Record<ButtonAction, ButtonConfig> = {
  'email': {
    action: 'email',
    label: 'Email',
    icon: Mail,
    variant: 'primary',
    size: 'sm',
    tooltip: 'Send email to contact',
    shortcut: 'Ctrl+E',
    contexts: ['deal', 'contact', 'card', 'detail'],
    analytics: {
      category: 'communication',
      action: 'email_opened'
    }
  },
  'email-ai': {
    action: 'email-ai',
    label: 'Email AI',
    icon: Mail,
    variant: 'secondary',
    size: 'sm',
    tooltip: 'Generate personalized email with AI',
    shortcut: 'Ctrl+Shift+E',
    contexts: ['deal', 'contact', 'detail'],
    analytics: {
      category: 'ai',
      action: 'email_ai_generated'
    }
  },
  'call': {
    action: 'call',
    label: 'Call',
    icon: Phone,
    variant: 'primary',
    size: 'sm',
    tooltip: 'Initiate phone call',
    shortcut: 'Ctrl+C',
    contexts: ['deal', 'contact', 'card', 'detail'],
    analytics: {
      category: 'communication',
      action: 'call_initiated'
    }
  },
  'edit': {
    action: 'edit',
    label: 'Edit',
    icon: Edit,
    variant: 'outline',
    size: 'sm',
    tooltip: 'Edit item details',
    shortcut: 'Ctrl+Enter',
    contexts: ['deal', 'contact', 'card', 'detail'],
    analytics: {
      category: 'interaction',
      action: 'edit_mode_entered'
    }
  },
  'favorite': {
    action: 'favorite',
    label: 'Add to Favorites',
    icon: Heart,
    variant: 'outline',
    size: 'sm',
    tooltip: 'Add to favorites for quick access',
    shortcut: 'Ctrl+F',
    contexts: ['deal', 'contact', 'card', 'detail'],
    analytics: {
      category: 'interaction',
      action: 'favorited'
    }
  },
  'unfavorite': {
    action: 'unfavorite',
    label: 'Remove from Favorites',
    icon: HeartOff,
    variant: 'outline',
    size: 'sm',
    tooltip: 'Remove from favorites',
    shortcut: 'Ctrl+F',
    contexts: ['deal', 'contact', 'card', 'detail'],
    analytics: {
      category: 'interaction',
      action: 'unfavorited'
    }
  },
  'ai-analyze': {
    action: 'ai-analyze',
    label: 'AI Analysis',
    icon: Brain,
    variant: 'primary',
    size: 'sm',
    tooltip: 'Analyze with AI to improve win probability',
    shortcut: 'Ctrl+A',
    contexts: ['deal', 'card', 'detail'],
    analytics: {
      category: 'ai',
      action: 'analysis_requested'
    }
  },
  'ai-enrich': {
    action: 'ai-enrich',
    label: 'AI Enrich',
    icon: Search,
    variant: 'secondary',
    size: 'sm',
    tooltip: 'Enrich contact data with AI research',
    shortcut: 'Ctrl+R',
    contexts: ['contact', 'deal', 'detail'],
    analytics: {
      category: 'ai',
      action: 'enrichment_requested'
    }
  },
  'ai-score': {
    action: 'ai-score',
    label: 'AI Score',
    icon: Target,
    variant: 'primary',
    size: 'sm',
    tooltip: 'Generate AI-powered lead score',
    shortcut: 'Ctrl+S',
    contexts: ['contact', 'deal', 'detail'],
    analytics: {
      category: 'ai',
      action: 'scoring_requested'
    }
  },
  'ai-auto-enrich': {
    action: 'ai-auto-enrich',
    label: 'AI Auto-Enrich',
    icon: Wand2,
    variant: 'primary',
    size: 'sm',
    tooltip: 'Automatically enrich data with AI',
    shortcut: 'Ctrl+Shift+R',
    contexts: ['contact', 'deal', 'detail'],
    analytics: {
      category: 'ai',
      action: 'auto_enrichment_requested'
    }
  },
  'find-image': {
    action: 'find-image',
    label: 'Find Image',
    icon: Camera,
    variant: 'outline',
    size: 'xs',
    tooltip: 'Find and update profile image',
    contexts: ['contact', 'deal', 'card'],
    analytics: {
      category: 'interaction',
      action: 'image_search_requested'
    }
  },
  'share': {
    action: 'share',
    label: 'Share',
    icon: Share2,
    variant: 'outline',
    size: 'sm',
    tooltip: 'Share this item',
    shortcut: 'Ctrl+Shift+S',
    contexts: ['deal', 'contact', 'detail'],
    analytics: {
      category: 'social',
      action: 'share_opened'
    }
  },
  'calendar': {
    action: 'calendar',
    label: 'Schedule Meeting',
    icon: Calendar,
    variant: 'secondary',
    size: 'sm',
    tooltip: 'Schedule a meeting',
    shortcut: 'Ctrl+M',
    contexts: ['deal', 'contact', 'detail'],
    analytics: {
      category: 'communication',
      action: 'meeting_scheduled'
    }
  },
  'add-field': {
    action: 'add-field',
    label: 'Add Field',
    icon: Plus,
    variant: 'outline',
    size: 'xs',
    tooltip: 'Add custom field',
    contexts: ['deal', 'contact', 'detail'],
    analytics: {
      category: 'interaction',
      action: 'custom_field_added'
    }
  },
  'add-contact': {
    action: 'add-contact',
    label: 'Add Contact',
    icon: UserPlus,
    variant: 'primary',
    size: 'sm',
    tooltip: 'Add a contact to this deal',
    contexts: ['deal', 'detail'],
    analytics: {
      category: 'relationship',
      action: 'contact_added'
    }
  },
  'remove-contact': {
    action: 'remove-contact',
    label: 'Remove Contact',
    icon: UserX,
    variant: 'danger',
    size: 'xs',
    tooltip: 'Remove contact from deal',
    contexts: ['deal', 'detail'],
    analytics: {
      category: 'relationship',
      action: 'contact_removed'
    }
  },
  'change-contact': {
    action: 'change-contact',
    label: 'Change Contact',
    icon: Edit,
    variant: 'outline',
    size: 'xs',
    tooltip: 'Change the associated contact',
    contexts: ['deal', 'detail'],
    analytics: {
      category: 'relationship',
      action: 'contact_changed'
    }
  },
  'add-tag': {
    action: 'add-tag',
    label: 'Add Tag',
    icon: Tag,
    variant: 'outline',
    size: 'xs',
    tooltip: 'Add a tag',
    contexts: ['deal', 'contact', 'detail'],
    analytics: {
      category: 'organization',
      action: 'tag_added'
    }
  },
  'add-link': {
    action: 'add-link',
    label: 'Add Link',
    icon: Link,
    variant: 'outline',
    size: 'xs',
    tooltip: 'Add external link',
    contexts: ['deal', 'contact', 'detail'],
    analytics: {
      category: 'organization',
      action: 'link_added'
    }
  },
  'add-file': {
    action: 'add-file',
    label: 'Add File',
    icon: Paperclip,
    variant: 'outline',
    size: 'xs',
    tooltip: 'Attach a file',
    contexts: ['deal', 'contact', 'detail'],
    analytics: {
      category: 'organization',
      action: 'file_attached'
    }
  },
  'download': {
    action: 'download',
    label: 'Download',
    icon: Download,
    variant: 'outline',
    size: 'xs',
    tooltip: 'Download file',
    contexts: ['deal', 'contact', 'detail'],
    analytics: {
      category: 'interaction',
      action: 'file_downloaded'
    }
  },
  'upload': {
    action: 'upload',
    label: 'Upload',
    icon: Upload,
    variant: 'outline',
    size: 'xs',
    tooltip: 'Upload file',
    contexts: ['deal', 'contact', 'detail'],
    analytics: {
      category: 'interaction',
      action: 'file_uploaded'
    }
  },
  'copy': {
    action: 'copy',
    label: 'Copy',
    icon: Copy,
    variant: 'outline',
    size: 'xs',
    tooltip: 'Copy to clipboard',
    shortcut: 'Ctrl+C',
    contexts: ['deal', 'contact', 'detail'],
    analytics: {
      category: 'interaction',
      action: 'content_copied'
    }
  },
  'view-files': {
    action: 'view-files',
    label: 'Files',
    icon: FileText,
    variant: 'outline',
    size: 'xs',
    tooltip: 'View attached files',
    contexts: ['deal', 'detail'],
    analytics: {
      category: 'navigation',
      action: 'files_viewed'
    }
  },
  'view-insights': {
    action: 'view-insights',
    label: 'Insights',
    icon: TrendingUp,
    variant: 'outline',
    size: 'sm',
    tooltip: 'View AI insights',
    contexts: ['deal', 'detail'],
    analytics: {
      category: 'navigation',
      action: 'insights_viewed'
    }
  },
  'view-journey': {
    action: 'view-journey',
    label: 'Journey',
    icon: Activity,
    variant: 'outline',
    size: 'sm',
    tooltip: 'View deal journey',
    contexts: ['deal', 'detail'],
    analytics: {
      category: 'navigation',
      action: 'journey_viewed'
    }
  },
  'view-communication': {
    action: 'view-communication',
    label: 'Communication',
    icon: Users,
    variant: 'outline',
    size: 'sm',
    tooltip: 'View communication history',
    contexts: ['deal', 'detail'],
    analytics: {
      category: 'navigation',
      action: 'communication_viewed'
    }
  },
  'view-analytics': {
    action: 'view-analytics',
    label: 'Analytics',
    icon: BarChart3,
    variant: 'outline',
    size: 'sm',
    tooltip: 'View analytics',
    contexts: ['deal', 'detail'],
    analytics: {
      category: 'navigation',
      action: 'analytics_viewed'
    }
  },
  'view-automation': {
    action: 'view-automation',
    label: 'Automation',
    icon: Zap,
    variant: 'outline',
    size: 'sm',
    tooltip: 'View automation rules',
    contexts: ['deal', 'detail'],
    analytics: {
      category: 'navigation',
      action: 'automation_viewed'
    }
  },
  'close': {
    action: 'close',
    label: 'Close',
    icon: X,
    variant: 'ghost',
    size: 'sm',
    tooltip: 'Close this view',
    shortcut: 'Esc',
    contexts: ['deal', 'contact', 'detail', 'global'],
    analytics: {
      category: 'navigation',
      action: 'view_closed'
    }
  },
  'save': {
    action: 'save',
    label: 'Save',
    icon: Save,
    variant: 'primary',
    size: 'sm',
    tooltip: 'Save changes',
    shortcut: 'Ctrl+S',
    contexts: ['deal', 'contact', 'detail'],
    analytics: {
      category: 'interaction',
      action: 'changes_saved'
    }
  },
  'cancel': {
    action: 'cancel',
    label: 'Cancel',
    icon: Cancel,
    variant: 'outline',
    size: 'sm',
    tooltip: 'Cancel changes',
    shortcut: 'Esc',
    contexts: ['deal', 'contact', 'detail'],
    analytics: {
      category: 'interaction',
      action: 'changes_cancelled'
    }
  },
  'feedback-positive': {
    action: 'feedback-positive',
    label: 'Good',
    icon: ThumbsUp,
    variant: 'outline',
    size: 'xs',
    tooltip: 'Mark as good analysis',
    contexts: ['deal', 'contact'],
    analytics: {
      category: 'feedback',
      action: 'positive_feedback'
    }
  },
  'feedback-negative': {
    action: 'feedback-negative',
    label: 'Poor',
    icon: ThumbsDown,
    variant: 'outline',
    size: 'xs',
    tooltip: 'Mark as poor analysis',
    contexts: ['deal', 'contact'],
    analytics: {
      category: 'feedback',
      action: 'negative_feedback'
    }
  }
};

export const getButtonConfig = (action: ButtonAction): ButtonConfig => {
  return BUTTON_REGISTRY[action];
};

export const getButtonsForContext = (context: ButtonContext): ButtonConfig[] => {
  return Object.values(BUTTON_REGISTRY).filter(config =>
    config.contexts.includes(context)
  );
};

export const getButtonAnalytics = (action: ButtonAction) => {
  return BUTTON_REGISTRY[action]?.analytics;
};