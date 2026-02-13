# Mockup Integration Guide

## Overview
This directory contains design mockups for the Danny Courier Ltd website and documentation on how to analyze and integrate them into the project.

## Directory Structure

```
mockups/
├── hero/                 # Hero section mockups
├── services/             # Services section mockups
├── about/                # About section mockups
├── contact/              # Contact section mockups
├── analysis/             # Analysis documents and notes
└── README.md            # This file
```

## How to Add a Mockup

### 1. Upload Mockup Files
Place your mockup files in the appropriate directory based on the section they represent:

- **Images**: PNG, JPG, or SVG formats
- **Design Files**: Figma links, Sketch files, Adobe XD files
- **Documentation**: Any additional design specs or notes

### 2. Naming Convention
Use descriptive names that indicate the section and version:
- `hero-section-v1.png`
- `hero-section-mobile-v1.png`
- `services-grid-v2.png`
- `contact-form-desktop.png`

### 3. Create Analysis Document
For each mockup, create an analysis document in the `analysis/` directory:
- Document key design elements
- List required components
- Note color schemes, typography, spacing
- Identify interactive elements
- Break down implementation tasks

## Mockup Analysis Process

### Step 1: Visual Analysis
1. **Layout Structure**: Identify main sections and their arrangement
2. **Components**: List all UI components (buttons, forms, cards, etc.)
3. **Typography**: Document fonts, sizes, weights, line heights
4. **Colors**: Extract color palette with hex codes
5. **Spacing**: Note padding, margins, and gaps
6. **Responsive Behavior**: Identify breakpoints and layout changes

### Step 2: Technical Requirements
1. **Dependencies**: Identify any new libraries or packages needed
2. **Assets**: List images, icons, or other media assets required
3. **Interactions**: Document hover states, animations, transitions
4. **Accessibility**: Note ARIA labels, keyboard navigation requirements
5. **Performance**: Consider image optimization, lazy loading needs

### Step 3: Implementation Plan
1. **Break Down Tasks**: Divide into small, manageable components
2. **Prioritize**: Order tasks by dependency and importance
3. **Estimate**: Roughly estimate complexity of each task
4. **Test Plan**: Define how to test each component

## Example: Analyzing a Hero Section Mockup

### Visual Elements
- Full-width hero with background image or gradient
- Headline text (40-56px, bold)
- Subheading text (18-24px, regular)
- Call-to-action button (primary color, rounded corners)
- Optional: Hero image/illustration on right side

### Colors
- Primary: #2563eb (blue)
- Secondary: #10b981 (green)
- Text: #1f2937 (dark gray)
- Background: #ffffff (white)

### Components Needed
1. `Hero` component with props for title, subtitle, CTA
2. `Button` component with primary/secondary variants
3. Background image handling with Next.js Image optimization

### Implementation Steps
1. Create `Hero.tsx` component in `app/components/`
2. Extract hero content from mockup
3. Style component to match mockup specs
4. Add responsive styles for mobile/tablet
5. Optimize images and add to `/public/images/`
6. Test on different screen sizes
7. Verify accessibility (contrast, focus states)

## Integration into Project

### Current Project Structure
```
app/
├── components/         # Reusable components
├── page.tsx           # Main page (currently inline styles)
├── layout.tsx         # Root layout
└── globals.css        # Global styles
```

### Recommended Approach
1. **Component-Based**: Create separate components for each section
2. **Styling**: Use CSS modules or Tailwind CSS for maintainability
3. **Reusability**: Design components to be reusable across pages
4. **Testing**: Test each component individually before integration
5. **Gradual Migration**: Replace sections incrementally, not all at once

## Best Practices

### Design Consistency
- Use existing design tokens (colors, spacing, typography)
- Maintain consistency with current website style
- Ensure responsive design at all breakpoints
- Follow accessibility standards (WCAG 2.1 AA)

### Code Quality
- Write clean, maintainable component code
- Use TypeScript for type safety
- Follow Next.js best practices
- Optimize images and assets
- Ensure good performance (Lighthouse scores)

### Documentation
- Comment complex logic
- Document component props and usage
- Update README with new components
- Keep mockup analysis up to date

## Tools and Resources

### Design Tools
- **Figma**: For viewing and inspecting Figma designs
- **Adobe XD**: For XD files
- **Sketch**: For Sketch files

### Development Tools
- **Next.js Image**: For optimized images
- **CSS Variables**: For design tokens
- **TypeScript**: For type-safe components
- **ESLint**: For code quality

### Analysis Tools
- **Browser DevTools**: For inspecting existing styles
- **Lighthouse**: For performance and accessibility
- **Responsively**: For testing responsive designs

## Need Help?

If you need assistance with:
- Analyzing a specific mockup
- Implementing a complex component
- Optimizing performance
- Accessibility concerns

Create an issue in the repository with the `design` or `mockup` label, and provide:
1. Link to or screenshot of the mockup
2. Specific question or concern
3. What you've tried so far
4. Any relevant code snippets

## Example Workflow

### Complete Mockup Integration Flow
```bash
# 1. Add mockup to appropriate directory
mockups/hero/hero-v2.png

# 2. Create analysis document
mockups/analysis/hero-v2-analysis.md

# 3. Extract design tokens
# Document colors, fonts, spacing in analysis

# 4. Identify required components
# List in analysis document

# 5. Create components
app/components/Hero.tsx
app/components/HeroCTA.tsx

# 6. Add assets
public/images/hero-background.jpg

# 7. Update page
# Integrate new components into app/page.tsx

# 8. Test thoroughly
# Multiple devices, browsers, accessibility

# 9. Document changes
# Update README, add comments
```

## Current Status

The Danny Courier Ltd website currently has:
- ✅ Complete homepage with all sections
- ✅ Responsive design
- ✅ Service offerings display
- ✅ Contact and quote forms
- ✅ Mobile and admin portals

Any new mockups should enhance or refine existing sections while maintaining consistency with the current design system.
