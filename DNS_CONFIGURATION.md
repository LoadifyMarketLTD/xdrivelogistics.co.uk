# DNS Configuration Guide for dannycourierltd.co.uk

## Issue: DNS_PROBE_FINISHED_NXDOMAIN

This error occurs when the domain name cannot be resolved by DNS. Follow these steps to properly configure the domain in Netlify.

## Prerequisites

- Access to your domain registrar (where you purchased dannycourierltd.co.uk)
- Access to your Netlify account

## Solution Steps

### 1. Configure Domain in Netlify

1. Log in to your Netlify account
2. Navigate to your site dashboard
3. Go to **Site settings** → **Domain management**
4. Click **Add custom domain**
5. Enter: `dannycourierltd.co.uk`
6. Click **Verify** and then **Add domain**

### 2. Configure DNS Records at Your Domain Registrar

You have two options:

#### Option A: Use Netlify DNS (Recommended)

1. In Netlify, go to **Domain management** → **dannycourierltd.co.uk**
2. Click **Set up Netlify DNS**
3. Follow the wizard to add your domain
4. Netlify will provide you with nameservers (e.g., `dns1.p01.nsone.net`)
5. Go to your domain registrar
6. Update the nameservers to use Netlify's nameservers
7. Save the changes

**Note**: DNS propagation can take 24-48 hours, but usually completes within a few hours.

#### Option B: Use External DNS (Your Current Registrar)

If you prefer to keep DNS with your registrar, add these records:

**For Apex Domain (dannycourierltd.co.uk):**
```
Type: A
Name: @ (or leave blank)
Value: 75.2.60.5
TTL: 3600 (or automatic)
```

**For WWW Subdomain:**
```
Type: CNAME
Name: www
Value: [your-netlify-site-name].netlify.app
TTL: 3600 (or automatic)
```

Replace `[your-netlify-site-name]` with your actual Netlify site name.

### 3. Enable HTTPS in Netlify

1. After DNS propagation, go to **Site settings** → **Domain management**
2. Under **HTTPS**, click **Verify DNS configuration**
3. Once verified, click **Provision certificate**
4. Netlify will automatically provision an SSL certificate

### 4. Set Primary Domain

1. In **Domain management**, ensure `dannycourierltd.co.uk` is set as the primary domain
2. Enable the option to **Redirect www to primary domain** if you want www.dannycourierltd.co.uk to redirect to dannycourierltd.co.uk

## Verification

Once DNS propagation is complete, test your domain:

```bash
# Check DNS resolution
nslookup dannycourierltd.co.uk

# Test HTTP/HTTPS access
curl -I https://dannycourierltd.co.uk
```

You should see:
- DNS resolves to Netlify's IP addresses
- HTTPS redirects work properly
- The site loads successfully

## Troubleshooting

### Still Getting DNS_PROBE_FINISHED_NXDOMAIN?

1. **Wait for DNS propagation**: Can take up to 48 hours
2. **Clear DNS cache**: 
   - Windows: `ipconfig /flushdns`
   - macOS: `sudo dscacheutil -flushcache`
   - Linux: `sudo systemd-resolve --flush-caches`
3. **Check with external DNS**: Use [https://dnschecker.org/](https://dnschecker.org/) to see if DNS has propagated globally
4. **Verify domain spelling**: Ensure it's `dannycourierltd.co.uk` (with "ltd")

### Domain Shows "Site Not Found" After DNS Resolves?

1. Go to Netlify **Site settings** → **Domain management**
2. Verify the domain is listed and active
3. Check that the site is deployed successfully
4. Ensure the domain is set as primary

## Current Configuration

This repository includes:

- **netlify.toml**: Redirect rules for www → apex and HTTP → HTTPS
- **public/_redirects**: Additional Netlify redirect configuration
- **Metadata**: All configured for `https://dannycourierltd.co.uk`

## Need Help?

If you continue experiencing issues:

1. Check Netlify's deployment logs
2. Verify your domain ownership with your registrar
3. Contact Netlify support with your site name and domain
4. Ensure you have permission to configure DNS for this domain

## Additional Resources

- [Netlify Custom Domains Documentation](https://docs.netlify.com/domains-https/custom-domains/)
- [Netlify DNS Documentation](https://docs.netlify.com/domains-https/netlify-dns/)
- [DNS Checker Tool](https://dnschecker.org/)
