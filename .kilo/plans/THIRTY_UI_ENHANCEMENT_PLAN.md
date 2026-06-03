# Twenty UI Enhancement Plan - Additive Only

## Core Principle
DO NOT duplicate existing UI patterns. This app already has `src/components/ui/` with 30+ components. We enhance by adding **new utilities, variants, and extension components**.

## Existing UI Coverage Analysis
The repo already has:
- **Cards/Badges**: `DealCard.tsx`, `GlassCard.tsx`, `CitationBadge.tsx`, `AvatarWithStatus.tsx`
- **Inputs**: `Dropdown.tsx`, `ModernButton.tsx`, `AdvancedFilter.tsx`, `ImageUpload.tsx`
- **Layout**: Various modal/table/card layouts throughout
- **Navigation**: `AppNavigation.tsx` in components/navigation/
- **Feedback**: `Toast.tsx`, `LoadingSkeleton.tsx`, AISystemStatus components
- **Icons**: `lucide-react` (same as Twenty UI)

## Proposed Additive Enhancements

### 1. New Display Components (Enhancement Variants)
- `src/components/ui/DealCardEnhanced.tsx` - extends `DealCard` with additional hover states
- `src/components/ui/StageBadge.tsx` - extend badge styling for pipeline stages
- `src/components/ui/ActivityTimeline.tsx` - extend `DealTimeline` visualization

### 2. New Input Component Extensions
- `src/components/ui/DateRangePicker.tsx` - extend existing date/time inputs with range selection
- `src/components/ui/MultiselectDropdown.tsx` - extend `Dropdown` for multi-value selection
- `src/components/ui/RatingInput.tsx` - star-based rating input (for scores/confidence)

### 3. New Layout Component Extensions
- `src/components/ui/ModalBase.tsx` - base modal with enhanced animations
- `src/components/ui/SplitView.tsx` - split view layout for sidebar detail

### 4. New Navigation Extensions
- `src/components/ui/TabNavigation.tsx` - extend navigation with tab management
- `src/components/ui/BreadcrumbNav.tsx` - breadcrumb navigation component

### 5. New Feedback Extensions
- `src/components/ui/AlertBanner.tsx` - extend alert with banner styling
- `src/components/ui/ProgressTracker.tsx` - progress visualization for workflows

## Implementation Notes
- All components follow existing Tailwind styling
- Extend existing types (Deal, ViewFilter, etc.)
- Can be used alongside existing components
- Export from index file for easy imports

## Constraints
- ❌ NO direct Twenty UI package dependency (would duplicate lucide-react + Tailwind)
- ✅ Enhancement components use existing patterns
- ✅ New file only, no modifications to existing files