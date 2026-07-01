const path = require("path");
const dns = require("dns").promises;
const net = require("net");

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const multer = require("multer");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");

const app = express();
const rootDir = __dirname;
const recipientEmail = process.env.RECIPIENT_EMAIL || "info@bloompathbehavioral.com";
const dryRun = process.env.FORM_DRY_RUN === "true";
const emailProvider = (process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : "smtp")).toLowerCase();
const port = Number(process.env.PORT || 4173);
const privateStaticPattern = /^\/(?:\.env(?:\.example)?|\.gitignore|README\.md|LAUNCH_CHECKLIST\.md|package(?:-lock)?\.json|server\.js|node_modules(?:\/|$)|outputs(?:\/|$))/i;
const pageRoutes = [
  { routes: ["/", "/index.html"], file: "index.html" },
  { routes: ["/about-us", "/about-us/", "/about-us/index.html"], file: "about-us/index.html" },
  { routes: ["/services", "/services/", "/services/index.html"], file: "services/index.html" },
  { routes: ["/insurance", "/insurance/", "/insurance/index.html"], file: "insurance/index.html" },
  { routes: ["/getting-started", "/getting-started/", "/getting-started/index.html"], file: "getting-started/index.html" },
  { routes: ["/resources", "/resources/", "/resources/index.html"], file: "resources/index.html" },
  { routes: ["/careers", "/careers/", "/careers/index.html"], file: "careers/index.html" },
  { routes: ["/contact", "/contact/", "/contact/index.html"], file: "contact/index.html" }
];

const formConfigs = {
  contact: {
    label: "Contact Form",
    subject: "New Bloompath Contact Inquiry",
    requiredFields: [
      "Location",
      "Parent/Guardian First Name",
      "Parent/Guardian Last Name",
      "Client First Name",
      "Client Last Name",
      "Client Age",
      "Phone Number",
      "Email",
      "City",
      "SMS Consent"
    ],
    phoneFields: ["Phone Number"],
    emailField: "Email",
    consentFields: ["SMS Consent"],
    allowAttachments: false
  },
  insurance: {
    label: "Insurance Verification Form",
    subject: "New Bloompath Insurance Verification Request",
    requiredFields: [
      "Insured First Name",
      "Insured Last Name",
      "City",
      "State/Region",
      "Email",
      "Phone Number",
      "Client First Name",
      "Client Last Name",
      "Child Insurance Company",
      "SMS Consent"
    ],
    phoneFields: ["Phone Number"],
    emailField: "Email",
    consentFields: ["SMS Consent"],
    allowAttachments: false
  },
  careers: {
    label: "Careers Application Form",
    subject: "New Bloompath Job Application",
    requiredFields: [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Permission to Text Regarding Application"
    ],
    phoneFields: ["Phone"],
    emailField: "Email",
    consentFields: ["Permission to Text Regarding Application"],
    allowAttachments: true
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 4,
    fileSize: 8 * 1024 * 1024,
    fieldSize: 128 * 1024
  }
});

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: "Too many form submissions. Please wait a few minutes and try again."
  }
});

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));

app.get("/healthz", (req, res) => {
  res.json({
    ok: true,
    emailMode: dryRun ? "dry-run" : emailProvider
  });
});

app.use((req, res, next) => {
  let pathname = req.path;
  try {
    pathname = decodeURIComponent(pathname);
  } catch (error) {
    return res.sendStatus(400);
  }

  if (privateStaticPattern.test(pathname)) {
    return res.sendStatus(404);
  }

  return next();
});

pageRoutes.forEach(({ routes, file }) => {
  app.get(routes, (req, res) => {
    res.sendFile(path.join(rootDir, file));
  });
});

app.use(express.static(rootDir, { extensions: ["html"] }));

app.post("/api/forms/:formType", formLimiter, upload.any(), async (req, res, next) => {
  try {
    const config = formConfigs[req.params.formType];
    if (!config) {
      return res.status(404).json({ ok: false, message: "Unknown form type." });
    }

    const fields = normalizeFields(req.body || {});
    const files = req.files || [];
    const validation = validateSubmission(config, fields, files);

    if (validation.spam) {
      return res.json({ ok: true, message: "Submission received." });
    }

    if (validation.errors.length) {
      return res.status(400).json({
        ok: false,
        message: "Please review the highlighted fields and try again.",
        errors: validation.errors
      });
    }

    await sendNotification(config, fields, files);

    return res.json({
      ok: true,
      message: "Submission received."
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      ok: false,
      message: fileUploadErrorMessage(error)
    });
  }

  console.error(error);
  return res.status(error.statusCode || 500).json({
    ok: false,
    message: error.publicMessage || "Submission failed. Please try again or contact Bloompath directly."
  });
});

app.listen(port, () => {
  const mode = dryRun ? "dry-run email mode" : `${emailProvider} email mode`;
  console.log(`Bloompath website running at http://localhost:${port} (${mode})`);
});

function normalizeFields(body) {
  return Object.entries(body).reduce((fields, [key, value]) => {
    if (Array.isArray(value)) {
      fields[key] = value.map(cleanText).filter(Boolean);
    } else {
      fields[key] = cleanText(value);
    }

    return fields;
  }, {});
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function valuePresent(value) {
  return Array.isArray(value) ? value.some(Boolean) : Boolean(value);
}

function validateSubmission(config, fields, files) {
  const errors = [];

  if (fields.Website) {
    return { spam: true, errors };
  }

  config.requiredFields.forEach((field) => {
    if (!valuePresent(fields[field])) {
      errors.push(`${field} is required.`);
    }
  });

  if (fields[config.emailField] && !isValidEmail(fields[config.emailField])) {
    errors.push("Please enter a valid email address.");
  }

  config.phoneFields.forEach((field) => {
    if (fields[field] && !isValidPhone(fields[field])) {
      errors.push(`${field} must be a valid phone number.`);
    }
  });

  config.consentFields.forEach((field) => {
    if (!valuePresent(fields[field])) {
      errors.push(`${field} is required.`);
    }
  });

  if (!config.allowAttachments && files.length) {
    errors.push("This form does not accept file attachments.");
  }

  if (config.allowAttachments) {
    const fileErrors = validateFiles(files);
    errors.push(...fileErrors);
  }

  return { spam: false, errors };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  const compact = value.replace(/[^\d]/g, "");
  return compact.length >= 7 && compact.length <= 15;
}

function validateFiles(files) {
  const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".txt", ".rtf", ".jpg", ".jpeg", ".png"]);
  const allowedMimeTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/rtf",
    "image/jpeg",
    "image/png"
  ]);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const errors = [];

  if (totalBytes > 12 * 1024 * 1024) {
    errors.push("Uploaded files must be 12 MB total or less.");
  }

  files.forEach((file) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (!allowedExtensions.has(extension) && !allowedMimeTypes.has(file.mimetype)) {
      errors.push(`${file.originalname} is not an accepted file type.`);
    }
  });

  return errors;
}

async function sendNotification(config, fields, files) {
  const submittedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short"
  });
  const text = buildTextEmail(config, fields, files, submittedAt);
  const html = buildHtmlEmail(config, fields, files, submittedAt);
  const replyTo = isValidEmail(fields[config.emailField] || "") ? fields[config.emailField] : undefined;
  const mailOptions = {
    from: process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || `Bloompath Website <${recipientEmail}>`,
    to: recipientEmail,
    subject: config.subject,
    replyTo,
    text,
    html,
    attachments: files.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype
    }))
  };

  if (dryRun) {
    console.log(`[FORM_DRY_RUN] ${config.subject}`);
    console.log(text);
    return;
  }

  if (emailProvider === "resend") {
    await sendWithResend(mailOptions);
    return;
  }

  if (emailProvider === "smtp") {
    const transporter = await createTransporter();
    await transporter.sendMail(mailOptions);
    return;
  }

  const error = new Error(`Unsupported email provider: ${emailProvider}`);
  error.statusCode = 503;
  error.publicMessage = "Email delivery is not configured yet. Please contact Bloompath by phone or email.";
  throw error;
}

async function sendWithResend(mailOptions) {
  if (!process.env.RESEND_API_KEY) {
    const error = new Error("Missing Resend configuration: RESEND_API_KEY");
    error.statusCode = 503;
    error.publicMessage = "Email delivery is not configured yet. Please contact Bloompath by phone or email.";
    throw error;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: mailOptions.from,
      to: [mailOptions.to],
      subject: mailOptions.subject,
      html: mailOptions.html,
      text: mailOptions.text,
      reply_to: mailOptions.replyTo,
      attachments: mailOptions.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content.toString("base64")
      }))
    })
  });

  if (!response.ok) {
    const responseBody = await response.json().catch(() => ({}));
    const detail = responseBody.message || responseBody.error?.message || response.statusText;
    const error = new Error(`Resend email failed: ${detail}`);
    error.statusCode = 502;
    error.publicMessage = "Submission failed. Please try again or contact Bloompath directly.";
    throw error;
  }
}

async function createTransporter() {
  const missingConfig = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((key) => !process.env[key]);
  if (missingConfig.length) {
    const error = new Error(`Missing SMTP configuration: ${missingConfig.join(", ")}`);
    error.statusCode = 503;
    error.publicMessage = "Email delivery is not configured yet. Please contact Bloompath by phone or email.";
    throw error;
  }

  const smtpHost = process.env.SMTP_HOST;
  const useGmailSslSmtp = smtpHost.toLowerCase() === "smtp.gmail.com";
  const smtpEndpoint = await resolveSmtpEndpoint(smtpHost);

  return nodemailer.createTransport({
    host: smtpEndpoint.host,
    port: useGmailSslSmtp ? 465 : Number(process.env.SMTP_PORT || 587),
    secure: useGmailSslSmtp ? true : process.env.SMTP_SECURE === "true",
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    tls: smtpEndpoint.servername ? { servername: smtpEndpoint.servername } : undefined,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function resolveSmtpEndpoint(host) {
  if (process.env.SMTP_FORCE_IPV4 === "false" || net.isIP(host)) {
    return {
      host,
      servername: process.env.SMTP_SERVERNAME || (net.isIP(host) ? undefined : host)
    };
  }

  const addresses = await dns.resolve4(host);
  if (!addresses.length) {
    return { host, servername: host };
  }

  return {
    host: addresses[0],
    servername: host
  };
}

function buildTextEmail(config, fields, files, submittedAt) {
  const lines = [
    config.label,
    `Submitted: ${submittedAt}`,
    "",
    "Submission details:"
  ];

  Object.entries(fields)
    .filter(([key]) => key !== "Website")
    .forEach(([key, value]) => {
      lines.push(`${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
    });

  if (files.length) {
    lines.push("", "Attachments:");
    files.forEach((file) => lines.push(`- ${file.originalname} (${Math.round(file.size / 1024)} KB)`));
  }

  return lines.join("\n");
}

function buildHtmlEmail(config, fields, files, submittedAt) {
  const rows = Object.entries(fields)
    .filter(([key]) => key !== "Website")
    .map(([key, value]) => {
      const displayValue = Array.isArray(value) ? value.join(", ") : value;
      return `<tr><th align="left">${escapeHtml(key)}</th><td>${escapeHtml(displayValue)}</td></tr>`;
    })
    .join("");
  const attachmentRows = files
    .map((file) => `<li>${escapeHtml(file.originalname)} (${Math.round(file.size / 1024)} KB)</li>`)
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#1f3554;line-height:1.5">
      <h1 style="font-size:22px;color:#255389">${escapeHtml(config.label)}</h1>
      <p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:720px">
        ${rows}
      </table>
      ${files.length ? `<h2 style="font-size:18px;color:#255389">Attachments</h2><ul>${attachmentRows}</ul>` : ""}
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileUploadErrorMessage(error) {
  if (error.code === "LIMIT_FILE_SIZE") {
    return "Each uploaded file must be 8 MB or smaller.";
  }

  if (error.code === "LIMIT_FILE_COUNT") {
    return "Please upload no more than four files.";
  }

  return "The uploaded file could not be processed.";
}
