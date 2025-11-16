# Button Usage Guidelines

## Overview
This document outlines the standardized button system implemented to eliminate duplication and ensure consistent user experience across the application.

## Button Registry System

### Core Principles
1. **Single Source of Truth**: All button configurations are defined in `src/components/ui/ButtonRegistry.tsx`
2. **Unified Components**: Use `UnifiedActionButton` and specialized components for consistent behavior
3. **Centralized Actions**: All button logic is handled through `useButtonActions` hook
4. **Analytics Integration**: Automatic tracking of button interactions
5. **Accessibility**: Built-in ARIA labels and keyboard navigation

### Button Categories

#### Communication Actions
- `email` - Send standard email
- `email-ai` - Generate AI-powered personalized email
- `call` - Initiate phone call
- `calendar` - Schedule meeting

#### Data Management
- `edit` - Enter edit mode
- `save` - Save changes
- `cancel` - Cancel operation
- `add-field` - Add custom field
- `add-contact` - Link contact to deal
- `remove-contact` - Unlink contact
- `change-contact` - Switch contact

#### AI Operations
- `ai-analyze` - Analyze deal/contact with AI
- `ai-enrich` - Enrich contact data
- `ai-score` - Generate AI lead score
- `ai-auto-enrich` - Automatic data enrichment

#### Social Features
- `favorite` / `unfavorite` - Toggle favorite status
- `share` - Share entity
- `find-image` - Update profile image

#### Navigation
- `view-insights` - Switch to insights tab
- `view-journey` - Switch to journey tab
- `view-communication` - Switch to communication tab
- `view-analytics` - Switch to analytics tab
- `view-automation` - Switch to automation tab
- `close` - Close modal/view

## Implementation Guide

### Basic Usage
```tsx
import { UnifiedActionButton, EmailButton, AIAnalyzeButton } from './ui/UnifiedActionButton';

// Using unified component
<UnifiedActionButton
  action="email"
  onClick={handleAction}
  context="deal"
  entityId={dealId}
  entityType="deal"
/>

// Using specialized component
<EmailButton
  onClick={handleAction}
  context="contact"
  entityId={contactId}
  entityType="contact"
/>

// AI-specific button
<AIAnalyzeButton
  onClick={handleAction}
  context="deal"
  entityId={dealId}
  entityType="deal"
/>
```

### Hook Integration
```tsx
import { useButtonActions } from '../hooks/useButtonActions';

const MyComponent = ({ deal, contact }) => {
  const { handleAction } = useButtonActions({
    deal,
    contact,
    onUpdateDeal: updateDeal,
    onUpdateContact: updateContact,
    onClose: handleClose,
    onOpenEmailComposer: openEmailComposer,
    onOpenContactSelector: openContactSelector
  });

  return (
    <UnifiedActionButton
      action="email"
      onClick={handleAction}
      context="deal"
      entityId={deal.id}
      entityType="deal"
    />
  );
};
```

## Context Guidelines

### Deal Context (`context="deal"`)
- Primary actions: `ai-analyze`, `edit`, `favorite`, `share`
- Communication: `email`, `email-ai`, `call`, `calendar`
- Navigation: All `view-*` actions

### Contact Context (`context="contact"`)
- Primary actions: `ai-enrich`, `ai-score`, `favorite`, `share`
- Communication: `email`, `email-ai`, `call`
- Management: `edit`, `find-image`

### Card Context (`context="card"`)
- Compact actions for list/table views
- Limited to: `email`, `call`, `favorite`, `edit`

### Detail Context (`context="detail"`)
- Full-featured actions in detail views
- All actions available based on permissions

## Styling Standards

### Variants
- `primary` - Main actions (blue gradient)
- `secondary` - Supporting actions (gray)
- `outline` - Neutral actions (bordered)
- `ghost` - Minimal actions (text only)
- `danger` - Destructive actions (red)

### Sizes
- `xs` - Compact (24px height)
- `sm` - Standard (32px height)
- `md` - Prominent (40px height)
- `lg` - Hero (48px height)

### Responsive Design
- Mobile: Use `xs` or `sm` sizes
- Tablet: Use `sm` or `md` sizes
- Desktop: Use `md` or `lg` sizes

## Analytics & Tracking

### Automatic Tracking
All buttons automatically track:
- Action performed
- Context and entity information
- Timestamp
- User interaction patterns

### Custom Analytics
```tsx
<UnifiedActionButton
  action="custom-action"
  analyticsEnabled={true}
  // Additional tracking data passed automatically
/>
```

## Accessibility

### Keyboard Navigation
- Tab order follows logical sequence
- Enter/Space activates buttons
- Escape cancels operations
- Shortcut keys defined in registry

### Screen Readers
- ARIA labels automatically applied
- Context-aware descriptions
- Status announcements for async operations

## Permission System

### Role-Based Access
```tsx
// Buttons respect user permissions
<UnifiedActionButton
  action="admin-only"
  // Automatically hidden if user lacks permission
/>
```

### Context Restrictions
- Buttons only show in appropriate contexts
- Invalid combinations prevented at component level

## Migration Guide

### From Old Buttons
```tsx
// Old way (deprecated)
<button onClick={handleEmail}>Email</button>

// New way (recommended)
<EmailButton onClick={handleAction} context="deal" entityId={dealId} />
```

### Component Updates
1. Replace button elements with `UnifiedActionButton`
2. Add `useButtonActions` hook
3. Specify appropriate context and entity
4. Remove custom click handlers (use `handleAction`)

## Best Practices

### Do's
- Always specify `context` and `entityId`/`entityType`
- Use specialized components when available
- Let the system handle analytics and accessibility
- Follow the established naming conventions

### Don'ts
- Create custom button components without registry entries
- Bypass the action system with direct handlers
- Modify button styles outside the defined variants
- Use buttons for navigation (use links instead)

## Future Enhancements

### Planned Features
- Button usage analytics dashboard
- A/B testing framework for button variants
- Advanced permission matrix
- Button interaction heatmaps
- Predictive button suggestions

### Extension Points
- Custom button variants
- Context-specific styling
- Advanced analytics integrations
- Third-party button providers

## Troubleshooting

### Common Issues
1. **Button not appearing**: Check context permissions
2. **Action not firing**: Verify `handleAction` is properly connected
3. **Styling issues**: Ensure correct variant/size combination
4. **Analytics missing**: Check `analyticsEnabled` prop

### Debug Mode
Enable debug logging:
```tsx
<UnifiedActionButton
  action="debug"
  debug={true} // Shows additional logging
/>
```

## Support

For questions about button implementation:
- Check this document first
- Review `ButtonRegistry.tsx` for available actions
- Examine existing implementations in components
- Create issue with `[BUTTON]` prefix for button-related bugs

---

*Last updated: November 2025*
*Maintained by: Development Team*