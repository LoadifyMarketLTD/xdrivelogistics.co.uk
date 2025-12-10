# XDrive Logistics

This repository contains the source code for the XDrive Logistics website.

Deployment

- Build command: `npm run build`
- Publish directory: `.next`

Deployment linking note

If your site is showing a different preview image or appears to be using content from another repository, you may need to:

1. In Netlify, go to Site settings > Build & deploy > Continuous Deployment and verify the linked Git repository is `LoadifyMarketLTD/xdrivelogistics.co.uk` and the production branch is `main`.
2. If the site is linked to the wrong repository, unlink it and re-link the correct repository by using "Edit settings" or using the Netlify UI to disconnect and reconnect GitHub.
3. Ensure Build command is `npm run build` and Publish directory is `.next`.

After these checks, trigger a deploy (Retry/Trigger deploy). The site preview should now render the XDrive Logistics design.
