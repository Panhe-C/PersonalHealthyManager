import type { EmailMessage } from "./mailer";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(heading: string, paragraphs: string[], action?: { label: string; url: string }): string {
  const body = paragraphs.map((line) => `<p style="margin:0 0 14px;line-height:1.6;">${escapeHtml(line)}</p>`).join("");
  const button = action
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(action.url)}" style="background:#3f5c4c;color:#ffffff;border-radius:10px;padding:12px 20px;text-decoration:none;display:inline-block;">${escapeHtml(action.label)}</a></p>
       <p style="margin:0 0 14px;line-height:1.6;color:#6b7280;font-size:13px;">If the button does not work, paste this link into your browser:<br /><span style="word-break:break-all;">${escapeHtml(action.url)}</span></p>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2933;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
      <h1 style="margin:0 0 18px;font-size:20px;">${escapeHtml(heading)}</h1>
      ${body}
      ${button}
      <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">Healthy Body Manager</p>
    </div>
  </body>
</html>`;
}

export function verificationEmail(params: { to: string; verifyUrl: string; expiresInHours: number }): EmailMessage {
  const paragraphs = [
    "Confirm this address to finish creating your Healthy Body Manager account.",
    `This link expires in ${params.expiresInHours} hours. If it does, request a new one from the sign-in page.`,
    "If you did not sign up, you can ignore this email and no account will be activated."
  ];

  return {
    to: params.to,
    subject: "Verify your Healthy Body Manager email",
    text: [
      "Confirm this address to finish creating your Healthy Body Manager account.",
      "",
      params.verifyUrl,
      "",
      `This link expires in ${params.expiresInHours} hours. If it does, request a new one from the sign-in page.`,
      "If you did not sign up, you can ignore this email and no account will be activated."
    ].join("\n"),
    html: layout("Verify your email", paragraphs, { label: "Verify email", url: params.verifyUrl })
  };
}

export function passwordResetEmail(params: { to: string; resetUrl: string; expiresInMinutes: number }): EmailMessage {
  const paragraphs = [
    "Use the link below to choose a new Healthy Body Manager password.",
    `This link expires in ${params.expiresInMinutes} minutes and can only be used once. Signing in again on your other devices will be required afterwards.`,
    "If you did not ask for this, you can ignore this email. Your password has not changed."
  ];

  return {
    to: params.to,
    subject: "Reset your Healthy Body Manager password",
    text: [
      "Use the link below to choose a new Healthy Body Manager password.",
      "",
      params.resetUrl,
      "",
      `This link expires in ${params.expiresInMinutes} minutes and can only be used once.`,
      "If you did not ask for this, you can ignore this email. Your password has not changed."
    ].join("\n"),
    html: layout("Reset your password", paragraphs, { label: "Choose a new password", url: params.resetUrl })
  };
}

/**
 * Sent when someone tries to register an address that already has a verified
 * account. Registration responses are identical either way, so this email is
 * what keeps the real owner of the address informed.
 */
export function accountAlreadyExistsEmail(params: { to: string; signInUrl: string }): EmailMessage {
  const paragraphs = [
    "Someone tried to create a Healthy Body Manager account with this email address, but an account already exists.",
    "If that was you, sign in instead. You can reset your password from the sign-in page if you have forgotten it.",
    "If it was not you, no action is needed: no new account was created and your existing account was not changed."
  ];

  return {
    to: params.to,
    subject: "You already have a Healthy Body Manager account",
    text: [
      "Someone tried to create a Healthy Body Manager account with this email address, but an account already exists.",
      "",
      params.signInUrl,
      "",
      "If it was not you, no action is needed: no new account was created and your existing account was not changed."
    ].join("\n"),
    html: layout("Account already exists", paragraphs, { label: "Go to sign in", url: params.signInUrl })
  };
}
