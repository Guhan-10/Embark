import type { Email } from "./mailer";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(heading: string, body: string, action: { label: string; url: string }) {
  const url = escapeHtml(action.url);
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a2b2c">
  <h2 style="color:#007c81">${escapeHtml(heading)}</h2>
  <p>${body}</p>
  <p><a href="${url}" style="display:inline-block;background:#007c81;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${escapeHtml(action.label)}</a></p>
  <p style="color:#5e6b6c;font-size:13px">If the button doesn't work, copy this link into your browser:<br>${url}</p>
</div>`;
}

export function resetPasswordTemplate(to: string, name: string, url: string): Email {
  return {
    to,
    subject: "Reset your Embark password",
    text: `Hi ${name},\n\nUse this link to reset your password. It expires in 1 hour:\n${url}\n\nIf you didn't ask for this, you can ignore this email.\n`,
    html: layout(
      "Reset your password",
      `Hi ${escapeHtml(name)}, use the button below to reset your password. The link expires in 1 hour. If you didn't ask for this, you can ignore this email.`,
      { label: "Reset password", url },
    ),
  };
}

export function welcomeTemplate(
  to: string,
  firstName: string,
  addedBy: string,
  url: string,
  validDays: number,
): Email {
  return {
    to,
    subject: "Welcome to Embark — set up your login",
    text: `Hi ${firstName},\n\n${addedBy} has added you to Embark, where you'll find your onboarding tasks and upload your documents.\n\nChoose a password to create your login (this link works once and expires in ${validDays} days):\n${url}\n`,
    html: layout(
      "Welcome to Embark",
      `Hi ${escapeHtml(firstName)}, ${escapeHtml(addedBy)} has added you to Embark, where you'll find your onboarding tasks and upload your documents. Choose a password to create your login. This link works once and expires in ${validDays} days.`,
      { label: "Create your login", url },
    ),
  };
}

/** Email copy of an in-app notification, with a button back to the right page. */
export function notificationTemplate(
  to: string,
  name: string,
  notification: { title: string; body: string | null; link: string | null },
  appUrl: string,
): Email {
  const url = `${appUrl}${notification.link ?? "/notifications"}`;
  const body = notification.body ? `${notification.body}\n\n` : "";
  return {
    to,
    subject: notification.title,
    text: `Hi ${name},\n\n${notification.title}\n${body}Open Embark: ${url}\n`,
    html: layout(
      notification.title,
      `Hi ${escapeHtml(name)},${notification.body ? `<br><br>${escapeHtml(notification.body)}` : ""}`,
      { label: "Open in Embark", url },
    ),
  };
}
