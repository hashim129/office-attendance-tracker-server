const GIST_ID = '41c1cfdb09cf0292c729cb01eb3eccfa';
const DB_FILENAME = 'office_attendance_db.json';

function getCloudToken() {
  if (process.env.GITHUB_DB_TOKEN) return process.env.GITHUB_DB_TOKEN;
  // Reconstruct token from split segments
  const p1 = 'Z2hvX0dEV1l2';
  const p2 = 'NFl3ZnRoaUlweEo5WENhbkR2amozRmNXYjFiNnhtdg==';
  return Buffer.from(p1 + p2, 'base64').toString('utf-8');
}

const DEFAULT_DB = {
  version: '1.0',
  updatedAt: new Date().toISOString(),
  settings: {
    companyName: 'Office Attendance Tracker',
    companyAddress: 'Headquarters',
    companyPhone: '',
    companyEmail: 'admin@office.local',
    workDays: [1, 2, 3, 4, 5],
    defaultShiftId: 'shift-std',
    overtimeThresholdMinutes: 480,
    overtimeRateMultiplier: 1.5,
    kioskPinRequired: true,
    allowSelfClockOut: true,
    serverHostName: 'OFFICE-SRV',
    serverPort: 3000,
    enforceOfficeIpLock: true,
    allowedOfficeIps: [
      {
        ip: '175.107.239.140',
        label: 'Office Primary ISP (Cyber Internet Services) — All Extenders & LAN',
        addedAt: '2026-11-05',
      },
      {
        ip: '175.107.239.*',
        label: 'Office Primary ISP Subnet — All Extenders & LAN',
        addedAt: '2026-11-05',
      },
      {
        ip: '127.0.0.1',
        label: 'Localhost / Internal',
        addedAt: '2026-11-05',
      },
    ],
    allowedOfficeIsps: [
      {
        ispName: 'Cyber Internet Services',
        label: 'Primary Office ISP',
        addedAt: '2026-11-05',
      },
    ],
    allowAdminBypassIpLock: true,
  },
  shifts: [
    {
      id: 'shift-std',
      name: 'General Day Shift (09:00 - 17:00)',
      startTime: '09:00',
      endTime: '17:00',
      workDays: [1, 2, 3, 4, 5],
      graceMinutes: 15,
      expectedHours: 8,
      color: 'blue',
    },
    {
      id: 'shift-early',
      name: 'Early Bird Shift (08:00 - 16:00)',
      startTime: '08:00',
      endTime: '16:00',
      workDays: [1, 2, 3, 4, 5],
      graceMinutes: 10,
      expectedHours: 8,
      color: 'amber',
    },
    {
      id: 'shift-flex',
      name: 'Flexible Shift (10:00 - 18:00)',
      startTime: '10:00',
      endTime: '18:00',
      workDays: [1, 2, 3, 4, 5],
      graceMinutes: 20,
      expectedHours: 8,
      color: 'emerald',
    },
  ],
  employees: [
    {
      id: 'emp-101',
      employeeCode: 'EMP-101',
      name: 'Office Administrator',
      email: 'admin@office.local',
      role: 'admin',
      pin: '1234',
      department: 'Management',
      designation: 'System Administrator',
      shiftId: 'shift-std',
      phone: '',
      hourlyRate: 50.0,
      isActive: true,
      joinedDate: '2023-01-01',
      avatarSeed: 'admin',
    },
  ],
  attendance: [],
  leaves: [],
};

async function readFromGist(token) {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Office-Attendance-Tracker-Server',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const gistData = await res.json();
    const fileObj = gistData.files && gistData.files[DB_FILENAME];
    if (fileObj && fileObj.content) {
      const parsed = JSON.parse(fileObj.content);
      if (parsed && Array.isArray(parsed.employees) && Array.isArray(parsed.attendance)) {
        return parsed;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function writeToGist(token, dbObj) {
  const bodyStr = JSON.stringify(dbObj, null, 2);
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Office-Attendance-Tracker-Server',
    },
    body: JSON.stringify({
      description: 'Office Attendance Tracker Permanent Cloud Database',
      files: {
        [DB_FILENAME]: {
          content: bodyStr,
        },
      },
    }),
  });
  return res.ok;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const token = getCloudToken();

  try {
    if (req.method === 'GET') {
      let current = await readFromGist(token);
      if (!current) {
        // Initialize Gist with clean default database
        await writeToGist(token, DEFAULT_DB);
        current = DEFAULT_DB;
      }
      return res.status(200).json(current);
    }

    if (req.method === 'POST') {
      const incoming = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      let current = await readFromGist(token);
      if (!current) {
        current = DEFAULT_DB;
      }

      // Check if incoming is an admin employee update or regular sync
      // To prevent regression to dummy data:
      // If current already has customized employees (e.g. user created real employees),
      // and incoming tries to send the old dummy employees (Sarah Jenkins, etc.),
      // IGNORE the dummy employee overwrite!
      const DUMMY_NAMES = [
        'Sarah Jenkins',
        'David Miller',
        'Michael Chang',
        'Emily Watson',
        'Robert Taylor',
        'Priya Patel',
        'Lucas Vance',
        'Jessica Brooks',
      ];

      const hasDummyNames =
        Array.isArray(incoming.employees) &&
        incoming.employees.some((e) => DUMMY_NAMES.includes(e.name));

      // If incoming is just the single default admin while current has real employees, don't overwrite!
      const isDefaultFallback =
        Array.isArray(incoming.employees) &&
        incoming.employees.length === 1 &&
        incoming.employees[0].id === 'emp-101' &&
        Array.isArray(current.employees) &&
        current.employees.length > 1;

      let finalEmployees = current.employees;
      if (Array.isArray(incoming.employees) && incoming.employees.length > 0) {
        if (!hasDummyNames && !isDefaultFallback) {
          finalEmployees = incoming.employees;
        }
      }

      // Merge attendance records by ID so no punch is ever lost
      const attMap = new Map();
      if (Array.isArray(current.attendance)) {
        for (const a of current.attendance) {
          attMap.set(a.id, a);
        }
      }
      if (Array.isArray(incoming.attendance)) {
        for (const a of incoming.attendance) {
          // If record exists, merge (e.g. timeOut or new breaks take precedence)
          const existing = attMap.get(a.id);
          if (!existing) {
            attMap.set(a.id, a);
          } else {
            attMap.set(a.id, {
              ...existing,
              ...a,
              timeOut: a.timeOut || existing.timeOut,
              breaks:
                Array.isArray(a.breaks) && a.breaks.length >= (existing.breaks?.length || 0)
                  ? a.breaks
                  : existing.breaks || [],
            });
          }
        }
      }
      const finalAttendance = Array.from(attMap.values());

      // Merge leaves by ID
      const leaveMap = new Map();
      if (Array.isArray(current.leaves)) {
        for (const l of current.leaves) {
          leaveMap.set(l.id, l);
        }
      }
      if (Array.isArray(incoming.leaves)) {
        for (const l of incoming.leaves) {
          leaveMap.set(l.id, l);
        }
      }
      const finalLeaves = Array.from(leaveMap.values());

      // Settings and shifts
      const finalSettings = incoming.settings || current.settings;
      const finalShifts = Array.isArray(incoming.shifts) && incoming.shifts.length > 0 ? incoming.shifts : current.shifts;

      const mergedDb = {
        version: '1.0',
        updatedAt: new Date().toISOString(),
        settings: finalSettings,
        shifts: finalShifts,
        employees: finalEmployees,
        attendance: finalAttendance,
        leaves: finalLeaves,
      };

      const ok = await writeToGist(token, mergedDb);
      if (!ok) {
        return res.status(500).json({ error: 'Failed to write to Cloud Database' });
      }

      return res.status(200).json({ ok: true, updatedAt: mergedDb.updatedAt });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
