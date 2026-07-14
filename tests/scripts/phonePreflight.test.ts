import { describe, expect, it, vi } from "vitest";
import { collectLanIpv4, probeBackend, profileProbeUrl } from "../../scripts/phone-preflight.mjs";

describe("phone preflight", () => {
  it("returns external IPv4 addresses and ignores loopback", () => {
    expect(collectLanIpv4({
      lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
      en0: [{ address: "192.168.1.20", family: "IPv4", internal: false }],
      utun0: [{ address: "10.0.0.2", family: 4, internal: false }]
    })).toEqual(["192.168.1.20", "10.0.0.2"]);
  });

  it("probes the authenticated profile endpoint", () => {
    expect(profileProbeUrl("http://192.168.1.20:3000/"))
      .toBe("http://192.168.1.20:3000/api/v1/profile");
  });

  it.each([200, 401])("treats HTTP %s as a reachable backend", async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status }));
    await expect(probeBackend("http://192.168.1.20:3000", fetchImpl)).resolves.toBe(status);
  });

  it("rejects an unexpected backend status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    await expect(probeBackend("http://192.168.1.20:3000", fetchImpl))
      .rejects.toThrow("HTTP 503");
  });
});
