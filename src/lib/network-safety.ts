import dns from "node:dns/promises";
import { BlockList, isIP } from "node:net";

type HostDecision = {
  allowed: boolean;
  expiresAt: number;
};

const HOST_CACHE_TTL_MS = 10 * 60 * 1000;
const hostnameDecisionCache = new Map<string, HostDecision>();

const blockedNetworks = new BlockList();

blockedNetworks.addSubnet("0.0.0.0", 8);
blockedNetworks.addSubnet("10.0.0.0", 8);
blockedNetworks.addSubnet("100.64.0.0", 10);
blockedNetworks.addSubnet("127.0.0.0", 8);
blockedNetworks.addSubnet("169.254.0.0", 16);
blockedNetworks.addSubnet("172.16.0.0", 12);
blockedNetworks.addSubnet("192.168.0.0", 16);
blockedNetworks.addSubnet("198.18.0.0", 15);
blockedNetworks.addSubnet("224.0.0.0", 4);
blockedNetworks.addSubnet("::", 128, "ipv6");
blockedNetworks.addSubnet("::1", 128, "ipv6");
blockedNetworks.addSubnet("fc00::", 7, "ipv6");
blockedNetworks.addSubnet("fe80::", 10, "ipv6");
blockedNetworks.addSubnet("ff00::", 8, "ipv6");

function isIpBlocked(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return blockedNetworks.check(address, "ipv4");
  }

  if (family === 6) {
    return blockedNetworks.check(address, "ipv6");
  }

  return true;
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

function isBlockedHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".local")) {
    return true;
  }

  return false;
}

export async function isPublicInternetHostname(hostname: string): Promise<boolean> {
  const normalized = normalizeHostname(hostname);
  if (!normalized || isBlockedHostname(normalized)) {
    return false;
  }

  const ipFamily = isIP(normalized);
  if (ipFamily > 0) {
    return !isIpBlocked(normalized);
  }

  const cached = hostnameDecisionCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.allowed;
  }

  try {
    const records = await dns.lookup(normalized, {
      all: true,
      verbatim: true,
    });

    if (records.length === 0) {
      hostnameDecisionCache.set(normalized, {
        allowed: false,
        expiresAt: Date.now() + HOST_CACHE_TTL_MS,
      });
      return false;
    }

    const allowed = records.every((record) => !isIpBlocked(record.address));
    hostnameDecisionCache.set(normalized, {
      allowed,
      expiresAt: Date.now() + HOST_CACHE_TTL_MS,
    });

    return allowed;
  } catch {
    hostnameDecisionCache.set(normalized, {
      allowed: false,
      expiresAt: Date.now() + HOST_CACHE_TTL_MS,
    });
    return false;
  }
}
