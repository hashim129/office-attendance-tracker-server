import { Employee, OfficeSettings } from '../types';

const DEVICE_STORAGE_KEY = 'office_device_id_v2';

export interface DeviceInfo {
  deviceId: string;
  deviceLabel: string;
  os: string;
  browser: string;
  isMobile: boolean;
}

/**
 * Get or initialize a unique persistent Device Identifier for this browser / phone
 */
export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!id) {
      const entropy = [
        Date.now().toString(36),
        Math.random().toString(36).substring(2, 9),
        typeof window !== 'undefined' ? `${window.screen?.width}x${window.screen?.height}` : 'screen',
        typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
      ].join('-');
      id = `dev-${entropy}`;
      localStorage.setItem(DEVICE_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `dev-${Date.now().toString(36)}`;
  }
}

/**
 * Parse browser & OS details to create a clear human-readable device name
 */
export function getDeviceDetails(): DeviceInfo {
  const deviceId = getOrCreateDeviceId();
  if (typeof navigator === 'undefined') {
    return {
      deviceId,
      deviceLabel: 'Office Terminal',
      os: 'Unknown',
      browser: 'Web',
      isMobile: false,
    };
  }

  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  let isMobile = false;

  // OS Detection
  if (/Android/i.test(ua)) {
    os = 'Android';
    isMobile = true;
    const match = ua.match(/Android\s+([\d.]+)/i);
    const modelMatch = ua.match(/;\s*([^;)]+)\s*Build/i);
    if (modelMatch && modelMatch[1]) {
      os = `${modelMatch[1].trim()} (Android ${match ? match[1] : ''})`.trim();
    } else if (match) {
      os = `Android ${match[1]}`;
    }
  } else if (/iPhone/i.test(ua)) {
    os = 'Apple iPhone (iOS)';
    isMobile = true;
    const match = ua.match(/OS\s+([\d_]+)/i);
    if (match) os = `Apple iPhone (iOS ${match[1].replace(/_/g, '.')})`;
  } else if (/iPad/i.test(ua)) {
    os = 'Apple iPad (iPadOS)';
    isMobile = true;
  } else if (/Windows/i.test(ua)) {
    os = 'Windows PC';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'Macintosh';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux PC';
  }

  // Browser Detection
  let browser = 'Web Browser';
  if (/Edg/i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) {
    browser = isMobile ? 'Chrome Mobile' : 'Google Chrome';
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = isMobile ? 'Mobile Safari' : 'Apple Safari';
  } else if (/Firefox/i.test(ua)) {
    browser = 'Mozilla Firefox';
  }

  const deviceLabel = `${os} · ${browser}`;

  return {
    deviceId,
    deviceLabel,
    os,
    browser,
    isMobile,
  };
}

export interface DeviceVerificationResult {
  allowed: boolean;
  reason?: string;
  shouldRegister?: boolean;
  currentDeviceId: string;
  currentDeviceName: string;
  conflictEmployee?: Employee;
  requiresBindingRequest?: boolean;
  isPendingApproval?: boolean;
  isDeviceMismatch?: boolean;
}

/**
 * Verify whether this device is authorized to punch for this employee
 * Enforces 1-device-per-employee to stop PIN sharing and proxy punching
 */
export function verifyDeviceAccess(
  employee: Employee,
  allEmployees: Employee[],
  settings: OfficeSettings,
  isKiosk = false
): DeviceVerificationResult {
  const { deviceId, deviceLabel } = getDeviceDetails();

  // If feature is disabled in settings, allow all
  if (settings.enforceDeviceBinding === false) {
    return {
      allowed: true,
      currentDeviceId: deviceId,
      currentDeviceName: deviceLabel,
    };
  }

  // Lobby Kiosk Terminal exemption (if wall tablet is used)
  if (isKiosk && (settings.allowKioskPunchWithoutDevice ?? true)) {
    return {
      allowed: true,
      currentDeviceId: deviceId,
      currentDeviceName: 'Office Reception Kiosk Terminal',
    };
  }

  // Admin bypass (admins can manage or test from any device)
  if (employee.role === 'admin' && (settings.allowAdminBypassDeviceBinding ?? true)) {
    return {
      allowed: true,
      currentDeviceId: deviceId,
      currentDeviceName: deviceLabel,
    };
  }

  // 1. Check if this device is already bound to ANOTHER employee
  const otherOwner = allEmployees.find(
    (e) => e.id !== employee.id && e.registeredDeviceId === deviceId
  );
  if (otherOwner) {
    return {
      allowed: false,
      reason: `Proxy Punch Blocked: This mobile device is already bound to "${otherOwner.name}". Employees are strictly prohibited from clocking in from colleagues' devices or sharing PINs.`,
      conflictEmployee: otherOwner,
      currentDeviceId: deviceId,
      currentDeviceName: deviceLabel,
    };
  }

  // 2. Check if this employee already has a registered device
  if (!employee.registeredDeviceId) {
    if (employee.pendingDeviceRequest && employee.pendingDeviceRequest.status === 'pending') {
      return {
        allowed: false,
        reason: `Device Approval Pending: Your device binding request for "${employee.pendingDeviceRequest.requestedDeviceName}" has been submitted and is waiting for Administrator approval.`,
        currentDeviceId: deviceId,
        currentDeviceName: deviceLabel,
        isPendingApproval: true,
      };
    }
    return {
      allowed: false,
      reason: `Device Not Bound: Your account has no approved personal phone bound. To prevent proxy punching, all employee devices must be approved by an Administrator. Click "Request Phone Approval" below.`,
      currentDeviceId: deviceId,
      currentDeviceName: deviceLabel,
      requiresBindingRequest: true,
    };
  }

  // 3. Verify match
  if (employee.registeredDeviceId === deviceId) {
    return {
      allowed: true,
      currentDeviceId: deviceId,
      currentDeviceName: deviceLabel,
    };
  }

  // 4. Device Mismatch
  const hasPending = employee.pendingDeviceRequest && employee.pendingDeviceRequest.status === 'pending';
  return {
    allowed: false,
    reason: hasPending
      ? `Phone Change Pending: Your request to switch your registered device to "${employee.pendingDeviceRequest?.requestedDeviceName}" is waiting for Administrator approval.`
      : `Proxy Punch Blocked (Device Mismatch): Your account is locked to your approved personal phone ("${employee.registeredDeviceName || 'Registered Device'}"). Punching from an unrecognized device ("${deviceLabel}") is not permitted. Request an Admin approval below if you changed your phone.`,
    currentDeviceId: deviceId,
    currentDeviceName: deviceLabel,
    isDeviceMismatch: true,
    isPendingApproval: hasPending,
  };
}
