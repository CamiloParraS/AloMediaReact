# Styles & UI System

## Overview

AloMedia uses TailwindCSS for styling with a custom theme that creates a dark, modern aesthetic appropriate for a professional video editing application. The color scheme emphasizes deep reds and burgundy tones with muted neutrals, creating a cinematic feel while maintaining excellent contrast for usability.

## Design Philosophy

The styling system follows these principles:

- **Dark Theme**: Reduces eye strain during long editing sessions and focuses attention on the media
- **Consistency**: Unified component library ensures predictable behavior across the app
- **Performance**: Utility-first CSS (TailwindCSS) minimizes CSS size
- **Accessibility**: High contrast ratios and semantic HTML for screen readers
- **Responsiveness**: Adapts to different screen sizes (though primarily desktop-focused for video editing)

## Color Palette

The custom color scheme is defined in `src/index.css`:

### Red Tones
These form the primary accent colors and are used for:
- Interactive elements (buttons, links, hover states)
- Selected states
- Warning/alert messaging
- Brand identity

```css
--color-blood-red: #7a1a1a        (Muted base red)
--color-blood-red-light: #9b2c2c  (Lighter, hover state)
--color-blood-red-glow: #b83030   (Brightest, active state)
--color-burgundy: #4a0e1e         (Deep burgundy variant)
--color-crimson: #a0222f          (Crimson variant)
--color-rose-muted: #c2555a       (Muted rose)
--color-accent-red: #c0392b       (Primary accent)
```

### Neutral/Dark Tones
Used for backgrounds, surfaces, and borders:

```css
--color-dark: #0b0b0f              (Darkest, main background)
--color-dark-surface: #111116      (Primary surface)
--color-dark-card: #18181f         (Card/panel backgrounds)
--color-dark-elevated: #222230     (Elevated elements, modals)
--color-dark-border: #2e2e3a       (Primary borders)
--color-dark-border-light: #3e3e50 (Secondary borders)
```

### Orange Accent
For special elements and secondary actions:

```css
--color-accent-orange: #d4622a
```

### Text Colors
For readability and hierarchy:

```css
--color-accent-white: #ececf0      (Primary text)
--color-muted: #8a8a9a            (Secondary text)
--color-muted-light: #b0b0c0       (Tertiary text, labels)
```

### Input Elements
Specific colors for form controls:

```css
--color-input-bg: #14141c          (Input background)
--color-input-border: #2a2a38      (Input border)
```

### Glass Morphism
Semi-transparent white for "glass" effects:

```css
--color-glass: rgba(255, 255, 255, 0.04)           (Base glass)
--color-glass-border: rgba(255, 255, 255, 0.08)    (Glass border)
--color-glass-hover: rgba(255, 255, 255, 0.07)     (Glass hover)
```

These create subtle, frosted-glass-like effects on elements without using blur.

## Typography

### Font
```css
--font-sans: "Quicksand", system-ui, sans-serif;
```

**Quicksand** is a geometric sans-serif font imported from Google Fonts. It provides:
- Modern, friendly appearance
- Excellent readability at all sizes
- Good visual hierarchy through weight options (300-700)

**Fallback chain**: If Quicksand fails, uses system UI font stack.

### Font Weights
Quicksand provides five weights:

- **300 (Light)**: Body text, secondary information
- **400 (Regular)**: Normal text, default
- **500 (Medium)**: Section headers, labels
- **600 (Semibold)**: Component titles, emphasis
- **700 (Bold)**: Important headings, strong emphasis

### Usage
- **Headers**: Font-weight 600-700, larger size
- **Body text**: Font-weight 400, default size
- **Labels**: Font-weight 500, slightly smaller
- **Muted text**: Font-weight 400, muted color

## Animations and Transitions

### Keyframe Animations
The theme includes several custom animations:

```css
@keyframes fade-in
  Fades element from 0% to 100% opacity
  Duration: 0.5s
  Easing: ease-out
  
@keyframes slide-up
  Slides element up while fading in
  Moves from 16px below to final position
  Duration: 0.5s
  Easing: ease-out
  
@keyframes glow-pulse
  Creates a pulsing glow effect around elements
  Animates shadow from small to large
  Duration: 3s infinite
  Used for highlighting important elements
```

### Animation Variables
```css
var(--animate-fade-in)
var(--animate-slide-up)
var(--animate-glow-pulse)
```

Used on elements that need entrance animations or attention-drawing effects.

### CSS Transitions
Most interactive elements use CSS transitions for smooth effects:

```css
transition: background-color 0.2s ease;
transition: color 0.2s ease;
transition: opacity 0.2s ease;
```

## Component Patterns

### UI Component Library (`src/components/ui/`)

AloMedia provides a set of reusable UI components:

#### Buttons
Multiple button variants for different contexts:

- **Primary Button** (`PrimaryButton.tsx`): Main call-to-action buttons
- **Label Button** (`LabelButton.tsx`): Text buttons with icons, typically in toolbars
- **Icon Button** (`IconButton.tsx`): Icon-only buttons in compact spaces

Button properties:
- **Variant**: ghost, primary, secondary (affects color/style)
- **Size**: sm, md, lg (affects padding/font-size)
- **State**: normal, hover, active, disabled

#### Form Inputs
- **RangeSlider** (`RangeSlider.tsx`): Slider for continuous values (volume, position)
- **Dropdown** (`Dropdown.tsx`): Select control with custom styling
- Input fields: Standard HTML with Tailwind styling

#### Divider
- **Divider** (`Divider.tsx`): Horizontal or vertical separator lines

### Editor Components (`src/components/editor/`)

Specialized components for video editing:

- **Timeline**: The main timeline view
- **Track**: Single track containing clips
- **Clip**: Individual clip on timeline
- **MediaLibrary**: Panel for importing and browsing media
- **MediaCard**: Card showing single media entry
- **PreviewPlayer**: Canvas and playback controls
- **Toolbar**: Playback and editing controls
- **TransformOverlay**: Visual overlay for transform editing

### Page Components (`src/pages/`)

Top-level page layouts:

- **Auth pages** (`/auth`): Login, register, recover
- **Dashboard** (`/dashboard`): Project management
- **Editor** (`/editor`): Full editor interface

## Responsive Design

AloMedia is primarily designed for desktop editing but includes some responsive considerations:

### Breakpoints (Tailwind defaults)

```
sm:  640px    - Tablets and larger phones
md:  768px    - Small laptops
lg:  1024px   - Laptops
xl:  1280px   - Larger monitors
2xl: 1536px   - Ultra-wide displays
```

### Responsive Patterns

- **Flexbox**: Most layouts use flexbox for automatic reflow
- **Grid**: Complex layouts (editor interface) use CSS Grid
- **Hidden/Visible**: Elements shown/hidden at different breakpoints via `hidden md:flex`

### Mobile Considerations

- Timeline may not be fully functional on touchscreen devices
- Consider mobile-specific UI alternatives in future (draggable timeline, touch gestures)
- Media library may need mobile optimizations (file picker on mobile works well)

## Dark Mode

The entire application uses dark mode. The implementation:

```html
<!-- HTML theme attribute (not set to auto, always dark) -->
<html class="dark">
```

```css
/* CSS operates under dark theme assumption */
background-color: var(--color-dark);
color: var(--color-accent-white);
```

No light mode switcher is currently provided, but adding one would involve:

1. Adding a theme toggle component
2. Storing preference in localStorage
3. Updating CSS variables dynamically
4. Providing matching light-mode color values

## Shadows and Elevation

Visual hierarchy uses subtle shadows:

```css
/* Minimal shadow (slight depth) */
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);

/* Standard shadow (raised button) */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

/* Elevated shadow (modal, dropdown) */
box-shadow: 0 10px 15px rgba(0, 0, 0, 0.3);

/* Glow effect (attention) */
box-shadow: 0 0 20px rgba(122, 26, 26, 0.3);
```

## Spacing System

Tailwind's spacing scale is used throughout:

```
p-1   = 0.25rem = 4px    (small padding)
p-2   = 0.5rem  = 8px    (default)
p-3   = 0.75rem = 12px   (comfortable)
p-4   = 1rem    = 16px   (generous)
p-6   = 1.5rem  = 24px   (section spacing)
p-8   = 2rem    = 32px   (large gaps)
```

Consistent spacing ensures:
- Visual rhythm
- Predictable alignment
- Professional appearance

## Z-Index Layering

The app uses a layering system for overlapping elements:

```
z-0    = 0      (default)
z-10   = 10     (modals, important overlays)
z-50   = 50     (top-level modals, tooltips)
z-auto = auto   (stacking context relative)
```

Timeline playhead and selection indicators use higher z-indices to appear on top of clips.

## Accessibility

### Color Contrast
All text colors meet WCAG AA standards for contrast:
- White text on dark backgrounds: 7+ contrast ratio
- Muted text: 4.5+ contrast ratio (minimum WCAG AA)

### Focus States
Interactive elements have visible focus states:
```css
:focus-visible {
  outline: 2px solid var(--color-accent-red);
  outline-offset: 2px;
}
```

### Semantic HTML
- Proper heading hierarchy (h1, h2, h3)
- Label elements for form controls
- Button elements for interactions (not divs)
- All interactive elements accessible via keyboard

### Icons
- Icons paired with text labels where meaningful
- aria-labels on icon-only buttons
- Icon library (Lucide) provides accessible SVGs

## Tailwind Configuration

AloMedia uses the new Tailwind v4 with the Vite plugin:

```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Benefits:
- Zero-config setup
- No separate CSS file needed
- Automatic purging of unused styles
- CSS variables integrated into theme

## Common Tailwind Patterns

### Flex Container
```jsx
<div className="flex items-center justify-between gap-4">
  {/* Items centered vertically, spaced evenly, 4 unit gap */}
</div>
```

### Grid Layout
```jsx
<div className="grid grid-cols-4 gap-4">
  {/* 4-column grid with 4-unit gaps */}
</div>
```

### Card Style
```jsx
<div className="bg-dark-card rounded border border-dark-border p-4">
  {/* Dark card with border and padding */}
</div>
```

### Interactive Element
```jsx
<button className="px-4 py-2 bg-accent-red rounded hover:bg-blood-red-light transition-colors">
  {/* Red button with hover effect */}
</button>
```

### Text Hierarchy
```jsx
<>
  <h1 className="text-2xl font-bold text-accent-white">Title</h1>
  <p className="text-sm text-muted">Subtitle</p>
</>
```

## Future Styling Improvements

Potential enhancements:

- **Light mode theme**: Complementary light colors for accessibility
- **Accessibility audit**: Ensure 100% WCAG AA compliance
- **Icon library**: Expand Lucide icon usage for consistency
- **Motion preferences**: Respect `prefers-reduced-motion` for animations
- **Custom theme builder**: Let users customize color scheme
- **Component storybook**: Document all components and states
- **CSS animations**: More sophisticated UI transitions
- **Design tokens**: Centralize all design values in a design token system
