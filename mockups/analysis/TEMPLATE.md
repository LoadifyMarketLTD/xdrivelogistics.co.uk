# Mockup Analysis Template

Use this template to analyze mockups before implementation.

## Mockup Information
- **File Name**: [e.g., hero-desktop-v2.png]
- **Section**: [e.g., Hero, Services, Contact]
- **Date Added**: [YYYY-MM-DD]
- **Designer/Source**: [Name or source]
- **Version**: [v1, v2, etc.]

---

## 1. Visual Analysis

### Layout Structure
- [ ] Describe the overall layout (single column, grid, flex, etc.)
- [ ] Note section dimensions and aspect ratio
- [ ] Identify main content areas

### Components Identified
List all UI components visible in the mockup:
- [ ] Navigation elements
- [ ] Buttons (primary, secondary, tertiary)
- [ ] Forms and inputs
- [ ] Cards or tiles
- [ ] Images/icons
- [ ] Text blocks
- [ ] Other interactive elements

### Typography
- **Heading 1**: [Font family, size, weight, color]
- **Heading 2**: [Font family, size, weight, color]
- **Body Text**: [Font family, size, weight, color]
- **Button Text**: [Font family, size, weight, color]
- **Other**: [Describe any other text styles]

### Color Palette
Extract all colors used:
- **Primary**: #[hex] - [Description/usage]
- **Secondary**: #[hex] - [Description/usage]
- **Accent**: #[hex] - [Description/usage]
- **Background**: #[hex] - [Description/usage]
- **Text**: #[hex] - [Description/usage]
- **Border**: #[hex] - [Description/usage]

### Spacing & Dimensions
- **Container Max Width**: [e.g., 1200px]
- **Section Padding**: [e.g., 80px vertical, 20px horizontal]
- **Element Spacing**: [e.g., 16px, 24px, 32px]
- **Border Radius**: [e.g., 8px for buttons, 12px for cards]
- **Grid Gap**: [If applicable]

### Responsive Behavior
- **Desktop** (≥1024px): [Describe layout]
- **Tablet** (768px-1023px): [Describe layout changes]
- **Mobile** (≤767px): [Describe layout changes]

---

## 2. Technical Requirements

### New Dependencies Needed
- [ ] None
- [ ] Icon library (specify which)
- [ ] Animation library (specify which)
- [ ] Other (list below)

List any new packages:
```
# Example:
npm install lucide-react  # For icons
npm install framer-motion # For animations
```

### Assets Required
- [ ] Background images
- [ ] Product/service images
- [ ] Icons/logos
- [ ] Illustrations
- [ ] Other media

List specific assets:
1. `hero-background.jpg` - [dimensions, description]
2. `service-icon-1.svg` - [description]
3. [etc.]

### Interactions & Animations
- [ ] Hover effects on buttons/links
- [ ] Scroll animations
- [ ] Form validation
- [ ] Modal/popup behaviors
- [ ] Other (describe)

Specific interactions:
1. [Interaction description and trigger]
2. [Interaction description and trigger]

### Accessibility Considerations
- [ ] Color contrast meets WCAG AA standards
- [ ] Keyboard navigation support
- [ ] Screen reader compatibility
- [ ] Focus indicators
- [ ] ARIA labels needed
- [ ] Alt text for images

Specific requirements:
1. [Requirement description]
2. [Requirement description]

### Performance Considerations
- [ ] Image optimization needed
- [ ] Lazy loading for images
- [ ] Code splitting for heavy components
- [ ] Asset preloading
- [ ] Other optimizations

---

## 3. Implementation Plan

### Components to Create
List new components needed:

1. **Component Name**: `[ComponentName].tsx`
   - **Location**: `app/components/[ComponentName].tsx`
   - **Purpose**: [Brief description]
   - **Props**: [List expected props]
   - **Dependencies**: [List any dependencies]

2. **Component Name**: `[ComponentName].tsx`
   - [Same structure as above]

### Existing Components to Modify
List components that need updates:

1. **Component Name**: `[ExistingComponent].tsx`
   - **Changes Needed**: [Describe changes]
   - **Reason**: [Why this change is needed]

### Styling Approach
- [ ] CSS Modules
- [ ] Inline styles (existing approach)
- [ ] Tailwind CSS
- [ ] Styled Components
- [ ] Global CSS updates

Specific styling notes:
- [Any specific styling considerations]

### Implementation Steps
Break down into small, ordered tasks:

1. [ ] Create/update component structure
2. [ ] Implement basic layout
3. [ ] Add styling to match mockup
4. [ ] Implement interactive elements
5. [ ] Add responsive styles
6. [ ] Optimize images and assets
7. [ ] Test accessibility
8. [ ] Test on multiple devices/browsers
9. [ ] Review performance
10. [ ] Update documentation

### Estimated Complexity
- [ ] Low (1-2 hours)
- [ ] Medium (3-5 hours)
- [ ] High (6+ hours)

### Potential Challenges
List any anticipated difficulties:
1. [Challenge description and potential solution]
2. [Challenge description and potential solution]

---

## 4. Testing Plan

### Visual Testing
- [ ] Desktop (Chrome, Firefox, Safari)
- [ ] Tablet (iPad, Android tablet)
- [ ] Mobile (iPhone, Android phone)
- [ ] Cross-browser compatibility

### Functional Testing
- [ ] All interactive elements work
- [ ] Forms validate properly
- [ ] Navigation functions correctly
- [ ] Responsive behavior works as expected

### Accessibility Testing
- [ ] Keyboard navigation
- [ ] Screen reader testing
- [ ] Color contrast validation
- [ ] Focus indicators visible

### Performance Testing
- [ ] Lighthouse score ≥90
- [ ] Images properly optimized
- [ ] Load time acceptable
- [ ] No layout shifts

---

## 5. Integration Notes

### Files to Modify
List all files that will be changed:
- `app/page.tsx` - [Reason for change]
- `app/components/[NewComponent].tsx` - [New file]
- `app/globals.css` - [CSS updates]
- `public/images/` - [New assets]

### Compatibility Concerns
- [ ] No breaking changes to existing functionality
- [ ] Maintains current URL structure
- [ ] Compatible with existing components
- [ ] No conflicts with existing styles

### Rollback Plan
If implementation causes issues:
1. [Step to revert changes]
2. [Step to restore functionality]

---

## 6. Review & Approval

### Design Review
- [ ] Mockup reviewed by team
- [ ] Design tokens documented
- [ ] Responsive versions approved
- [ ] Accessibility approved

### Technical Review
- [ ] Implementation approach approved
- [ ] Dependencies approved
- [ ] Performance impact assessed
- [ ] Security considerations reviewed

### Sign-off
- **Analyzed by**: [Name]
- **Date**: [YYYY-MM-DD]
- **Approved by**: [Name]
- **Date**: [YYYY-MM-DD]

---

## 7. Implementation Status

Track implementation progress:
- [ ] Component created
- [ ] Styling completed
- [ ] Testing completed
- [ ] Review completed
- [ ] Deployed to production

### Implementation Notes
Document any deviations from the original plan or mockup:
1. [Note about changes or adaptations]
2. [Note about challenges encountered]

---

## 8. Post-Implementation Review

After implementation, document:

### What Went Well
- [Positive aspects of implementation]

### What Could Be Improved
- [Areas for improvement]

### Lessons Learned
- [Key takeaways for future mockups]

---

## Additional Resources
- Mockup file location: `mockups/[section]/[filename]`
- Related mockups: [List any related mockup files]
- Design documentation: [Links to external design docs]
- Figma/Sketch link: [If applicable]
