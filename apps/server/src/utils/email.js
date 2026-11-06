import nodemailer from "nodemailer";
import { env, isProduction } from "../config.js";
import { ApiError } from "../lib/http.js";

/** The authenticated sender address, read from configuration only. */
function senderAddress() {
    return (env.SMTP_USER || "").replace(/^["']|["']$/g, "").trim();
}

function getTransporters() {
    const smtpUser = senderAddress();
    const smtpPass = (env.SMTP_PASS || "").replace(/^["']|["']$/g, "").replace(/\s+/g, "");
    if (!smtpUser || !smtpPass) {
        if (!isProduction) return [];
        console.warn("[Mailer] SMTP credentials missing in production. Set SMTP_USER/SMTP_PASS, or set an HTTPS provider key (RESEND_API_KEY, BREVO_API_KEY, SENDGRID_API_KEY).");
        return [];
    }

    // Candidate transport configurations in order of preference to guarantee delivery across all networks
    return [
        {
            name: "port_465_ssl",
            transporter: nodemailer.createTransport({
                host: (env.SMTP_HOST || "smtp.gmail.com").replace(/^["']|["']$/g, "").trim(),
                port: 465,
                secure: true,
                family: 4,
                connectionTimeout: 4000,
                greetingTimeout: 3000,
                socketTimeout: 5000,
                auth: { user: smtpUser, pass: smtpPass },
                tls: { rejectUnauthorized: false },
            }),
        },
        {
            name: "gmail_service",
            transporter: nodemailer.createTransport({
                service: "gmail",
                family: 4,
                connectionTimeout: 4000,
                greetingTimeout: 3000,
                socketTimeout: 5000,
                auth: { user: smtpUser, pass: smtpPass },
            }),
        },
        {
            name: "port_587_starttls",
            transporter: nodemailer.createTransport({
                host: (env.SMTP_HOST || "smtp.gmail.com").replace(/^["']|["']$/g, "").trim(),
                port: 587,
                secure: false,
                requireTLS: true,
                family: 4,
                connectionTimeout: 4000,
                greetingTimeout: 3000,
                socketTimeout: 5000,
                auth: { user: smtpUser, pass: smtpPass },
                tls: { rejectUnauthorized: false },
            }),
        },
    ];
}

async function deliverViaSendGrid(mailOptions) {
    const sendgridKey = (process.env.SENDGRID_API_KEY || "").replace(/^["']|["']$/g, "").trim();
    if (!sendgridKey) return null;
    const sendgridFrom = (process.env.SENDGRID_FROM || senderAddress()).replace(/^["']|["']$/g, "").trim();
    try {
        const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${sendgridKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: mailOptions.to }] }],
                from: { email: sendgridFrom, name: "TedbabeLearnHUB" },
                subject: mailOptions.subject,
                content: [
                    { type: "text/plain", value: mailOptions.text },
                    { type: "text/html", value: mailOptions.html }
                ]
            }),
        });
        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`SendGrid HTTP ${res.status}: ${errBody}`);
        }
        console.log(`[TedbabeLearnHUB Mailer] Successfully delivered via SendGrid HTTPS to ${mailOptions.to}`);
        return { delivered: true, method: "sendgrid_api" };
    } catch (err) {
        console.warn(`[TedbabeLearnHUB Mailer] SendGrid API attempt failed: ${err.message || err}`);
        return null;
    }
}

async function deliverViaResend(mailOptions) {
    const resendKey = (process.env.RESEND_API_KEY || "").replace(/^["']|["']$/g, "").trim();
    if (!resendKey) return null;
    const resendFrom = (process.env.RESEND_FROM || "TedbabeLearnHUB <onboarding@resend.dev>").replace(/^["']|["']$/g, "").trim();
    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${resendKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: resendFrom,
                to: [mailOptions.to],
                subject: mailOptions.subject,
                html: mailOptions.html,
                text: mailOptions.text,
            }),
        });
        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Resend HTTP ${res.status}: ${errBody}`);
        }
        const data = await res.json();
        console.log(`[TedbabeLearnHUB Mailer] Successfully delivered via Resend HTTPS to ${mailOptions.to} (ID: ${data.id})`);
        return { delivered: true, info: data, method: "resend_api" };
    } catch (err) {
        console.warn(`[TedbabeLearnHUB Mailer] Resend API attempt failed: ${err.message || err}`);
        return null;
    }
}

async function deliverViaBrevo(mailOptions) {
    const brevoKey = (process.env.BREVO_API_KEY || "").replace(/^["']|["']$/g, "").trim();
    if (!brevoKey) return null;
    const senderEmail = senderAddress();
    try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "api-key": brevoKey,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                sender: { name: "TedbabeLearnHUB", email: senderEmail },
                to: [{ email: mailOptions.to }],
                subject: mailOptions.subject,
                htmlContent: mailOptions.html,
                textContent: mailOptions.text,
            }),
        });
        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Brevo HTTP ${res.status}: ${errBody}`);
        }
        const data = await res.json();
        console.log(`[TedbabeLearnHUB Mailer] Successfully delivered via Brevo HTTPS to ${mailOptions.to} (ID: ${data.messageId || JSON.stringify(data)})`);
        return { delivered: true, info: data, method: "brevo_api" };
    } catch (err) {
        console.warn(`[TedbabeLearnHUB Mailer] Brevo API attempt failed: ${err.message || err}`);
        return null;
    }
}

async function deliverEmail(mailOptions) {
    // 1. Direct HTTPS APIs (Resend, Brevo, SendGrid) - Immune to host firewall/port-25/port-465 blocking on cloud platforms like Render
    if (process.env.RESEND_API_KEY) {
        const resendResult = await deliverViaResend(mailOptions);
        if (resendResult) return resendResult;
    }
    if (process.env.BREVO_API_KEY) {
        const brevoResult = await deliverViaBrevo(mailOptions);
        if (brevoResult) return brevoResult;
    }
    if (process.env.SENDGRID_API_KEY) {
        const sendgridResult = await deliverViaSendGrid(mailOptions);
        if (sendgridResult) return sendgridResult;
    }

    const candidates = getTransporters();
    if (!candidates.length) {
        // Throw rather than return a falsy result: every caller only treats a
        // thrown error as "not delivered". Returning here silently reported a
        // successful send and suppressed the verification-code fallback.
        throw new Error("No email transport is configured. Set RESEND_API_KEY/BREVO_API_KEY/SENDGRID_API_KEY, or SMTP_USER/SMTP_PASS.");
    }

    let lastError = null;
    for (const { name, transporter } of candidates) {
        try {
            const info = await transporter.sendMail(mailOptions);
            console.log(`[TedbabeLearnHUB Mailer] Successfully delivered via ${name} to ${mailOptions.to} (MessageId: ${info.messageId})`);
            return { delivered: true, info, method: name };
        } catch (err) {
            console.warn(`[TedbabeLearnHUB Mailer] Transport ${name} attempt failed: ${err.message || err}. Trying next candidate...`);
            lastError = err;
        }
    }

    // As last resort, try HTTPS APIs if not tried earlier
    const resendFallback = await deliverViaResend(mailOptions);
    if (resendFallback) return resendFallback;
    const brevoFallback = await deliverViaBrevo(mailOptions);
    if (brevoFallback) return brevoFallback;
    const sendgridFallback = await deliverViaSendGrid(mailOptions);
    if (sendgridFallback) return sendgridFallback;

    throw lastError || new Error("All mail transports failed.");
}

function escapeHtml(str) {
    return String(str || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function emailWrapper(title, content) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#090d16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <div style="max-width:560px;margin:32px auto;background:#0f172a;border-radius:16px;border:1px solid #1e293b;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.4);">
    <div style="background:linear-gradient(135deg,#091a2f 0%,#0f2942 100%);padding:28px 32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div style="display:inline-block;padding:8px 18px;background:rgba(255,255,255,0.08);border:1px solid rgba(56,189,248,0.25);border-radius:10px;color:#38bdf8;font-weight:900;font-size:18px;letter-spacing:1px;">
        TedbabeLearnHUB (TLH)
      </div>
      <p style="margin:8px 0 0;color:#94a3b8;font-size:12px;letter-spacing:0.5px;">Learn Anything. Grow Everywhere.</p>
    </div>
    <div style="padding:32px 32px 28px;">
      ${content}
    </div>
    <div style="padding:20px 32px;background:#090d16;border-top:1px solid #1e293b;text-align:center;font-size:12px;color:#64748b;">
      <p style="margin:0;">&copy; ${new Date().getFullYear()} TedbabeLearnHUB (TLH) Education Platform. All rights reserved.</p>
      <p style="margin:4px 0 0;">This is an automated system email. Please do not reply directly.</p>
    </div>
  </div>
</body>
</html>`;
}

function formatFromAddress(label, smtpUser) {
    const raw = (env.SMTP_FROM || "").replace(/^["']|["']$/g, "").trim();
    if (!raw) return `"${label}" <${smtpUser}>`;
    if (/<[^>]+>/.test(raw)) return raw;
    const emailMatch = raw.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
        const foundEmail = emailMatch[1];
        const namePart = raw.replace(foundEmail, "").replace(/[<>"']/g, "").trim() || label;
        return `"${namePart}" <${foundEmail}>`;
    }
    return `"${raw.replace(/[<>"']/g, "")}" <${smtpUser}>`;
}

export async function sendVerificationCode({ email, name, code, purpose = "signup" }) {
    const escapedName = escapeHtml(name || "Learner");
    console.log(`[TedbabeLearnHUB Mailer] Verification code (${purpose}) for ${email} (${escapedName}): [ ${code} ]`);
    const smtpUser = senderAddress();
    const fromAddress = formatFromAddress("TedbabeLearnHUB", smtpUser);
    const isLogin = purpose === "login";
    const headline = isLogin ? "Confirm a new sign-in" : "Verify your account";
    const intro = isLogin
        ? "We noticed a sign-in attempt from a new device or browser. Enter the 6-digit code below to confirm it's you. This code expires in <strong style=\"color:#ffffff;\">10 minutes</strong>."
        : "Welcome to TedbabeLearnHUB. Enter the 6-digit verification code below to verify your email address. This code expires in <strong style=\"color:#ffffff;\">10 minutes</strong>.";
    const subject = isLogin
        ? `TedbabeLearnHUB — New Sign-in Code: ${code}`
        : `TedbabeLearnHUB — Your Verification Code is ${code}`;

    try {
        await deliverEmail({
            from: fromAddress,
            replyTo: smtpUser,
            to: email,
            subject,
            text: `Hello ${name || "Learner"},\n\nYour TedbabeLearnHUB verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.\n\n— TedbabeLearnHUB Team\nhttps://tedbabelearnhub.vercel.app`,
            html: emailWrapper(isLogin ? "New Sign-in Verification" : "Account Verification", `
              <h1 style="font-size:22px;font-weight:800;color:#ffffff;margin-top:0;">${headline}</h1>
              <p style="font-size:14px;color:#e2e8f0;line-height:1.6;">Hello <strong style="color:#ffffff;">${escapedName}</strong>,</p>
              <p style="font-size:14px;color:#94a3b8;line-height:1.6;">${intro}</p>
              <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:28px 20px;text-align:center;margin:28px 0;box-shadow:0 6px 20px rgba(0,0,0,0.35);">
                <div style="font-size:42px;font-weight:900;letter-spacing:16px;color:#818cf8;font-family:'Courier New',Courier,monospace;text-indent:16px;">${code}</div>
              </div>
              <p style="font-size:13px;color:#94a3b8;line-height:1.5;">If you don't see this email in your primary inbox, please check your <strong>Spam / Junk</strong> folder.</p>
              <p style="font-size:12px;color:#64748b;line-height:1.5;margin-top:16px;">If you did not initiate this request, you can safely ignore this email.</p>
            `),
            priority: "high",
            headers: {
                "X-Priority": "1",
                "X-MSMail-Priority": "High",
                "Importance": "high",
                "X-Entity-Ref-ID": `${Date.now()}-${code}`,
            },
        });
        console.log(`[TedbabeLearnHUB Mailer] Verification email successfully delivered to ${email}`);
        return { success: true };
    } catch (error) {
        console.error("[TedbabeLearnHUB Mailer] Verification email delivery failed:", error?.message || error);
        console.log(`[TedbabeLearnHUB Mailer] FALLBACK - Verification code for ${email}: [ ${code} ] (Check console log for verification)`);
        return { success: false, error: error?.message || "Delivery failed" };
    }
}

export async function sendPasswordResetEmail({ email, name, resetUrl, code }) {
    const escapedName = escapeHtml(name);
    const smtpUser = senderAddress();
    const fromAddress = formatFromAddress("TedbabeLearnHUB Security", smtpUser);
    try {
        await deliverEmail({
            from: fromAddress,
            replyTo: smtpUser,
            to: email,
            subject: `TedbabeLearnHUB — Password Reset Request (Code: ${code})`,
            text: `Hello ${name}, reset your TedbabeLearnHUB password by visiting: ${resetUrl} or using code ${code}. Valid for 15 minutes.`,
            html: emailWrapper("Password Reset Request", `
              <h1 style="font-size:22px;font-weight:800;color:#ffffff;margin-top:0;">Reset your password</h1>
              <p style="font-size:14px;color:#e2e8f0;line-height:1.6;">Hello <strong style="color:#ffffff;">${escapedName}</strong>,</p>
              <p style="font-size:14px;color:#94a3b8;line-height:1.6;">We received a request to reset the password for your TedbabeLearnHUB account. Click the button below or enter the reset code on the reset page. This link expires in <strong style="color:#ffffff;">15 minutes</strong>.</p>
              <div style="text-align:center;margin:28px 0;">
                <a href="${resetUrl}" style="background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:10px;display:inline-block;box-shadow:0 4px 6px -1px rgba(37,99,235,0.2);">Reset My Password</a>
              </div>
              <div style="background:#1e293b;border:1px dashed #475569;border-radius:10px;padding:16px;text-align:center;margin:20px 0;">
                <span style="font-size:12px;color:#94a3b8;">Or enter reset code:</span>
                <span style="display:block;font-size:28px;font-weight:900;letter-spacing:8px;color:#818cf8;margin-top:4px;font-family:monospace;">${code}</span>
              </div>
              <p style="font-size:13px;color:#64748b;line-height:1.5;">If you did not request a password reset, please ensure your account remains secure and ignore this email.</p>
            `),
            priority: "high",
            headers: {
                "X-Priority": "1",
                "X-MSMail-Priority": "High",
                "Importance": "high",
            },
        });
        return { success: true };
    } catch (error) {
        console.error("[TedbabeLearnHUB Mailer] Password reset email delivery failed:", error?.message || error);
        console.log(`[TedbabeLearnHUB Mailer] FALLBACK - Password reset for ${email}: URL=${resetUrl}, Code=${code}`);
        return { success: false, error: error?.message || "Delivery failed" };
    }
}

export async function sendSecurityAlertEmail({ email, name, action }) {
    const escapedName = escapeHtml(name);
    const smtpUser = senderAddress();
    const fromAddress = formatFromAddress("TedbabeLearnHUB Security", smtpUser);
    try {
        await deliverEmail({
            from: fromAddress,
            replyTo: smtpUser,
            to: email,
            subject: "Security Alert: TedbabeLearnHUB Account Update",
            text: `Hello ${name}, an important security action was performed: ${action}.`,
            html: emailWrapper("Security Alert", `
              <h1 style="font-size:20px;font-weight:800;color:#991b1b;margin-top:0;">Account Security Update</h1>
              <p style="font-size:14px;color:#334155;line-height:1.6;">Hello <strong>${escapedName}</strong>,</p>
              <p style="font-size:14px;color:#334155;line-height:1.6;">This is an alert to notify you that the following security action was recently performed on your account:</p>
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 18px;margin:20px 0;color:#991b1b;font-weight:600;font-size:14px;">
                ${escapeHtml(action)}
              </div>
              <p style="font-size:13px;color:#64748b;line-height:1.5;">If you did not perform this change, please immediately reset your password and contact administrator support.</p>
            `),
        });
    } catch (error) {
        console.error("Security alert email delivery failed.", error);
    }
}

export async function sendAnnouncementEmail({ email, name, title, content, priority = "normal", cohortTitle = null }) {
    const escapedName = escapeHtml(name || "Learner");
    const escapedTitle = escapeHtml(title);
    const escapedContent = escapeHtml(content).replace(/\n/g, "<br/>");
    const smtpUser = senderAddress();
    const fromAddress = formatFromAddress("TedbabeLearnHUB Announcements", smtpUser);
    const badgeColor = priority === "urgent" ? "#ef4444" : priority === "high" ? "#f59e0b" : "#3b82f6";
    const badgeText = priority.toUpperCase();

    try {
        await deliverEmail({
            from: fromAddress,
            replyTo: smtpUser,
            to: email,
            subject: `📢 [TedbabeLearnHUB] ${title}`,
            text: `Hello ${name || "Learner"},\n\nAnnouncement: ${title}\n\n${content}\n\n— TedbabeLearnHUB Team\n${env.CLIENT_URL || "https://tedbabelearnhub.vercel.app"}/dashboard`,
            html: emailWrapper("New Announcement", `
              <div style="display:inline-block;background:${badgeColor};color:#ffffff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;letter-spacing:1px;margin-bottom:12px;">
                ${badgeText} ANNOUNCEMENT
              </div>
              <h1 style="font-size:22px;font-weight:800;color:#ffffff;margin-top:0;line-height:1.3;">${escapedTitle}</h1>
              ${cohortTitle ? `<p style="font-size:13px;color:#38bdf8;margin-top:-6px;font-weight:600;">Cohort: ${escapeHtml(cohortTitle)}</p>` : ""}
              <p style="font-size:14px;color:#e2e8f0;line-height:1.6;">Hello <strong style="color:#ffffff;">${escapedName}</strong>,</p>
              <div style="background:#1e293b;border:1px solid #334155;border-left:4px solid ${badgeColor};border-radius:12px;padding:20px;margin:20px 0;color:#f8fafc;font-size:14px;line-height:1.7;">
                ${escapedContent}
              </div>
              <div style="text-align:center;margin:28px 0;">
                <a href="${env.CLIENT_URL || "https://tedbabelearnhub.vercel.app"}/dashboard" style="background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;display:inline-block;box-shadow:0 4px 12px rgba(37,99,235,0.3);">Open My Dashboard →</a>
              </div>
              <p style="font-size:12px;color:#64748b;line-height:1.5;">You received this notification because you are registered on TedbabeLearnHUB.</p>
            `),
            priority: priority === "urgent" ? "high" : "normal",
        });
        console.log(`[TedbabeLearnHUB Mailer] Announcement email inboxed to ${email}`);
        return { success: true };
    } catch (error) {
        console.error(`[TedbabeLearnHUB Mailer] Failed to inbox announcement to ${email}:`, error?.message || error);
        return { success: false, error: error?.message || "Delivery failed" };
    }
}

export async function sendClassPlacementEmail({ email, name, role = "student", classroomTitle, otherPartyName = null }) {
    const escapedName = escapeHtml(name || "Learner");
    const escapedClass = escapeHtml(classroomTitle || "Your Class");
    const escapedOther = escapeHtml(otherPartyName || "");
    const smtpUser = senderAddress();
    const fromAddress = formatFromAddress("TedbabeLearnHUB Academics", smtpUser);
    const isTeacher = role === "teacher";

    const subject = isTeacher
        ? `🎓 [TedbabeLearnHUB] New student enrolled: ${otherPartyName || "A student"} joined ${classroomTitle}`
        : `🎓 [TedbabeLearnHUB] You have been assigned to: ${classroomTitle}`;

    const headline = isTeacher ? "New Student Enrolled" : "Class Placement Confirmed";
    const bodyMessage = isTeacher
        ? `<p style="font-size:14px;color:#e2e8f0;line-height:1.6;">Hello Instructor <strong style="color:#ffffff;">${escapedName}</strong>,</p>
           <p style="font-size:14px;color:#94a3b8;line-height:1.6;">Student <strong style="color:#38bdf8;">${escapedOther || "A new student"}</strong> has been officially enrolled into your cohort <strong style="color:#ffffff;">${escapedClass}</strong>.</p>
           <p style="font-size:13px;color:#94a3b8;line-height:1.5;">You can view the full roster, share resources, and conduct live sessions in your instructor workspace.</p>`
        : `<p style="font-size:14px;color:#e2e8f0;line-height:1.6;">Hello <strong style="color:#ffffff;">${escapedName}</strong>,</p>
           <p style="font-size:14px;color:#94a3b8;line-height:1.6;">Great news! You have been assigned to cohort <strong style="color:#ffffff;">${escapedClass}</strong>${escapedOther ? ` taught by <strong style="color:#38bdf8;">${escapedOther}</strong>` : ""}.</p>
           <p style="font-size:13px;color:#94a3b8;line-height:1.5;">Your curriculum, assignments, and scheduled live sessions are now available in your learning dashboard.</p>`;

    const actionUrl = `${env.CLIENT_URL || "https://tedbabelearnhub.vercel.app"}/dashboard`;

    try {
        await deliverEmail({
            from: fromAddress,
            replyTo: smtpUser,
            to: email,
            subject,
            text: isTeacher
                ? `Hello ${name}, student ${otherPartyName || "A student"} has joined your class ${classroomTitle}. Check: ${actionUrl}`
                : `Hello ${name}, you have been assigned to class ${classroomTitle}. Check: ${actionUrl}`,
            html: emailWrapper(headline, `
              <div style="display:inline-block;background:#059669;color:#ffffff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;letter-spacing:1px;margin-bottom:12px;">
                CLASS PLACEMENT
              </div>
              <h1 style="font-size:22px;font-weight:800;color:#ffffff;margin-top:0;">${headline}</h1>
              ${bodyMessage}
              <div style="text-align:center;margin:28px 0;">
                <a href="${actionUrl}" style="background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;display:inline-block;box-shadow:0 4px 12px rgba(5,150,105,0.3);">Go to Workspace →</a>
              </div>
            `),
        });
        console.log(`[TedbabeLearnHUB Mailer] Class placement email delivered to ${email}`);
        return { success: true };
    } catch (error) {
        console.error(`[TedbabeLearnHUB Mailer] Failed to deliver class placement email to ${email}:`, error?.message || error);
        return { success: false, error: error?.message || "Delivery failed" };
    }
}

export async function sendSessionScheduledEmail({ email, name, role = "student", sessionTitle, classroomTitle, startsAt, endsAt, meetingUrl = "" }) {
    const escapedName = escapeHtml(name || "Learner");
    const escapedSession = escapeHtml(sessionTitle || "Live Class");
    const escapedClass = escapeHtml(classroomTitle || "Your Class");
    const smtpUser = senderAddress();
    const fromAddress = formatFromAddress("TedbabeLearnHUB Sessions", smtpUser);

    const formattedStart = new Date(startsAt).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short"
    });

    const subject = `📹 [TedbabeLearnHUB] Live Session Scheduled: ${sessionTitle} (${formattedStart})`;
    const actionUrl = `${env.CLIENT_URL || "https://tedbabelearnhub.vercel.app"}/dashboard`;

    try {
        await deliverEmail({
            from: fromAddress,
            replyTo: smtpUser,
            to: email,
            subject,
            text: `Hello ${name},\nA live session "${sessionTitle}" for class "${classroomTitle}" has been scheduled for ${formattedStart}.\n\nNote: The live session link unlocks exactly 10 minutes before start time.\nVisit: ${actionUrl}`,
            html: emailWrapper("New Live Class Scheduled", `
              <div style="display:inline-block;background:#0284c7;color:#ffffff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;letter-spacing:1px;margin-bottom:12px;">
                SCHEDULED LIVE CLASS
              </div>
              <h1 style="font-size:22px;font-weight:800;color:#ffffff;margin-top:0;">${escapedSession}</h1>
              <p style="font-size:14px;color:#e2e8f0;line-height:1.6;">Hello <strong style="color:#ffffff;">${escapedName}</strong>,</p>
              <p style="font-size:14px;color:#94a3b8;line-height:1.6;">A new live class session has been scheduled for cohort <strong style="color:#ffffff;">${escapedClass}</strong>.</p>
              
              <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;margin:20px 0;">
                <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">📅 <strong>Scheduled Time:</strong> <span style="color:#38bdf8;font-weight:bold;">${formattedStart}</span></p>
                <p style="margin:0;font-size:12px;color:#f59e0b;font-weight:600;">🔒 Note: The meeting link automatically activates <strong>10 minutes before class</strong>.</p>
              </div>

              <div style="text-align:center;margin:28px 0;">
                <a href="${actionUrl}" style="background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;display:inline-block;box-shadow:0 4px 12px rgba(2,132,199,0.3);">View in Dashboard →</a>
              </div>
            `),
        });
        console.log(`[TedbabeLearnHUB Mailer] Session scheduled email delivered to ${email}`);
        return { success: true };
    } catch (error) {
        console.error(`[TedbabeLearnHUB Mailer] Failed to deliver session scheduled email to ${email}:`, error?.message || error);
        return { success: false, error: error?.message || "Delivery failed" };
    }
}
