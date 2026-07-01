# Bloompath Behavioral Services Website

Static pages are served by `server.js`, which also handles backend form submissions.

## Run Locally

```sh
npm install
npm run dev
```

Open `http://localhost:4173`.

`npm run dev` uses `FORM_DRY_RUN=true`, which verifies form submissions without sending real email.

Backend form submission requires the Node server. Opening HTML files directly with `file://` is fine for visual review, but production forms need `npm start` or an equivalent Node hosting setup.

Health check:

```text
http://localhost:4173/healthz
```

## Production Email Setup

Copy `.env.example` to `.env` and configure Resend:

```sh
PORT=4173
RECIPIENT_EMAIL=info@bloompathbehavioral.com
FORM_DRY_RUN=false
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM="Bloompath Website <no-reply@bloompathbehavioral.com>"
```

All forms send notifications to `RECIPIENT_EMAIL`.

Subjects:

- Contact: `New Bloompath Contact Inquiry`
- Insurance: `New Bloompath Insurance Verification Request`
- Careers: `New Bloompath Job Application`

## Form Protection And Validation

The backend includes:

- Required field validation
- Email validation
- Phone validation
- Consent checkbox validation
- Hidden spam trap
- Rate limiting
- Success and error JSON responses for the frontend

## Careers File Uploads

Resume/file upload is supported by the backend when the site runs through `server.js`.

Accepted file types: PDF, DOC, DOCX, TXT, RTF, JPG, PNG.

Limits:

- 8 MB per file
- 12 MB total
- 4 files maximum

Files are sent as email attachments through the configured email provider. Final attachment delivery depends on the provider allowing attachments of that size.

## Launch Checklist

See `LAUNCH_CHECKLIST.md` for the final production checklist, required environment variables, Resend setup steps, and post-deploy form tests.
