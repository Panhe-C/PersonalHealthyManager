import { describe, expect, it } from "vitest";
import { interpretOAuthReturnUrl } from "./corosOAuth";

describe("interpretOAuthReturnUrl", () => {
  it("treats a missing return URL as a cancelled flow", () => {
    expect(interpretOAuthReturnUrl(undefined)).toEqual({ status: "cancelled" });
    expect(interpretOAuthReturnUrl("")).toEqual({ status: "cancelled" });
  });

  it("recognises a successful authorization", () => {
    expect(interpretOAuthReturnUrl("hbm://mcp-oauth/?mcp=coros&auth=connected")).toEqual({ status: "connected" });
  });

  it("surfaces the server error message", () => {
    expect(interpretOAuthReturnUrl("hbm://mcp-oauth/?auth=failed&error=Invalid%20or%20expired%20OAuth%20state")).toEqual({
      status: "failed",
      message: "Invalid or expired OAuth state"
    });
  });

  it("decodes plus-encoded spaces in the error message", () => {
    expect(interpretOAuthReturnUrl("hbm://mcp-oauth/?auth=failed&error=Token+exchange+failed")).toEqual({
      status: "failed",
      message: "Token exchange failed"
    });
  });

  it("falls back to a readable message when the server sends no error", () => {
    const outcome = interpretOAuthReturnUrl("hbm://mcp-oauth/?auth=failed");
    expect(outcome).toEqual({ status: "failed", message: "COROS 授权未完成。" });
  });

  it("does not mistake a partial match for the auth parameter", () => {
    expect(interpretOAuthReturnUrl("hbm://mcp-oauth/?reauth=connected")).toEqual({
      status: "failed",
      message: "COROS 授权未完成。"
    });
  });

  it("ignores a trailing fragment", () => {
    expect(interpretOAuthReturnUrl("hbm://mcp-oauth/?auth=connected#done")).toEqual({ status: "connected" });
  });
});
