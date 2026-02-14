# Example: Hero Section Mockup Analysis

This is a complete example showing how to analyze and integrate a hero section mockup.

## Mockup Information
- **File Name**: hero-new-design-v1.png *(example - not included)*
- **Section**: Hero
- **Date Added**: 2026-02-13
- **Version**: v1

---

## 1. Visual Analysis

### Layout Structure
The hero section features a full-width design with:
- Left side: Text content (headline, subheading, CTA button)
- Right side: Hero illustration/image
- Container max-width: 1200px
- Centered content with padding on mobile

### Components Identified
- [x] Headline (H1)
- [x] Subheading (paragraph)
- [x] Primary CTA button
- [x] Hero image/illustration
- [x] Optional: Background gradient or pattern

### Typography
- **Heading 1**: System fonts, 48px, 700 weight, #1f2937 (dark gray)
- **Subheading**: System fonts, 20px, 400 weight, #6b7280 (medium gray)
- **Button Text**: System fonts, 16px, 600 weight, white
- **Line Height**: 1.2 for headings, 1.6 for body text

### Color Palette
- **Primary**: #2563eb - Main brand color (buttons, accents)
- **Secondary**: #10b981 - Accent color (highlights)
- **Text Primary**: #1f2937 - Main text color
- **Text Muted**: #6b7280 - Secondary text
- **Background**: #ffffff - White background
- **Gradient**: Linear gradient from #eff6ff to #ffffff (optional background)

### Spacing & Dimensions
- **Container Max Width**: 1200px
- **Section Padding**: 80px vertical, 20px horizontal (desktop)
- **Element Spacing**: 
  - Headline to subheading: 16px
  - Subheading to button: 32px
  - Text column to image: 64px (desktop)
- **Border Radius**: 8px for button
- **Button Padding**: 14px 32px

### Responsive Behavior
- **Desktop** (≥1024px): Two columns (text left, image right)
- **Tablet** (768px-1023px): Two columns with reduced spacing
- **Mobile** (≤767px): Single column, image below text, reduced padding (40px vertical)

---

## 2. Technical Requirements

### New Dependencies Needed
- [x] None - using existing Next.js and React

### Assets Required
- [ ] `hero-image.png` or `hero-illustration.svg` - Main hero visual
  - Dimensions: 600x400px minimum
  - Format: PNG with transparency or SVG
  - Optimized for web (< 200KB)

### Interactions & Animations
- [x] Hover effect on button (darker background)
- [x] Smooth transition on button hover (0.2s)
- [ ] Optional: Fade-in animation on page load
- [ ] Optional: Parallax effect on hero image

Specific interactions:
1. Button hover: Background darkens from #2563eb to #1d4ed8
2. Focus state: Add outline ring for keyboard navigation

### Accessibility Considerations
- [x] Color contrast meets WCAG AA standards (checked)
- [x] Keyboard navigation support for button
- [x] Screen reader friendly semantic HTML
- [x] Focus indicators visible
- [x] Alt text for hero image
- [x] Proper heading hierarchy (H1 for main headline)

Specific requirements:
1. Button must have `aria-label` if icon-only
2. Hero image needs descriptive alt text
3. Ensure 4.5:1 contrast ratio for text

### Performance Considerations
- [x] Image optimization using Next.js Image component
- [x] Lazy loading not needed (above fold)
- [x] Priority loading for hero image
- [x] WebP format with fallback

---

## 3. Implementation Plan

### Components to Create

1. **Component Name**: `Hero.tsx`
   - **Location**: `app/components/Hero.tsx`
   - **Purpose**: Reusable hero section component
   - **Props**: 
     ```typescript
     interface HeroProps {
       title: string;
       subtitle: string;
       ctaText: string;
       ctaLink: string;
       imageSrc: string;
       imageAlt: string;
     }
     ```
   - **Dependencies**: Next.js Image component

### Existing Components to Modify

1. **Component Name**: `page.tsx`
   - **Changes Needed**: Replace inline hero section with Hero component
   - **Reason**: Better code organization and reusability

### Styling Approach
- [x] Inline styles (matching existing pattern in page.tsx)
- [ ] CSS Modules
- [ ] Global CSS updates (for responsive media queries)

Specific styling notes:
- Use CSS custom properties from globals.css
- Add responsive media queries in globals.css
- Maintain inline styles for component-specific styling

### Implementation Steps

1. [x] Create Hero component structure
2. [ ] Implement basic layout (flex container)
3. [ ] Add text content styling
4. [ ] Add button with proper styling
5. [ ] Integrate Next.js Image for hero visual
6. [ ] Add responsive styles (mobile-first)
7. [ ] Implement hover and focus states
8. [ ] Optimize and add hero image asset
9. [ ] Test accessibility (keyboard nav, screen reader)
10. [ ] Test on multiple devices/browsers
11. [ ] Replace hero section in page.tsx
12. [ ] Review performance (Lighthouse)

### Estimated Complexity
- [ ] Low (1-2 hours)
- [x] Medium (3-5 hours)
- [ ] High (6+ hours)

### Potential Challenges
1. **Image optimization**: Need to balance quality and file size
   - Solution: Use Next.js Image with quality={85} and WebP format
2. **Responsive layout**: Text and image positioning on different screens
   - Solution: Use flexbox with flex-direction change at breakpoint
3. **Maintaining consistency**: Match existing website style
   - Solution: Reference globals.css variables and existing components

---

## 4. Testing Plan

### Visual Testing
- [ ] Desktop (Chrome, Firefox, Safari) - 1920x1080
- [ ] Tablet (iPad) - 768x1024
- [ ] Mobile (iPhone) - 375x667
- [ ] Cross-browser compatibility check

### Functional Testing
- [ ] CTA button links to correct page
- [ ] Hover states work correctly
- [ ] Focus states visible with keyboard navigation
- [ ] Responsive breakpoints trigger correctly

### Accessibility Testing
- [ ] Keyboard navigation (Tab through elements)
- [ ] Screen reader testing (VoiceOver/NVDA)
- [ ] Color contrast validation (WebAIM tool)
- [ ] Focus indicators clearly visible

### Performance Testing
- [ ] Lighthouse score ≥90 for Performance
- [ ] Hero image properly optimized (check Network tab)
- [ ] Load time under 2 seconds
- [ ] No Cumulative Layout Shift (CLS)

---

## 5. Integration Notes

### Files to Modify
- `app/components/Hero.tsx` - New component file
- `app/page.tsx` - Replace hero section with Hero component
- `app/globals.css` - Add responsive media queries if needed
- `public/images/hero-image.png` - New image asset

### Code Example

```tsx
// app/components/Hero.tsx
import Image from 'next/image';

interface HeroProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  imageSrc: string;
  imageAlt: string;
}

export default function Hero({ 
  title, 
  subtitle, 
  ctaText, 
  ctaLink, 
  imageSrc, 
  imageAlt 
}: HeroProps) {
  return (
    <section style={{
      padding: 'var(--space-16) var(--space-4)',
      backgroundColor: 'var(--color-bg)',
    }}>
      <div className="container" style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-16)',
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{
            fontSize: 'var(--font-size-4xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text)',
            marginBottom: 'var(--space-4)',
          }}>
            {title}
          </h1>
          <p style={{
            fontSize: 'var(--font-size-lg)',
            color: 'var(--color-text-muted)',
            marginBottom: 'var(--space-8)',
            lineHeight: 1.6,
          }}>
            {subtitle}
          </p>
          <a 
            href={ctaLink} 
            className="btn btn-primary"
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontWeight: 'var(--font-weight-semibold)',
              transition: 'background-color 0.2s',
            }}
          >
            {ctaText}
          </a>
        </div>
        <div style={{ flex: 1 }}>
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={600}
            height={400}
            priority
            quality={85}
          />
        </div>
      </div>
    </section>
  );
}
```

### Usage in page.tsx
```tsx
import Hero from './components/Hero';

// Replace current hero section with:
<Hero
  title="Fast, Reliable Courier Services"
  subtitle="Same day and express delivery across the UK and Europe"
  ctaText="Get a Quote"
  ctaLink="#quote"
  imageSrc="/images/hero-image.png"
  imageAlt="XDrive Logistics delivery van"
/>
```

### Compatibility Concerns
- [x] No breaking changes to existing functionality
- [x] Maintains current URL structure
- [x] Compatible with existing navigation
- [x] No conflicts with existing inline styles

### Rollback Plan
If implementation causes issues:
1. Revert Hero component file
2. Restore original inline hero section in page.tsx
3. Remove hero image from public/images/

---

## 6. Implementation Status

- [x] Component created
- [ ] Styling completed
- [ ] Testing completed
- [ ] Review completed
- [ ] Deployed to production

### Implementation Notes
This is an example analysis - actual implementation would follow these steps once a real mockup is provided.

---

## Summary

This example demonstrates the complete process of analyzing a mockup. The key steps are:

1. **Understand the design** - Break down visual elements
2. **Document everything** - Colors, fonts, spacing, components
3. **Plan implementation** - What to build and how
4. **Consider all aspects** - Responsive, accessible, performant
5. **Test thoroughly** - Multiple devices and browsers
6. **Integrate carefully** - Minimal changes to existing code

For a real mockup, you would:
1. Place the mockup image in `mockups/hero/`
2. Fill in this analysis template with actual measurements
3. Follow the implementation steps
4. Test and iterate
5. Deploy when ready

---

## Next Steps

When you have an actual mockup to integrate:

1. **Copy this template** to a new file (e.g., `hero-final-analysis.md`)
2. **Add your mockup** image to `mockups/hero/`
3. **Update all sections** with actual measurements and details
4. **Follow the implementation plan** step by step
5. **Test thoroughly** before deploying

---

*This example shows the level of detail needed for a successful mockup integration. Adjust the level of detail based on the complexity of your specific mockup.*
