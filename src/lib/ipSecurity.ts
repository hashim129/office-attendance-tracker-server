import { Employee, OfficeSettings } from '../types';

export interface ClientNetworkIdentity {
  ip: string;
  isp: string;
  asn: string;
}

/**
 * Detects both the client's Public IPv4/IPv6 address AND their Internet Service Provider (ISP).
 * Note: All Wi-Fi extenders, mesh nodes, access points, and Ethernet switches connected to
 * the same ISP router automatically share the exact same Public IP and ISP!
 */
export async function detectClientNetwork(): Promise<ClientNetworkIdentity> {
  // 1. Primary lookup via ipwho.is (returns Public IP + ISP name + ASN, CORS-friendly, no rate-limit key required)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://ipwho.is/', {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        const ispName =
          data.connection?.isp ||
          data.connection?.org ||
          'Unknown ISP';
        const asnStr = data.connection?.asn ? `AS${data.connection.asn}` : '';
        return {
          ip: String(data.ip).trim(),
          isp: String(ispName).trim(),
          asn: asnStr,
        };
      }
    }
  } catch {
    // Fallback to ipify
  }

  // 2. Fallback to ipify for Public IP
  const endpoints = [
    'https://api.ipify.org?format=json',
    'https://api64.ipify.org?format=json',
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.ip === 'string' && data.ip.trim()) {
          return {
            ip: data.ip.trim(),
            isp: 'Detected via IP',
            asn: '',
          };
        }
      }
    } catch {
      // Fall through
    }
  }

  // 3. Fallback to local backend /api/my-ip
  try {
    const res = await fetch('/api/my-ip', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.ip === 'string' && data.ip.trim()) {
        return {
          ip: data.ip.trim(),
          isp: 'Local Office LAN',
          asn: '',
        };
      }
    }
  } catch {
    // Ignore
  }

  return { ip: 'Unknown', isp: 'Unknown', asn: '' };
}

/**
 * Legacy helper returning just the IP string
 */
export async function detectClientIp(): Promise<string> {
  const info = await detectClientNetwork();
  return info.ip;
}

/**
 * Checks whether a single IP matches an allowed IP rule.
 * Supports:
 * - Exact match: "175.107.239.140"
 * - Wildcard prefix: "175.107.239.*" or "175.107.*"
 * - CIDR /24 or /16 prefix: "175.107.239.0/24"
 */
export function doesIpMatchRule(clientIp: string, ruleIp: string): boolean {
  const cleanClient = clientIp.trim().toLowerCase();
  const cleanRule = ruleIp.trim().toLowerCase();

  if (!cleanClient || !cleanRule) return false;
  if (cleanClient === cleanRule) return true;

  // Wildcard matching e.g. 175.107.239.*
  if (cleanRule.includes('*')) {
    const prefix = cleanRule.split('*')[0];
    if (prefix && cleanClient.startsWith(prefix)) {
      return true;
    }
  }

  // Simple /24 or /16 CIDR matching for IPv4
  if (cleanRule.includes('/')) {
    const [baseIp, bitsStr] = cleanRule.split('/');
    const bits = parseInt(bitsStr, 10);
    const clientParts = cleanClient.split('.');
    const baseParts = baseIp.split('.');
    if (clientParts.length === 4 && baseParts.length === 4) {
      if (bits === 24 && clientParts.slice(0, 3).join('.') === baseParts.slice(0, 3).join('.')) {
        return true;
      }
      if (bits === 16 && clientParts.slice(0, 2).join('.') === baseParts.slice(0, 2).join('.')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Evaluates whether the current user, IP, and ISP are allowed to mark attendance.
 */
export function verifyOfficeIpAccess(
  clientIp: string,
  settings: OfficeSettings,
  user?: Employee | null,
  clientIsp?: string
): {
  allowed: boolean;
  reason?: string;
  matchedLabel?: string;
} {
  if (!settings.enforceOfficeIpLock) {
    return { allowed: true, matchedLabel: 'IP Lock Disabled' };
  }

  const allowedList = settings.allowedOfficeIps || [];
  const allowedIsps = settings.allowedOfficeIsps || [];

  // 1. Check if the IP matches any configured Office IP (Provider 1, Provider 2, or Subnet)
  for (const item of allowedList) {
    if (doesIpMatchRule(clientIp, item.ip)) {
      return {
        allowed: true,
        matchedLabel: item.label || 'Authorized Office IP',
      };
    }
  }

  // 2. Check if the ISP matches any configured Office Internet Provider (if ISP matching is used)
  if (clientIsp && allowedIsps.length > 0) {
    const cleanClientIsp = clientIsp.trim().toLowerCase();
    for (const ispItem of allowedIsps) {
      const cleanRuleIsp = ispItem.ispName.trim().toLowerCase();
      if (cleanRuleIsp && cleanClientIsp.includes(cleanRuleIsp)) {
        return {
          allowed: true,
          matchedLabel: `${ispItem.label} (${ispItem.ispName})`,
        };
      }
    }
  }

  // 3. Check if Admin bypass is enabled for Admin role
  if (user?.role === 'admin' && settings.allowAdminBypassIpLock) {
    return {
      allowed: true,
      matchedLabel: 'Admin Remote Bypass',
    };
  }

  if (allowedList.length === 0 && allowedIsps.length === 0) {
    return {
      allowed: true,
      matchedLabel: 'No IPs/ISPs configured yet',
    };
  }

  return {
    allowed: false,
    reason: `Your current network (IP: ${clientIp}${clientIsp ? `, ISP: ${clientIsp}` : ''}) is not connected to either of the Office Internet Providers. Please connect to an Office Wi-Fi, Extender, or Office Ethernet cable to mark attendance.`,
  };
}
