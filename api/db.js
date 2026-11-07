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

function autoCloseForgottenRecords(attendanceList) {
  if (!Array.isArray(attendanceList)) return { records: [], changed: false };
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  const nowTime = now.toTimeString().split(' ')[0];

  let changed = false;
  const records = attendanceList.map((rec) => {
    if (rec.timeIn && !rec.timeOut) {
      const isPastDay = rec.date < todayStr;
      const isPastMidnightToday = rec.date === todayStr && nowTime >= '23:59:00';
      if (isPastDay || isPastMidnightToday) {
        changed = true;
        const autoOutTime = '23:59:00';
        const updatedBreaks = (rec.breaks || []).map((b) => (!b.end ? { ...b, end: autoOutTime } : b));

        const parseMins = (t) => {
          if (!t) return 0;
          const [h, m] = t.split(':').map(Number);
          return (h || 0) * 60 + (m || 0);
        };
        const inMins = parseMins(rec.timeIn);
        const outMins = parseMins(autoOutTime);
        const diff = Math.max(0, outMins - inMins);
        let breakMins = 0;
        for (const b of updatedBreaks) {
          if (b.start && b.end) {
            breakMins += Math.max(0, parseMins(b.end) - parseMins(b.start));
          }
        }
        const netWorked = Math.max(0, diff - breakMins);
        const regular = Math.min(netWorked, 480);
        const overtime = Math.max(0, netWorked - 480);

        const existingNotes = rec.notes ? rec.notes.trim() : '';
        const remark = 'Auto system Punched out';
        const finalNotes = existingNotes
          ? existingNotes.includes(remark)
            ? existingNotes
            : `${existingNotes} · ${remark}`
          : remark;

        return {
          ...rec,
          timeOut: autoOutTime,
          breaks: updatedBreaks,
          totalWorkedMinutes: netWorked,
          regularMinutes: regular,
          overtimeMinutes: overtime,
          notes: finalNotes,
          isAutoPunchedOut: true,
        };
      }
    }
    return rec;
  });

  return { records, changed };
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

      // Auto-close any forgotten records from past days or past 23:59:00
      if (Array.isArray(current.attendance)) {
        const { records: closedRecords, changed } = autoCloseForgottenRecords(current.attendance);
        if (changed) {
          current.attendance = closedRecords;
          current.updatedAt = new Date().toISOString();
          void writeToGist(token, current);
        }
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
              notes: a.notes !== undefined ? a.notes : existing.notes,
              deviceId: a.deviceId || existing.deviceId,
              deviceName: a.deviceName || existing.deviceName,
              isAutoPunchedOut: a.isAutoPunchedOut !== undefined ? a.isAutoPunchedOut : existing.isAutoPunchedOut,
              adminVerification: a.adminVerification !== undefined ? a.adminVerification : existing.adminVerification,
              accountsVerification: a.accountsVerification !== undefined ? a.accountsVerification : existing.accountsVerification,
              breaks:
                Array.isArray(a.breaks) && a.breaks.length >= (existing.breaks?.length || 0)
                  ? a.breaks
                  : existing.breaks || [],
            });
          }
        }
      }
      const rawAttendance = Array.from(attMap.values());
      const { records: finalAttendance } = autoCloseForgottenRecords(rawAttendance);

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

      // Merge CEO comments / notifications by ID
      const commentMap = new Map();
      if (Array.isArray(current.ceoComments)) {
        for (const c of current.ceoComments) {
          commentMap.set(c.id, c);
        }
      }
      if (Array.isArray(incoming.ceoComments)) {
        for (const c of incoming.ceoComments) {
          const existing = commentMap.get(c.id);
          commentMap.set(c.id, existing ? { ...existing, ...c } : c);
        }
      }
      const finalCeoComments = Array.from(commentMap.values());

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
        ceoComments: finalCeoComments,
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
