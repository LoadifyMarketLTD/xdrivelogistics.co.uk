# XDrive Landing & Sign-in Page

This directory contains a static demo landing page with sign-in functionality for XDrive Logistics.

## Files Included

- **index.html** - Responsive landing + sign-in page
- **styles.css** - CSS file with dark premium aesthetic using CSS variables
- **image/** - Directory containing all required assets:
  - `logo.png` - XDrive brand logo (150x50px)
  - `hero.jpg` - Hero background image (1920x1080px)
  - `thumb1.jpg` - Feature thumbnail 1 (300x200px)
  - `thumb2.jpg` - Feature thumbnail 2 (300x200px)
  - `thumb3.jpg` - Feature thumbnail 3 (300x200px)

## Features

### Layout
- **Desktop (>1024px)**: Two-column grid layout with hero section on left (fluid width) and sign-in panel on right (420px fixed)
- **Mobile (≤1024px)**: Single column layout with hero section hidden, sign-in panel takes full width

### Left Column (Hero Section)
- Hero background image with overlay
- XDrive brand logo
- Landing title: "Welcome to XDrive"
- Subtitle: "Sign in to access jobs and reports."
- Three feature thumbnails showcasing service benefits

### Right Column (Sign-in Panel)
- XDrive logo
- "Sign in" heading
- Subtitle text
- Email input field (with visually-hidden label for accessibility)
- Password input field (with visually-hidden label for accessibility)
- "Keep me logged in" checkbox
- "Forgot password?" link
- "Sign in to XDrive" CTA button
- "Request access" footer link

### Accessibility
- ARIA labels on main regions (`role="banner"`, `role="main"`)
- Visually-hidden labels for form inputs
- Semantic HTML structure
- Keyboard navigation support
- Proper form labels and ARIA attributes

### Design Theme
The page uses a dark premium aesthetic with the following brand colors:
- **Deep Navy Background**: #0a1120
- **Navy Surface**: #1a2332
- **Gold Accent**: #D4AF37
- **Cream Text**: #E8DCC4
- **Teal Subtext**: #4A9B9B

## Deployment Instructions

### Option 1: Netlify

1. **Via Netlify UI**:
   - Log in to [Netlify](https://app.netlify.com)
   - Click "Add new site" → "Deploy manually"
   - Drag and drop the following files/folders:
     - `index.html`
     - `styles.css`
     - `image/` folder
   - Your site will be live at a Netlify URL (e.g., `your-site.netlify.app`)

2. **Via Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   netlify deploy --dir=. --prod
   ```

### Option 2: Vercel

1. **Via Vercel UI**:
   - Log in to [Vercel](https://vercel.com)
   - Click "Add New" → "Project"
   - Import your repository or upload files
   - Vercel will automatically detect and deploy the static files

2. **Via Vercel CLI**:
   ```bash
   npm install -g vercel
   vercel --prod
   ```

### Option 3: GitHub Pages

1. Push the files to your repository
2. Go to repository Settings → Pages
3. Select the branch containing these files
4. Save and your site will be live at `https://<username>.github.io/<repo-name>/`

### Option 4: Local Testing

```bash
# Using Python
python3 -m http.server 8080

# Using Node.js
npx http-server -p 8080

# Then open http://localhost:8080/index.html in your browser
```

## Asset Replacement

The included images are placeholders created for demo purposes. To use production assets:

1. Replace files in the `image/` directory with your production images:
   - `logo.png` - Your actual brand logo
   - `hero.jpg` - Professional hero/background image
   - `thumb1.jpg`, `thumb2.jpg`, `thumb3.jpg` - Feature/service thumbnails

2. Maintain the same filenames and aspect ratios:
   - Logo: 150x50px or similar ratio (transparent background recommended)
   - Hero: 1920x1080px or larger (landscape format)
   - Thumbnails: 300x200px or similar 3:2 ratio

## Notes

- This is a **static demo page** with no authentication implementation
- The form posts to `#` (placeholder action)
- All form inputs are client-side only
- For production use, connect the form to your authentication backend
- The page is fully responsive and works on all modern browsers
- CSS uses modern features (CSS Grid, CSS Variables, Flexbox)

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Customization

### Colors
Edit CSS variables in `styles.css` at the `:root` selector:
```css
:root {
  --color-background: #0a1120;
  --color-navy: #1a2332;
  --color-gold: #D4AF37;
  --color-cream: #E8DCC4;
  --color-teal: #4A9B9B;
}
```

### Breakpoints
Modify responsive breakpoints in `styles.css`:
- Desktop/Mobile split: `@media (max-width: 1024px)`
- Small mobile optimizations: `@media (max-width: 480px)`

### Text Content
Edit text directly in `index.html`:
- Hero title: `.hero-title`
- Hero subtitle: `.hero-subtitle`
- Sign-in title: `.signin-title`
- Sign-in subtitle: `.signin-subtitle`

## Screenshots

### Desktop View (1920x1080)
![Desktop View](https://github.com/user-attachments/assets/8936a236-fab9-41f6-b15e-bb153b556105)

### Mobile View (375x812)
![Mobile View](https://github.com/user-attachments/assets/3bf23a91-f93d-45bd-b200-bdb08ecb7fd7)
