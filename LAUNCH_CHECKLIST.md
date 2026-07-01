# Bloompath Launch Checklist

## Required Production Environment Variables

Set these on the production host before launch:

```sh
PORT=4173
RECIPIENT_EMAIL=info@bloompathbehavioral.com
FORM_DRY_RUN=false
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM="Bloompath Website <no-reply@bloompathbehavioral.com>"
```

Use `SMTP_SECURE=true` only when the SMTP provider requires implicit TLS, usually port `465`. Use `SMTP_SECURE=false` for STARTTLS, usually port `587`.

## SMTP Setup

1. Choose the production email provider for Bloompath.
2. Create or confirm a sending identity such as `no-reply@bloompathbehavioral.com`.
3. Generate SMTP credentials for the website.
4. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` on the production host.
5. Set `RECIPIENT_EMAIL=info@bloompathbehavioral.com`.
6. Confirm `FORM_DRY_RUN=false`.
7. Submit one Contact, Insurance, and Careers test form after deployment.
8. Confirm all three messages arrive at `info@bloompathbehavioral.com`.
9. Confirm the Careers test includes a resume attachment.
10. Confirm replies go to the submitted user email address.

## Build And Start

```sh
npm install
npm start
```

For local testing without sending real emails:

```sh
npm run dev
```

Open:

```text
http://localhost:4173
```

Health check:

```text
http://localhost:4173/healthz
```

## Recommended Production Hosting

Use a Node web host because this site includes backend form submission and Careers file uploads.

Recommended setup:

1. Push this project to a private GitHub repository.
2. In Render, create a new Web Service from that repository.
3. Use the included `render.yaml` blueprint, or set:
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/healthz`
4. Add all required environment variables listed above.
5. Deploy the service and confirm the Render preview URL loads.
6. Submit test Contact, Insurance, and Careers forms.
7. Confirm emails arrive at `info@bloompathbehavioral.com`.

## Connect The Squarespace Domain

After the website is deployed to production hosting:

1. In the hosting dashboard, add these custom domains:
   - `bloompathbehavioral.com`
   - `www.bloompathbehavioral.com`
2. Copy the DNS records the host provides.
3. In Squarespace, open the domain:
   - `bloompathbehavioral.com`
4. Open DNS settings.
5. Remove conflicting web-hosting records for the root domain or `www` if necessary.
6. Add the DNS records from the host.
7. Remove any conflicting `AAAA` records if the host tells you to use IPv4-only records.
8. Save changes.
9. Return to the hosting dashboard and verify the domain.
10. Wait for SSL/TLS certificate provisioning.
11. Test:
    - `https://bloompathbehavioral.com`
    - `https://www.bloompathbehavioral.com`

Do not point the domain to the temporary Cloudflare tunnel URL. That tunnel is only for short-term review and depends on this local computer staying online.

## Pages To Review

- Home: `/`
- About Us: `/about-us/`
- Services: `/services/`
- Insurance: `/insurance/`
- Getting Started: `/getting-started/`
- Resources: `/resources/`
- Careers: `/careers/`
- Contact: `/contact/`

## Form Routing

- Contact Form: `/api/forms/contact`
- Insurance Verification Form: `/api/forms/insurance`
- Careers Application Form: `/api/forms/careers`

Email subjects:

- `New Bloompath Contact Inquiry`
- `New Bloompath Insurance Verification Request`
- `New Bloompath Job Application`

## Validation And Protection

Confirm before launch:

- Required fields are enforced.
- Email validation works.
- Phone validation works.
- SMS/text consent validation works.
- Hidden spam trap is present.
- Rate limiting is active.
- Success messages display after valid submissions.
- Error messages display after failed submissions.
- Private project files are not publicly served.

## Careers File Uploads

Supported now through the backend:

- PDF
- DOC
- DOCX
- TXT
- RTF
- JPG
- PNG

Limits:

- 8 MB per file
- 12 MB total
- 4 files maximum

Final attachment delivery depends on the SMTP provider allowing attachments of that size.

## Final Visual QA

Review desktop, tablet, and mobile layouts for:

- Header and navigation
- Services dropdown
- Footer links and contact details
- Hero image loading
- Cards and timeline spacing
- Form layout and success/error states
- No horizontal scrolling
- No broken images

## Final Production Notes

- Run the site through `server.js`; do not deploy it as a file-only static site if backend forms are required.
- Do not commit or publish `.env`.
- Keep `node_modules/` out of source control.
- Keep `package-lock.json` with the project for repeatable installs.
- Configure HTTPS at the hosting/proxy layer before public launch.
