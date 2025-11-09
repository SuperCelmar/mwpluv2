# MWPLU Design System - Comprehensive Style Guide

## Table of Contents

1. [Overview](#overview)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Spacing System](#spacing-system)
5. [Component Styles](#component-styles)
6. [Shadows & Elevation](#shadows--elevation)
7. [Animations & Transitions](#animations--transitions)
8. [Border Radius](#border-radius)
9. [Opacity & Transparency](#opacity--transparency)
10. [Common Tailwind CSS Usage](#common-tailwind-css-usage)
11. [Example Component Reference Design Code](#example-component-reference-design-code)
12. [Responsive Design](#responsive-design)
13. [Dark Mode](#dark-mode)
14. [Accessibility](#accessibility)
15. [Best Practices](#best-practices)

---

## Overview

The MWPLU Design System is a comprehensive, modern design system built with a clean, minimalist Cloud UI aesthetic. It combines custom CSS variables with Tailwind CSS utility classes to create a cohesive, scalable design language.

### Design Philosophy

- **Clean & Minimalist**: Generous whitespace and subtle visual hierarchy
- **Accessible**: WCAG AA compliant contrast ratios
- **Responsive**: Mobile-first approach with breakpoints at 640px, 768px, and 1200px
- **Theme-Aware**: Full support for light and dark modes
- **Consistent**: Unified spacing, typography, and color systems

### Technology Stack

- **CSS Variables**: Custom properties for theming and consistency
- **Tailwind CSS**: Utility-first CSS framework with custom configuration
- **Font Family**: Lato (weights: 300, 400, 700) with system font fallbacks
- **Monospace Font**: Monaco, Menlo, Ubuntu Mono, Consolas for code

---

## Color Palette

### Light Theme Colors

#### Background Colors

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--bg-primary` | `#ffffff` | Main background, cards, modals |
| `--bg-secondary` | `#f9fafb` | Secondary backgrounds, hover states |
| `--bg-tertiary` | `#f3f4f6` | Tertiary backgrounds, subtle sections |
| `--bg-info` | `#f0f9ff` | Info alerts, informational backgrounds |

#### Text Colors

| Variable | Hex Value | Usage | Contrast Ratio |
|----------|-----------|-------|----------------|
| `--text-primary` | `#000000` | Primary text, headings | 21:1 |
| `--text-secondary` | `#4b5563` | Secondary text, descriptions | 7.5:1 |
| `--text-muted` | `#9ca3af` | Muted text, placeholders | 3.8:1 |

#### Border Colors

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--border-light` | `#e5e7eb` | Light borders, dividers |
| `--border-medium` | `#d1d5db` | Medium borders, input borders |

#### Accent Colors

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--accent-green` | `#10b981` | Success states, switches, positive actions |
| `--accent-blue` | `#3b82f6` | Primary actions, links, focus states |
| `--accent-purple` | `#8b5cf6` | Special highlights, code keywords |
| `--accent-red` | `#ef4444` | Destructive actions, errors, alerts |

### Dark Theme Colors

#### Background Colors

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--bg-primary` | `#0a0a0a` | Main background (near black) |
| `--bg-secondary` | `#1a1a1a` | Secondary backgrounds |
| `--bg-tertiary` | `#2a2a2a` | Tertiary backgrounds |
| `--bg-info` | `#1e293b` | Info alerts |

#### Text Colors (WCAG AA Compliant)

| Variable | Hex Value | Usage | Contrast Ratio |
|----------|-----------|-------|----------------|
| `--text-primary` | `#ffffff` | Primary text | 21:1 |
| `--text-secondary` | `#e5e7eb` | Secondary text | 4.5:1+ (improved from #d1d5db) |
| `--text-muted` | `#b1b5bb` | Muted text | WCAG AA compliant |

#### Border Colors

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--border-light` | `#374151` | Light borders |
| `--border-medium` | `#4b5563` | Medium borders |

**Note**: Accent colors remain the same in dark mode for consistency.

### Tailwind CSS Color System

The project also uses Tailwind's HSL-based color system defined in `globals.css`:

#### Semantic Color Tokens

```css
/* Light Theme */
--background: 0 0% 100%;           /* White */
--foreground: 0 0% 3.9%;           /* Near black */
--card: 0 0% 100%;                  /* White */
--primary: 0 0% 9%;                 /* Dark gray */
--secondary: 0 0% 96.1%;            /* Light gray */
--muted: 0 0% 96.1%;                /* Muted background */
--muted-foreground: 0 0% 45.1%;    /* Muted text */
--destructive: 0 84.2% 60.2%;      /* Red */
--border: 0 0% 89.8%;              /* Border color */
--input: 0 0% 89.8%;                /* Input border */
--ring: 0 0% 3.9%;                  /* Focus ring */
```

#### Usage in Tailwind Classes

```tsx
// Background colors
className="bg-background"        // Main background
className="bg-card"              // Card background
className="bg-primary"            // Primary color
className="bg-secondary"          // Secondary color
className="bg-muted"              // Muted background
className="bg-destructive"       // Destructive/error color

// Text colors
className="text-foreground"       // Primary text
className="text-card-foreground" // Card text
className="text-primary-foreground" // Text on primary bg
className="text-muted-foreground"  // Muted text
```

### Code Syntax Colors

#### Light Theme

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--code-keyword` | `#8b5cf6` | Keywords (export, function, return) |
| `--code-string` | `#10b981` | String literals |
| `--code-type` | `#3b82f6` | Type annotations |
| `--code-comment` | `#9ca3af` | Comments |
| `--code-bg` | `#f9fafb` | Code block background |

#### Dark Theme

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--code-keyword` | `#a78bfa` | Keywords (lighter purple) |
| `--code-string` | `#34d399` | String literals (lighter green) |
| `--code-type` | `#60a5fa` | Type annotations (lighter blue) |
| `--code-comment` | `#6b7280` | Comments |
| `--code-bg` | `#1a1a1a` | Code block background |

---

## Typography

### Font Family

**Primary Font**: Lato
- **Weights Available**: 300 (Light), 400 (Regular), 700 (Bold)
- **Fallback Stack**: `'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif`

**Monospace Font**: For code blocks
- **Stack**: `'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace`

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Light | 300 | Rarely used, for special emphasis |
| Regular | 400 | Body text, default weight |
| Medium | 500 | Button text, labels, descriptions |
| Semibold | 600 | Badges, small headings, emphasis |
| Bold | 700 | Headings (h1-h6), card titles, strong emphasis |

### Typography Scale

#### Headings

| Element | Font Size | Line Height | Font Weight | Margin Bottom | Usage |
|---------|-----------|-------------|-------------|---------------|-------|
| `h1` | `2.25rem` (36px) | `1.2` | `700` | `1.5rem` | Main page titles |
| `h2` | `1.875rem` (30px) | `1.2` | `700` | `1.5rem` | Section titles (with bottom border) |
| `h3` | `1.5rem` (24px) | `1.2` | `700` | `1rem` | Subsection titles |
| `h4` | `1.25rem` (20px) | `1.2` | `700` | `0.5rem` | Component titles |
| `h5` | `1rem` (16px) | `1.2` | `700` | `1rem` | Small titles |
| `h6` | `0.875rem` (14px) | `1.2` | `700` | `1rem` | Smallest titles |

**Mobile Responsive Adjustments**:
- `h1`: `1.75rem` (28px) on mobile
- `h2`: `1.5rem` (24px) on mobile
- `h3`: `1.25rem` (20px) on mobile

#### Body Text

| Element | Font Size | Line Height | Color | Usage |
|---------|-----------|-------------|-------|-------|
| Body (p) | `1rem` (16px) | `1.6` | `--text-secondary` | Default body text |
| Small Text | `0.875rem` (14px) | `1.5` | `--text-secondary` | Descriptions, metadata |
| Extra Small | `0.75rem` (12px) | `1.5` | `--text-muted` | Labels, timestamps |

#### Chat Interface Typography

**Mobile**:
- Chat content: `0.875rem` (14px) - Messenger/WhatsApp-like size
- Line height: `1.5`

**Desktop** (≥640px):
- Chat content: `0.9375rem` (15px) - Slightly larger for readability
- Line height: `1.5`

#### Code Typography

| Element | Font Size | Font Family | Usage |
|---------|-----------|-------------|-------|
| Code blocks | `0.8125rem` (13px) | Monospace | Code snippets |
| Inline code | `0.875rem` (14px) | Monospace | Inline code |
| Mobile code | `0.75rem` (12px) | Monospace | Code on mobile |

### Typography Usage Patterns

#### Heading Hierarchy Example

```html
<h1>Main Page Title</h1>
<p class="section-description">Page description text</p>

<h2>Section Title</h2>
<p>Section content...</p>

<h3>Subsection Title</h3>
<p>Subsection content...</p>
```

#### Text Emphasis

```html
<p>Regular body text</p>
<p><strong>Bold text for emphasis</strong></p>
<p><em>Italic text for subtle emphasis</em></p>
<p class="text-muted">Muted text for secondary information</p>
```

#### Component-Specific Typography

**Card Titles**:
- Size: `1.25rem` (20px)
- Weight: `700`
- Margin bottom: `0.5rem`

**Card Descriptions**:
- Size: `0.875rem` (14px)
- Color: `--text-secondary`
- Line height: `1.5`

**Badge Text**:
- Size: `0.75rem` (12px)
- Weight: `600`
- Letter spacing: Normal

**Button Text**:
- Size: `0.875rem` (14px) default
- Weight: `500`
- Small: `0.8125rem` (13px)
- Large: `1rem` (16px)

---

## Spacing System

The spacing system uses a consistent rem-based scale for predictable, harmonious layouts.

### Spacing Scale

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `--spacing-xs` | `0.5rem` | 8px | Tight spacing, icon gaps |
| `--spacing-sm` | `1rem` | 16px | Standard spacing, margins |
| `--spacing-md` | `1.5rem` | 24px | Medium spacing, card padding |
| `--spacing-lg` | `2rem` | 32px | Large spacing, section margins |
| `--spacing-xl` | `3rem` | 48px | Extra large spacing |
| `--spacing-2xl` | `4rem` | 64px | Section separators |

### Spacing Usage Guidelines

#### Padding Patterns

**Cards**:
- Header/Content/Footer: `var(--spacing-md)` (1.5rem / 24px)
- Mobile: `var(--spacing-sm)` (1rem / 16px)

**Buttons**:
- Default: `0.625rem 1rem` (10px vertical, 16px horizontal)
- Small: `0.5rem 0.75rem` (8px vertical, 12px horizontal)
- Large: `0.75rem 1.5rem` (12px vertical, 24px horizontal)

**Inputs**:
- Default: `0.625rem 0.75rem` (10px vertical, 12px horizontal)

**Sections**:
- Desktop: `var(--spacing-lg)` (2rem / 32px)
- Mobile: `0` (no padding, handled by container)

#### Margin Patterns

**Headings**:
- `h1`: `margin-bottom: var(--spacing-md)` (1.5rem)
- `h2`: `margin-top: var(--spacing-xl)`, `margin-bottom: var(--spacing-md)`
- `h3`: `margin-top: var(--spacing-lg)`, `margin-bottom: var(--spacing-sm)`

**Paragraphs**:
- `margin-bottom: var(--spacing-sm)` (1rem)

**Sections**:
- `margin-bottom: var(--spacing-2xl)` (4rem)
- First section: `margin-top: var(--spacing-lg)` (2rem)

#### Gap Patterns (Flexbox/Grid)

**Component Examples**:
- Small gaps: `var(--spacing-xs)` (0.5rem)
- Standard gaps: `var(--spacing-sm)` (1rem)
- Medium gaps: `var(--spacing-md)` (1.5rem)

### Tailwind Spacing Utilities

Common Tailwind spacing classes used in the project:

```tsx
// Padding
className="p-4"        // padding: 1rem
className="px-4"       // padding-left/right: 1rem
className="py-2"       // padding-top/bottom: 0.5rem
className="pt-6"       // padding-top: 1.5rem

// Margin
className="mb-4"       // margin-bottom: 1rem
className="mt-8"       // margin-top: 2rem
className="mx-auto"    // margin-left/right: auto

// Gap (Flexbox/Grid)
className="gap-2"      // gap: 0.5rem
className="gap-4"      // gap: 1rem
className="gap-6"      // gap: 1.5rem
```

---

## Component Styles

### Buttons

#### Button Variants

| Variant | Background | Text Color | Border | Usage |
|---------|-----------|------------|--------|-------|
| `btn-default` | `--text-primary` (#000) | `--bg-primary` (#fff) | None | Primary actions |
| `btn-destructive` | `--accent-red` (#ef4444) | White | None | Delete, dangerous actions |
| `btn-outline` | Transparent | `--text-primary` | `--border-medium` | Secondary actions |
| `btn-secondary` | `--bg-tertiary` | `--text-primary` | None | Tertiary actions |
| `btn-ghost` | Transparent | `--text-primary` | None | Subtle actions |
| `btn-link` | Transparent | `--text-primary` | None | Link-style buttons |

#### Button Sizes

| Size | Padding | Font Size | Min Height | Usage |
|------|---------|-----------|------------|-------|
| Small (`btn-sm`) | `0.5rem 0.75rem` | `0.8125rem` (13px) | 28px (mobile), 32px (desktop) | Compact spaces |
| Default | `0.625rem 1rem` | `0.875rem` (14px) | 32px (mobile), 40px (tablet) | Standard use |
| Large (`btn-lg`) | `0.75rem 1.5rem` | `1rem` (16px) | Auto | Prominent actions |

#### Button States

**Hover States**:
- Default: `background: #1f2937`, `transform: translateY(-1px)`, subtle shadow
- Destructive: `background: #dc2626`, `transform: translateY(-1px)`, colored shadow
- Outline: `background: var(--bg-secondary)`, `border-color: var(--text-primary)`
- Secondary: `background: var(--border-light)`
- Ghost: `background: var(--bg-secondary)`

**Disabled State**:
- `opacity: 0.5`
- `cursor: not-allowed`
- No hover effects

**Focus State**:
- `outline: 2px solid var(--accent-blue)`
- `outline-offset: 2px`

#### Button Icon Style

```css
.btn-icon {
  background: transparent;
  padding: var(--spacing-xs);
  min-width: 32px;
  min-height: 32px;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.btn-icon:hover {
  background: var(--bg-tertiary);
  transform: scale(1.05);
}
```

### Form Elements

#### Text Input

```css
.input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input:disabled {
  background: var(--bg-secondary);
  opacity: 0.6;
  cursor: not-allowed;
}
```

#### Textarea

- Base styles similar to input
- `resize: vertical`
- `min-height: 52px`
- Mobile chat input: `font-size: 0.75rem`, `line-height: 1.2`
- Desktop chat input: `font-size: 0.9375rem`, `line-height: 1.5`

#### Select

- Same base styles as input
- `cursor: pointer`
- Custom styling for dropdown arrow

#### Checkbox

- Size: `1rem × 1rem` (16px × 16px)
- Border radius: `0.25rem` (4px)
- Checked: Black background with white checkmark
- Disabled: `opacity: 0.5`

#### Radio Button

- Size: `1rem × 1rem` (16px × 16px)
- Border radius: `50%` (circular)
- Checked: Black border with black inner circle (`0.5rem` diameter)
- Disabled: `opacity: 0.5`

#### Switch/Toggle

- Size: `2.5rem × 1.25rem` (40px × 20px)
- Border radius: `9999px` (fully rounded)
- Unchecked: `--border-medium` background
- Checked: `--accent-green` background
- Thumb: `1rem × 1rem` white circle with shadow
- Transition: `transform 0.2s`

### Cards

#### Basic Card Structure

```html
<div class="card">
  <div class="card-header">
    <div class="card-title">Title</div>
    <div class="card-description">Description</div>
  </div>
  <div class="card-content">
    <!-- Content -->
  </div>
  <div class="card-footer">
    <!-- Footer actions -->
  </div>
</div>
```

#### Card Styles

**Base Card**:
- Background: `var(--bg-primary)`
- Border: `1px solid var(--border-light)`
- Border radius: `var(--radius-md)` (0.5rem)
- Box shadow: `var(--shadow-sm)`
- Transition: `box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease`

**Hover State**:
- Box shadow: `var(--shadow-lg)`
- Border color: `var(--border-medium)`
- Transform: `translateY(-1px)` (subtle lift)

**Card Header**:
- Padding: `var(--spacing-md)` (1.5rem)
- Border bottom: `1px solid var(--border-light)`

**Card Content**:
- Padding: `var(--spacing-md)` (1.5rem)

**Card Footer**:
- Padding: `var(--spacing-md)` (1.5rem)
- Border top: `1px solid var(--border-light)`
- Background: `var(--bg-secondary)`

#### Conversation Card (Special Variant)

- Header padding: `1rem 1.5rem 0.875rem 1.5rem`
- Title: `1rem`, weight `600`, line-height `1.4`
- Content padding: `1rem 1.5rem`
- Last child (timestamp): `0.75rem`, `--text-muted`

### Badges

#### Badge Variants

| Variant | Background | Text Color | Border | Usage |
|---------|-----------|------------|--------|-------|
| `badge-default` | `--text-primary` | `--bg-primary` | `--text-primary` | Primary status |
| `badge-secondary` | `--bg-tertiary` | `--text-primary` | `--border-medium` | Secondary status |
| `badge-destructive` | `--accent-red` | White | `--accent-red` | Error, danger |
| `badge-outline` | Transparent | `--text-primary` | `--border-medium` (1.5px) | Subtle status |

#### Badge Styles

- Padding: `0.25rem 0.625rem` (4px vertical, 10px horizontal)
- Font size: `0.75rem` (12px)
- Font weight: `600`
- Border radius: `9999px` (fully rounded)
- Transition: `all 0.2s ease`

**Dark Mode Adjustments**:
- Secondary: `background: #333333`, `border-color: #4b5563`
- Outline: `border-color: #4b5563`

### Alerts

#### Alert Structure

```html
<div class="alert">
  <div class="alert-icon">ℹ</div>
  <div class="alert-content">
    <div class="alert-title">Title</div>
    <div class="alert-description">Description</div>
  </div>
</div>
```

#### Alert Variants

**Info Alert**:
- Background: `var(--bg-info)` (#f0f9ff)
- Border: `1px solid var(--border-light)`
- Icon color: `var(--accent-blue)`

**Destructive Alert**:
- Background: `#fef2f2` (light theme), `#7f1d1d` (dark theme)
- Border: `2px solid #ef4444`
- Box shadow: `0 0 0 1px rgba(239, 68, 68, 0.1)`
- Icon color: `#dc2626` (light), `#fca5a5` (dark)
- Title color: `#991b1b` (light), `#ffffff` (dark)
- Description color: `#7f1d1d` (light), `#fecaca` (dark)

#### Alert Styles

- Padding: `var(--spacing-md)` (1.5rem)
- Border radius: `var(--radius-md)`
- Display: `flex`
- Gap: `var(--spacing-sm)` (1rem)
- Mobile: `flex-direction: column`, reduced padding

### Breadcrumbs

#### Breadcrumb Structure

```html
<nav class="breadcrumb">
  <a href="#" class="breadcrumb-link-with-icon">
    <svg class="breadcrumb-icon">...</svg>
    Home
  </a>
  <span class="breadcrumb-separator">
    <svg>...</svg>
  </span>
  <span class="breadcrumb-current">Current Page</span>
</nav>
```

#### Breadcrumb Styles

**Base**:
- Font size: `0.875rem` (14px)
- Color: `var(--text-secondary)`
- Gap: `0.5rem` (mobile), `0.75rem` (desktop ≥640px)
- Display: `flex`, `align-items: center`

**Links**:
- Color: `var(--text-secondary)`
- Hover: `color: var(--text-primary)`, underline with `text-underline-offset: 4px`

**Current Page**:
- Font weight: `500`
- Color: `var(--text-primary)`
- Max width: `200px` with ellipsis

**Separator**:
- Color: `var(--text-muted)`
- Opacity: `0.6`
- Icon size: `0.875rem × 0.875rem`

**Subtle Variant** (`breadcrumb-subtle`):
- Padding: `0.5rem 0.75rem`
- Border radius: `0.375rem`
- Background: `rgba(0, 0, 0, 0.03)` (light), `rgba(255, 255, 255, 0.05)` (dark)

### Chat Components

#### Chat Message

**User Message**:
- Background: `var(--bg-secondary)`
- Avatar: Blue (`--accent-blue`), white text
- Padding: `var(--spacing-md)` (desktop), `0.5rem 0.75rem` (mobile)
- Gap: `var(--spacing-md)` (desktop), `0.5rem` (mobile)

**Bot Message**:
- Background: `var(--bg-primary)`
- Avatar: `var(--bg-tertiary)`, `--text-secondary` text
- Same padding/gap as user message

**Avatar**:
- Size: `2rem × 2rem` (32px × 32px)
- Border radius: `var(--radius-md)`
- Font size: `0.875rem` (desktop), `0.75rem` (mobile)
- Flex-shrink: `0`

**Chat Content**:
- Font size: `0.875rem` (mobile), `0.9375rem` (desktop ≥640px)
- Line height: `1.5`
- Color: `var(--text-primary)`

#### Chat Input

**Mobile**:
- Container padding: `2.5px`
- Border radius: `0.5rem`
- Textarea: `font-size: 0.75rem`, `line-height: 1.2`, `padding: 0.25rem 0.375rem 0.25rem 0.25rem`
- Button: `28px × 28px`, icon `14px × 14px`

**Desktop**:
- Container padding: `0.75rem`
- Border radius: `0.75rem`
- Textarea: `font-size: 0.9375rem`, `line-height: 1.5`, `padding: 0.5rem 2.5rem 0.5rem 0.5rem`
- Button: `36px × 36px`, icon `18px × 18px`

**Common Styles**:
- Background: `rgba(249, 250, 251, 0.5)`
- Border: `1px solid var(--border-medium)`
- Max width: `56rem` (896px)
- Transition: `border-color 0.2s`

### Project Card

**Structure**:
```html
<div class="project-card">
  <div class="project-card-header">
    <div>
      <div class="project-card-title">📁 Title</div>
      <div class="project-card-meta">📍 Address</div>
    </div>
    <span class="badge">Status</span>
  </div>
  <!-- Metadata -->
</div>
```

**Styles**:
- Padding: `var(--spacing-md)` (desktop), `var(--spacing-sm)` (mobile)
- Border: `1px solid var(--border-light)`
- Border radius: `var(--radius-md)`
- Box shadow: `var(--shadow-sm)`
- Cursor: `pointer`
- Hover: `box-shadow: var(--shadow-lg)`, `transform: translateY(-2px)`, `border-color: var(--border-medium)`

**Title**:
- Font size: `1.125rem` (18px)
- Font weight: `600`
- Margin bottom: `var(--spacing-xs)`

**Meta**:
- Font size: `0.875rem` (14px)
- Color: `var(--text-secondary)`
- Display: `flex`, `align-items: center`, `gap: var(--spacing-xs)`

---

## Shadows & Elevation

### Shadow Scale

| Token | Light Theme | Dark Theme | Usage |
|-------|-------------|------------|-------|
| `--shadow-sm` | `0 1px 2px 0 rgba(0, 0, 0, 0.05)` | `0 1px 2px 0 rgba(0, 0, 0, 0.4)` | Cards, subtle elevation |
| `--shadow-md` | `0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)` | `0 2px 4px 0 rgba(0, 0, 0, 0.5), 0 1px 2px -1px rgba(0, 0, 0, 0.5)` | Modals, dropdowns |
| `--shadow-lg` | `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)` | `0 8px 12px -2px rgba(0, 0, 0, 0.6), 0 4px 6px -2px rgba(0, 0, 0, 0.6)` | Elevated cards, hover states |

### Shadow Usage

**Cards**:
- Default: `var(--shadow-sm)`
- Hover: `var(--shadow-lg)`

**Dropdowns/Modals**:
- `var(--shadow-lg)` for depth

**Buttons**:
- Hover: `0 2px 4px rgba(0, 0, 0, 0.1)` (default)
- Destructive hover: `0 2px 4px rgba(239, 68, 68, 0.3)`

**Mobile Menu Dropdown**:
- `var(--shadow-lg)` for visibility

**Switch Thumb**:
- `var(--shadow-sm)` for depth

### Elevation Hierarchy

1. **Base Level** (no shadow): Body, sections
2. **Level 1** (`shadow-sm`): Cards, inputs
3. **Level 2** (`shadow-md`): Modals, dropdowns
4. **Level 3** (`shadow-lg`): Hovered cards, active modals

---

## Animations & Transitions

### Transition Durations

| Duration | Value | Usage |
|----------|-------|-------|
| Fast | `0.15s` | Icon hover transforms |
| Standard | `0.2s` | Most hover states, color changes |
| Slow | `0.3s` | Theme transitions, progress bars |

### Common Transitions

#### Theme Transition

```css
--transition-theme: background-color 0.3s ease, 
                    color 0.3s ease, 
                    border-color 0.3s ease;
```

Applied to: `body`, sections, cards, buttons, inputs

#### Button Transitions

```css
transition: var(--transition-theme), 
            all 0.2s ease;
```

Includes: background-color, color, border-color, transform, box-shadow

#### Card Transitions

```css
transition: var(--transition-theme), 
            box-shadow 0.2s ease, 
            transform 0.2s ease, 
            border-color 0.2s ease;
```

#### Input Transitions

```css
transition: var(--transition-theme), 
            border-color 0.2s;
```

### Transform Animations

**Button Hover**:
- `transform: translateY(-1px)` - Subtle lift
- `transform: scale(1.05)` - Icon buttons

**Card Hover**:
- `transform: translateY(-1px)` - Subtle lift
- Project card: `transform: translateY(-2px)` - More pronounced

**Mobile Menu**:
- Open: `transform: translateY(0)` from `translateY(-10px)`
- Transition: `0.2s ease`

**Switch**:
- Thumb: `transform: translateX(1.25rem)` when checked
- Transition: `0.2s`

### Custom Animations

#### Fade In

```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in {
  animation: fade-in 200ms ease-out;
}
```

#### Slide In from Bottom

```css
@keyframes slide-in-from-bottom {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-in-from-bottom-2 {
  animation: slide-in-from-bottom 200ms ease-out;
}
```

#### Slide In from Right

```css
@keyframes slide-in-from-right {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.slide-in-from-right {
  animation: slide-in-from-right 400ms ease-out;
}
```

#### Pulse Highlight (Search)

```css
@keyframes pulse-highlight {
  0% {
    background-color: #fbbf24;
    box-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
  }
  100% {
    background-color: #fcd34d;
    box-shadow: none;
  }
}
```

### Accordion Animation

```css
@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}

@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}
```

Duration: `0.2s ease-out`

---

## Border Radius

### Radius Scale

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `--radius-sm` | `0.375rem` | 6px | Small elements, buttons, inputs |
| `--radius-md` | `0.5rem` | 8px | Cards, modals, default radius |
| `--radius-lg` | `0.75rem` | 12px | Large cards, containers |

### Tailwind Border Radius

The project uses Tailwind's border radius system with CSS variables:

```css
--radius: 0.5rem;  /* Base radius */

/* Tailwind classes */
rounded-sm: calc(var(--radius) - 4px)  /* 0.125rem / 2px */
rounded-md: calc(var(--radius) - 2px)   /* 0.375rem / 6px */
rounded-lg: var(--radius)               /* 0.5rem / 8px */
```

### Component-Specific Radius

**Buttons**:
- Default: `var(--radius-md)` (0.5rem)
- Small: `var(--radius-md)` (0.5rem)
- Icon buttons: `var(--radius-sm)` (0.375rem)

**Cards**:
- `var(--radius-md)` (0.5rem)

**Inputs**:
- `var(--radius-md)` (0.5rem)

**Badges**:
- `9999px` (fully rounded/pill shape)

**Switches**:
- `9999px` (fully rounded)

**Checkboxes**:
- `0.25rem` (4px) - Slightly rounded corners

**Code Blocks**:
- `var(--radius-md)` (0.5rem)

**Mobile Menu Dropdown**:
- `var(--radius-md)` (0.5rem)

**Chat Input Container**:
- Mobile: `0.5rem` (8px)
- Desktop: `0.75rem` (12px)

---

## Opacity & Transparency

### Opacity Values

| Value | Usage |
|-------|-------|
| `0.5` | Disabled buttons, checkboxes, radios |
| `0.6` | Disabled inputs, breadcrumb separators |
| `0.8` | Hover states (some), text on colored backgrounds |

### Transparency Usage

**Backgrounds**:
- Chat input: `rgba(249, 250, 251, 0.5)` - Semi-transparent light gray
- Breadcrumb subtle: `rgba(0, 0, 0, 0.03)` (light), `rgba(255, 255, 255, 0.05)` (dark)

**Focus States**:
- Input focus ring: `rgba(59, 130, 246, 0.1)` - 10% blue opacity
- Destructive alert shadow: `rgba(239, 68, 68, 0.1)` (light), `rgba(239, 68, 68, 0.3)` (dark)

**Hover States**:
- Button default hover: `background: #1f2937` (slightly lighter than black)
- Button destructive hover: `background: #dc2626` (slightly lighter red)

**Disabled States**:
- Buttons: `opacity: 0.5`
- Inputs: `opacity: 0.6`
- Checkboxes/Radios: `opacity: 0.5`

---

## Common Tailwind CSS Usage

### Utility Class Patterns

#### Layout Utilities

```tsx
// Flexbox
className="flex"                    // display: flex
className="flex-col"                // flex-direction: column
className="items-center"            // align-items: center
className="justify-between"          // justify-content: space-between
className="gap-2"                   // gap: 0.5rem
className="gap-4"                   // gap: 1rem

// Grid
className="grid"                    // display: grid
className="grid-cols-2"             // grid-template-columns: repeat(2, minmax(0, 1fr))

// Positioning
className="relative"                 // position: relative
className="absolute"                 // position: absolute
className="sticky top-0"            // position: sticky, top: 0
className="z-50"                    // z-index: 50
```

#### Spacing Utilities

```tsx
// Padding
className="p-4"                     // padding: 1rem
className="px-4"                    // padding-left/right: 1rem
className="py-2"                    // padding-top/bottom: 0.5rem
className="pt-6"                    // padding-top: 1.5rem

// Margin
className="mb-4"                    // margin-bottom: 1rem
className="mt-8"                    // margin-top: 2rem
className="mx-auto"                 // margin-left/right: auto
```

#### Typography Utilities

```tsx
// Font sizes
className="text-sm"                 // font-size: 0.875rem (14px)
className="text-base"               // font-size: 1rem (16px)
className="text-lg"                 // font-size: 1.125rem (18px)
className="text-xl"                 // font-size: 1.25rem (20px)
className="text-2xl"                // font-size: 1.5rem (24px)

// Font weights
className="font-normal"             // font-weight: 400
className="font-medium"             // font-weight: 500
className="font-semibold"           // font-weight: 600
className="font-bold"               // font-weight: 700

// Text colors
className="text-foreground"         // Primary text color
className="text-muted-foreground"  // Muted text color
className="text-secondary-foreground" // Secondary text color

// Line height
className="leading-tight"            // line-height: 1.25
className="leading-normal"          // line-height: 1.5
className="leading-relaxed"        // line-height: 1.625
```

#### Color Utilities

```tsx
// Backgrounds
className="bg-background"           // Main background
className="bg-card"                 // Card background
className="bg-primary"              // Primary color background
className="bg-secondary"            // Secondary background
className="bg-muted"                // Muted background
className="bg-destructive"         // Destructive/error background

// Text colors
className="text-foreground"         // Primary text
className="text-primary-foreground"  // Text on primary bg
className="text-muted-foreground"  // Muted text
className="text-destructive"        // Error text

// Borders
className="border"                  // Border with default color
className="border-border"           // Border with border color
className="border-input"            // Input border color
```

#### Border Utilities

```tsx
className="border"                  // border: 1px solid
className="border-2"                // border-width: 2px
className="border-t"                // border-top: 1px solid
className="border-b"                // border-bottom: 1px solid
className="border-l-4"              // border-left: 4px solid
className="rounded-md"               // border-radius: var(--radius-md)
className="rounded-lg"               // border-radius: var(--radius-lg)
className="rounded-full"             // border-radius: 9999px
```

#### Shadow Utilities

```tsx
className="shadow-sm"               // box-shadow: var(--shadow-sm)
className="shadow-md"               // box-shadow: var(--shadow-md)
className="shadow-lg"               // box-shadow: var(--shadow-lg)
```

#### Interactive Utilities

```tsx
// Hover states
className="hover:bg-secondary"       // Background on hover
className="hover:text-foreground"   // Text color on hover
className="hover:border-primary"    // Border color on hover
className="hover:shadow-lg"        // Shadow on hover

// Focus states
className="focus:outline-none"      // Remove default outline
className="focus-visible:ring-2"    // Focus ring
className="focus-visible:ring-ring" // Focus ring color

// Disabled states
className="disabled:opacity-50"     // Opacity when disabled
className="disabled:cursor-not-allowed" // Cursor when disabled
```

#### Responsive Utilities

```tsx
// Mobile first
className="text-sm md:text-base"    // Small on mobile, base on tablet+
className="p-2 md:p-4"              // Less padding on mobile
className="flex-col md:flex-row"     // Column on mobile, row on tablet+
className="hidden md:block"         // Hidden on mobile, visible on tablet+
className="block md:hidden"         // Visible on mobile, hidden on tablet+
```

### Common Component Patterns

#### Card Component

```tsx
<div className="rounded-lg border bg-card text-card-foreground shadow-sm">
  <div className="flex flex-col space-y-1.5 p-6">
    <h3 className="text-2xl font-semibold leading-none tracking-tight">
      Title
    </h3>
    <p className="text-sm text-muted-foreground">
      Description
    </p>
  </div>
  <div className="p-6 pt-0">
    Content
  </div>
</div>
```

#### Button Component

```tsx
<button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90">
  Button Text
</button>
```

#### Input Component

```tsx
<input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
```

### Class Merging Utility

The project uses `cn()` utility (from `lib/utils.ts`) to merge Tailwind classes:

```tsx
import { cn } from '@/lib/utils';

// Merges and deduplicates classes
<div className={cn(
  "base-classes",
  condition && "conditional-classes",
  className  // Allows prop overrides
)} />
```

---

## Example Component Reference Design Code

### Button Component Example

```tsx
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
```

### Card Component Example

```tsx
import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-sm',
        className
      )}
      {...props}
    />
  )
);

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  )
);

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'text-2xl font-semibold leading-none tracking-tight',
        className
      )}
      {...props}
    />
  )
);

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
);

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
```

### Badge Component Example

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
```

### Chat Input Component Example

```tsx
<div className="flex items-end gap-2 border border-input rounded-lg bg-muted/50 p-3 max-w-3xl mx-auto transition-colors">
  <div className="relative flex-1 min-w-0">
    <textarea
      className="min-h-[44px] max-h-[200px] border-0 bg-transparent p-2 pr-10 resize-none overflow-hidden shadow-none text-sm md:text-base leading-relaxed focus:outline-none focus:ring-0"
      placeholder="Type your message..."
      rows={1}
    />
  </div>
  <button
    className="h-9 w-9 rounded-md flex-shrink-0 flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
    type="submit"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  </button>
</div>
```

### Project Card Component Example

```tsx
<div className="bg-card border border-border rounded-md p-4 cursor-pointer transition-all shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-border/80">
  <div className="flex justify-between items-start mb-4">
    <div className="flex-1">
      <div className="text-lg font-semibold mb-2">📁 Project Title</div>
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <span>📍</span>
        <span>123 Example Street, City</span>
      </div>
    </div>
    <Badge variant="default">Active</Badge>
  </div>
  <div className="text-sm text-muted-foreground space-y-2">
    <div className="flex items-center gap-2">
      <span>💬</span>
      <span>3 conversations</span>
    </div>
    <div className="flex items-center gap-2 text-xs">
      <span>🕐</span>
      <span>Updated 2 hours ago</span>
    </div>
  </div>
</div>
```

---

## Responsive Design

### Breakpoints

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| Mobile | `< 640px` | Default, mobile-first |
| Tablet | `≥ 640px` | Small tablets, large phones |
| Desktop | `≥ 768px` | Tablets, small desktops |
| Large Desktop | `≥ 1200px` | Large desktops |

### Mobile-First Approach

All styles are mobile-first. Desktop styles are added via media queries:

```css
/* Mobile (default) */
.component {
  padding: 1rem;
  font-size: 0.875rem;
}

/* Tablet and up */
@media (min-width: 640px) {
  .component {
    padding: 1.5rem;
    font-size: 0.9375rem;
  }
}

/* Desktop and up */
@media (min-width: 768px) {
  .component {
    padding: 2rem;
  }
}
```

### Responsive Typography

**Headings**:
- Mobile: Smaller sizes (h1: 1.75rem, h2: 1.5rem)
- Desktop: Full sizes (h1: 2.25rem, h2: 1.875rem)

**Body Text**:
- Mobile: `0.875rem` (14px)
- Desktop: `0.9375rem` (15px) for chat, `1rem` (16px) for body

**Code**:
- Mobile: `0.75rem` (12px)
- Desktop: `0.8125rem` (13px)

### Responsive Spacing

**Container Padding**:
- Mobile: `var(--spacing-sm)` (1rem)
- Tablet: `var(--spacing-md)` (1.5rem)
- Desktop: `var(--spacing-lg)` (2rem)

**Card Padding**:
- Mobile: `var(--spacing-sm)` (1rem)
- Desktop: `var(--spacing-md)` (1.5rem)

**Section Margins**:
- Mobile: `var(--spacing-xl)` (3rem)
- Desktop: `var(--spacing-2xl)` (4rem)

### Responsive Components

**Header Bar**:
- Mobile: Hamburger menu, reduced padding
- Desktop: Full actions bar, standard padding

**Breadcrumbs**:
- Mobile: Smaller font (`0.75rem`), ellipsis for long text
- Desktop: Standard font (`0.875rem`), full text

**Chat Messages**:
- Mobile: Reduced padding (`0.5rem 0.75rem`), smaller gap (`0.5rem`)
- Desktop: Standard padding (`var(--spacing-md)`), standard gap (`var(--spacing-md)`)

**Buttons**:
- Mobile: Minimum touch target `32px × 32px`
- Desktop: Standard sizes `40px × 40px` (tablet)

---

## Dark Mode

### Implementation

Dark mode is implemented using the `.dark` class on the root element:

```html
<html class="dark">
  <!-- Dark mode styles apply -->
</html>
```

### Theme Toggle

The theme toggle:
1. Detects system preference on load
2. Saves user preference to `localStorage`
3. Applies `.dark` class to `<html>` element
4. Listens for system theme changes (if no manual preference)

### Color Adjustments

**Backgrounds**:
- Primary: `#ffffff` → `#0a0a0a` (near black)
- Secondary: `#f9fafb` → `#1a1a1a`
- Tertiary: `#f3f4f6` → `#2a2a2a`

**Text**:
- Primary: `#000000` → `#ffffff`
- Secondary: `#4b5563` → `#e5e7eb` (improved contrast)
- Muted: `#9ca3af` → `#b1b5bb` (WCAG AA compliant)

**Borders**:
- Light: `#e5e7eb` → `#374151`
- Medium: `#d1d5db` → `#4b5563`

**Shadows**:
- Enhanced opacity for better visibility in dark mode
- `shadow-sm`: `0.05` → `0.4` opacity
- `shadow-md`: `0.1` → `0.5` opacity
- `shadow-lg`: `0.1` → `0.6` opacity

### Component-Specific Dark Mode

**Badges**:
- Secondary: `#f3f4f6` → `#333333`
- Outline: Border color `#d1d5db` → `#4b5563`

**Alerts**:
- Destructive: Background `#fef2f2` → `#7f1d1d`
- Enhanced shadows for better visibility

**Breadcrumbs**:
- Subtle variant: `rgba(0, 0, 0, 0.03)` → `rgba(255, 255, 255, 0.05)`

### Code Syntax Colors

All code syntax colors are adjusted for better contrast in dark mode:
- Keywords: `#8b5cf6` → `#a78bfa` (lighter purple)
- Strings: `#10b981` → `#34d399` (lighter green)
- Types: `#3b82f6` → `#60a5fa` (lighter blue)
- Comments: `#9ca3af` → `#6b7280` (darker gray)
- Background: `#f9fafb` → `#1a1a1a`

---

## Accessibility

### Color Contrast

All text colors meet WCAG AA standards:
- **Primary text**: 21:1 contrast ratio
- **Secondary text**: 7.5:1 (light), 4.5:1+ (dark)
- **Muted text**: 3.8:1 (light), WCAG AA compliant (dark)

### Focus States

All interactive elements have visible focus states:

```css
/* Buttons */
.btn:focus {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

/* Inputs */
.input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
```

### Touch Targets

Minimum touch target sizes:
- **Mobile buttons**: `32px × 32px` minimum
- **Icon buttons**: `44px × 44px` on mobile (iOS/Android guidelines)
- **Menu items**: `44px` minimum height

### Semantic HTML

- Proper heading hierarchy (h1 → h2 → h3)
- Semantic elements (`<nav>`, `<header>`, `<main>`, `<footer>`)
- ARIA labels for icon-only buttons
- Proper form labels and associations

### Keyboard Navigation

- All interactive elements are keyboard accessible
- Focus order follows visual hierarchy
- Escape key closes modals/dropdowns
- Tab navigation works throughout

---

## Best Practices

### CSS Variable Usage

**Always use CSS variables** for colors, spacing, and other design tokens:

```css
/* ✅ Good */
color: var(--text-primary);
padding: var(--spacing-md);

/* ❌ Bad */
color: #000000;
padding: 24px;
```

### Component Styling

**Use Tailwind utilities** for layout and spacing:

```tsx
// ✅ Good
<div className="flex items-center gap-4 p-6">

// ❌ Bad
<div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
```

### Theme Transitions

**Always include theme transition** for theme-aware properties:

```css
/* ✅ Good */
.component {
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: var(--transition-theme);
}

/* ❌ Bad */
.component {
  background: var(--bg-primary);
  color: var(--text-primary);
  /* Missing transition */
}
```

### Responsive Design

**Mobile-first approach**:

```css
/* ✅ Good - Mobile first */
.component {
  padding: 1rem;
}

@media (min-width: 640px) {
  .component {
    padding: 1.5rem;
  }
}

/* ❌ Bad - Desktop first */
.component {
  padding: 1.5rem;
}

@media (max-width: 639px) {
  .component {
    padding: 1rem;
  }
}
```

### Class Merging

**Use `cn()` utility** for conditional classes:

```tsx
// ✅ Good
<div className={cn(
  "base-classes",
  isActive && "active-classes",
  className
)} />

// ❌ Bad
<div className={`base-classes ${isActive ? "active-classes" : ""} ${className}`} />
```

### Spacing Consistency

**Use spacing tokens** instead of arbitrary values:

```css
/* ✅ Good */
.component {
  margin-bottom: var(--spacing-md);
  gap: var(--spacing-sm);
}

/* ❌ Bad */
.component {
  margin-bottom: 20px;
  gap: 12px;
}
```

### Color Usage

**Use semantic color tokens**:

```css
/* ✅ Good */
.text-primary { color: var(--text-primary); }
.bg-secondary { background: var(--bg-secondary); }

/* ❌ Bad */
.text-black { color: #000000; }
.bg-gray { background: #f9fafb; }
```

---

## Conclusion

This style guide provides a comprehensive reference for the MWPLU Design System. For questions or updates, refer to the `style-reference.html` and `style-reference.css` files, or consult the component library in the `components/ui/` directory.

**Last Updated**: 2024

