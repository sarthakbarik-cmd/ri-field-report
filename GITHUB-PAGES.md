# Deploy RI Field Report on GitHub Pages

Create a dedicated repository named `ri-field-report`. GitHub Pages is available for
public repositories on GitHub Free. A private repository requires a plan that
supports private-repository Pages. The published website remains public on a
custom domain.

1. Commit this source at the repository root on `main`, including
   `.github/workflows/pages.yml`. In **Settings → Pages**, set **Source** to
   **GitHub Actions**, then run **Deploy RI Field Report to GitHub Pages**.
2. Check the URL from the deployment workflow. If testing Google sign-in on
   a temporary hostname, add that hostname to Firebase Authentication's
   authorized domains. The production hostname `revenue.shopodisha.in` was
   already authorized in Firebase when the Sites deployment was configured.
3. Verify ownership of `shopodisha.in` in the GitHub account's Pages settings
   using the TXT record GitHub supplies, if the domain is not already verified.
4. In the new repository's **Settings → Pages**, set the custom domain to
   `revenue.shopodisha.in`. When ready to move traffic, edit the existing
   GoDaddy CNAME named `revenue` to point to `sarthakbarik-cmd.github.io`.
   Leave the apex `shopodisha.in` and its records in place.
5. After GitHub provisions the certificate, enable **Enforce HTTPS**. Check
   the custom domain, Google sign-in, and an existing dispatch PDF download.
   The production origin and Firebase project stay the same. Local-only data
   entered on a temporary GitHub hostname belongs to that separate origin.

The workflow publishes only the Vite `dist` output. The browser uses Firebase
for sign-in and cloud data, and does OCR and PDF generation on-device. Do not
commit signature images, case documents, environment secrets, or service
account credentials.

To roll back the domain, restore the `revenue` CNAME to
`custom-domains.chatgpt.site` while the original Site and its custom domain
are still configured.
