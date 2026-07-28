import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSentEmails,
  readSentEmails,
  resolveAppBaseUrl,
  resolveFromAddress,
  resolveTransport,
  sendEmail
} from "@/src/email/mailer";
import { verificationEmail } from "@/src/email/templates";

describe("email mailer configuration", () => {
  beforeEach(() => {
    clearSentEmails();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the console transport outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("HBM_EMAIL_TRANSPORT", "");

    expect(resolveTransport()).toBe("console");
    expect(resolveAppBaseUrl()).toBe("http://localhost:3000");
    expect(resolveFromAddress()).toContain("@");
  });

  it("refuses to guess production settings", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HBM_EMAIL_TRANSPORT", "");
    vi.stubEnv("HBM_EMAIL_FROM", "");
    vi.stubEnv("HBM_APP_BASE_URL", "");

    expect(() => resolveTransport()).toThrow(/HBM_EMAIL_TRANSPORT/);
    expect(() => resolveFromAddress()).toThrow(/HBM_EMAIL_FROM/);
    expect(() => resolveAppBaseUrl()).toThrow(/HBM_APP_BASE_URL/);
  });

  it("strips a trailing slash from the configured base URL", () => {
    vi.stubEnv("HBM_APP_BASE_URL", "https://hbm.example.com/");

    expect(resolveAppBaseUrl()).toBe("https://hbm.example.com");
  });

  it("captures console-transport messages in the outbox", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("HBM_EMAIL_TRANSPORT", "console");

    await sendEmail(
      verificationEmail({ to: "new@example.com", verifyUrl: "https://hbm.example.com/verify-email?token=abc", expiresInHours: 24 })
    );

    const sent = readSentEmails();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("new@example.com");
    expect(sent[0].text).toContain("https://hbm.example.com/verify-email?token=abc");
    expect(sent[0].html).toContain("Verify email");
  });

  it("escapes untrusted content in the HTML body", () => {
    const message = verificationEmail({
      to: "new@example.com",
      verifyUrl: "https://hbm.example.com/verify-email?token=a\"><script>alert(1)</script>",
      expiresInHours: 24
    });

    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
  });
});
