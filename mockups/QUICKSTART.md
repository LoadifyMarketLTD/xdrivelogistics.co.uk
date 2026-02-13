# Quick Mockup Integration Guide

## 🚀 Fast Track: Adding a Mockup

### 1. Upload Your Mockup (30 seconds)
```bash
# Place your mockup file in the appropriate directory
# Example: For a hero section mockup
mockups/hero/hero-new-design-v1.png
```

### 2. Create Quick Analysis (5 minutes)
```bash
# Copy the template
cp mockups/analysis/TEMPLATE.md mockups/analysis/hero-new-design-analysis.md

# Fill in the key sections:
# - Visual Analysis (colors, fonts, spacing)
# - Components Needed
# - Implementation Steps
```

### 3. Extract Design Tokens (2 minutes)
Key things to document:
- **Colors**: Use color picker to get hex codes
- **Fonts**: Note font family, sizes, and weights
- **Spacing**: Measure padding and margins
- **Components**: List buttons, forms, cards, etc.

### 4. Plan Implementation (3 minutes)
Break down into tasks:
- What components to create?
- What files to modify?
- What assets are needed?

### 5. Implement (Time varies)
Follow the implementation steps in your analysis document.

---

## 📋 Checklist for Each Mockup

Before starting implementation:
- [ ] Mockup file added to correct directory
- [ ] Analysis document created
- [ ] Colors documented with hex codes
- [ ] Typography specified (font, size, weight)
- [ ] Spacing and dimensions noted
- [ ] Components list created
- [ ] Required assets listed
- [ ] Implementation steps outlined
- [ ] Responsive behavior defined
- [ ] Accessibility considered

During implementation:
- [ ] Components created/modified
- [ ] Styles match mockup
- [ ] Responsive on all devices
- [ ] Interactive elements work
- [ ] Images optimized
- [ ] Accessibility tested
- [ ] Performance checked

After implementation:
- [ ] Code reviewed
- [ ] Visual comparison with mockup
- [ ] Cross-browser tested
- [ ] Documentation updated

---

## 🎨 Design Token Quick Reference

### Current Website Design Tokens

#### Colors
```css
/* Primary Colors */
--color-primary: #2563eb;      /* Blue */
--color-secondary: #10b981;    /* Green */

/* Text Colors */
--color-text: #1f2937;         /* Dark Gray */
--color-text-muted: #6b7280;   /* Medium Gray */

/* Background */
--color-bg: #ffffff;           /* White */
--color-border: #e5e7eb;       /* Light Gray */
```

#### Typography
```css
/* Font Families */
--font-family-base: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

/* Font Sizes */
--font-size-xs: 12px;
--font-size-sm: 14px;
--font-size-base: 16px;
--font-size-lg: 18px;
--font-size-xl: 20px;
--font-size-2xl: 24px;
--font-size-3xl: 30px;
--font-size-4xl: 36px;

/* Font Weights */
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

#### Spacing
```css
/* Standard spacing scale */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

#### Border Radius
```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
```

#### Breakpoints
```css
/* Mobile First */
--breakpoint-sm: 640px;   /* Small tablets */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1280px;  /* Large desktop */
```

---

## 🛠️ Common Implementation Patterns

### Creating a New Component
```tsx
// app/components/Hero.tsx
interface HeroProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
}

export default function Hero({ title, subtitle, ctaText, ctaLink }: HeroProps) {
  return (
    <section style={{
      padding: 'var(--space-16) var(--space-4)',
      backgroundColor: 'var(--color-bg)',
    }}>
      <h1 style={{
        fontSize: 'var(--font-size-4xl)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--color-text)',
      }}>
        {title}
      </h1>
      <p style={{
        fontSize: 'var(--font-size-lg)',
        color: 'var(--color-text-muted)',
      }}>
        {subtitle}
      </p>
      <a href={ctaLink} className="btn btn-primary">
        {ctaText}
      </a>
    </section>
  );
}
```

### Adding Responsive Styles
```tsx
// Use media queries in inline styles
<div style={{
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 'var(--space-6)',
  // For desktop, use className with CSS
}} className="responsive-grid">

// In globals.css
.responsive-grid {
  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Optimizing Images
```tsx
import Image from 'next/image';

<Image
  src="/images/hero-background.jpg"
  alt="Description"
  width={1920}
  height={1080}
  priority // For above-fold images
  quality={85}
/>
```

---

## 🎯 Common Mockup Scenarios

### Scenario 1: New Hero Section
1. Add mockup: `mockups/hero/new-hero.png`
2. Create analysis: Document colors, text, CTA
3. Create component: `app/components/NewHero.tsx`
4. Replace in page: Update `app/page.tsx`
5. Test: All devices and browsers

### Scenario 2: Updated Service Cards
1. Add mockup: `mockups/services/service-cards-v2.png`
2. Create analysis: Card layout, icons, spacing
3. Update component: Modify existing service section
4. Add icons: Place in `public/icons/`
5. Test: Grid layout responsiveness

### Scenario 3: New Contact Form Design
1. Add mockup: `mockups/contact/form-redesign.png`
2. Create analysis: Form fields, validation, styling
3. Update component: Modify form in `app/page.tsx`
4. Test: Form validation and submission
5. Accessibility: Test keyboard navigation

---

## ⚡ Tips for Efficient Implementation

### Before You Start
1. **Review the existing code** - Understand current patterns
2. **Check for similar components** - Reuse where possible
3. **Plan for reusability** - Make components flexible
4. **Consider mobile first** - Start with mobile layout

### During Implementation
1. **Work incrementally** - Implement one section at a time
2. **Test frequently** - Check appearance after each change
3. **Use browser DevTools** - Inspect and compare with mockup
4. **Keep styles consistent** - Use existing design tokens

### After Implementation
1. **Visual comparison** - Compare side-by-side with mockup
2. **Responsive testing** - Test all breakpoints
3. **Performance check** - Run Lighthouse audit
4. **Accessibility audit** - Test with keyboard and screen reader

---

## 🆘 Troubleshooting

### Mockup doesn't match implementation
- **Check spacing**: Use DevTools to measure actual spacing
- **Verify colors**: Use color picker to compare hex codes
- **Font rendering**: Different OS/browsers render fonts differently
- **Aspect ratios**: Ensure images maintain correct proportions

### Responsive design issues
- **Mobile first**: Start with mobile styles, add desktop enhancements
- **Test real devices**: Emulators don't always match real devices
- **Flexible units**: Use percentages, viewport units, not fixed pixels
- **Breakpoints**: Test at exact breakpoint values

### Performance problems
- **Optimize images**: Use WebP format, compress files
- **Lazy load**: Use Next.js Image component
- **Code split**: Separate large components
- **Minimize CSS**: Remove unused styles

---

## 📚 Additional Resources

### Documentation
- [Main Mockup README](./README.md) - Complete guide
- [Analysis Template](./analysis/TEMPLATE.md) - Detailed template
- [Next.js Image Optimization](https://nextjs.org/docs/api-reference/next/image)
- [Next.js CSS Modules](https://nextjs.org/docs/basic-features/built-in-css-support)

### Tools
- [Color Picker (Chrome DevTools)](https://developer.chrome.com/docs/devtools/)
- [Figma](https://www.figma.com/) - Design tool
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Performance audit
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) - Accessibility

### Need Help?
- Create an issue with the `design` or `mockup` label
- Include mockup screenshot and specific question
- Tag relevant team members
