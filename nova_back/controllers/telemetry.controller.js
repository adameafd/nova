const db = require("../config/db_telemetry");

// ── Helpers ────────────────────────────────────────────────────────────────────

function isNum(v)  { return typeof v === "number" && isFinite(v); }
function isBool(v) { return typeof v === "boolean"; }

function validatePayload(body) {
  const errs = [];
  if (!body?.device?.id || typeof body.device.id !== "string")
    errs.push("device.id manquant ou invalide");
  if (!isNum(body?.timestamp_ms))
    errs.push("timestamp_ms doit être un nombre");

  const sc = body?.supercap;
  if (sc !== undefined) {
    if (sc.voltage   !== undefined && sc.voltage   !== null && (!isNum(sc.voltage)   || sc.voltage   < 0)) errs.push("supercap.voltage invalide (>= 0)");
    if (sc.energy_j  !== undefined && sc.energy_j  !== null && (!isNum(sc.energy_j)  || sc.energy_j  < 0)) errs.push("supercap.energy_j invalide (>= 0)");
  }

  const bat = body?.battery;
  if (bat !== undefined) {
    if (bat.voltage   !== undefined && bat.voltage   !== null && (!isNum(bat.voltage)   || bat.voltage   < 0)) errs.push("battery.voltage invalide (>= 0)");
    if (bat.current_a !== undefined && bat.current_a !== null && !isNum(bat.current_a))  errs.push("battery.current_a invalide");
  }

  return errs;
}

// ── Normalisation → objet retourné par l'API et Socket.io ─────────────────────

function normalize(row) {
  const tsMs = row.timestamp_ms > 1e11 ? row.timestamp_ms : row.timestamp_ms * 1000;
  return {
    deviceId:   row.device_id,
    receivedAt: row.created_at,
    timestamp:  tsMs,
    supercap: {
      voltage:  row.sc_tension  !== null && row.sc_tension  !== undefined ? parseFloat(row.sc_tension)  : null,
      energy_j: row.sc_energie  !== null && row.sc_energie  !== undefined ? parseFloat(row.sc_energie)  : null,
    },
    battery: {
      voltage:   row.bat_tension  !== null && row.bat_tension  !== undefined ? parseFloat(row.bat_tension)  : null,
      current_a: row.bat_courant  !== null && row.bat_courant  !== undefined ? parseFloat(row.bat_courant)  : null,
      direction: row.bat_etat     ?? null,
    },
    system: {
      led_on: row.sys_led !== null && row.sys_led !== undefined ? Boolean(row.sys_led) : null,
      status: row.sys_status ?? null,
    },
  };
}

// ── Requête commune ────────────────────────────────────────────────────────────

const JOIN_SQL = `
  SELECT
    m.id, m.device_id, m.timestamp_ms, m.created_at,
    s.tension_V  AS sc_tension,  s.energie_J  AS sc_energie,
    b.tension_V  AS bat_tension, b.courant_A  AS bat_courant, b.etat AS bat_etat,
    sy.led_on    AS sys_led,     sy.status    AS sys_status
  FROM mesures m
  LEFT JOIN supercap s  ON s.mesure_id  = m.id
  LEFT JOIN batterie b  ON b.mesure_id  = m.id
  LEFT JOIN systeme  sy ON sy.mesure_id = m.id
`;

// ── POST /api/telemetry ────────────────────────────────────────────────────────

exports.receive = async (req, res, next) => {
  try {
    const body = req.body;
    const errs = validatePayload(body);
    if (errs.length > 0)
      return res.status(400).json({ error: "Payload invalide", details: errs });

    const deviceId  = body.device.id;
    const firmware  = body.device.firmware || null;
    const tsMs      = body.timestamp_ms;
    const sc        = body.supercap  || {};
    const bat       = body.battery   || {};
    const sys       = body.system    || {};

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Upsert device
      await conn.query(
        `INSERT INTO devices (device_id, firmware)
         VALUES (?, ?)
         ON CONFLICT (device_id) DO UPDATE SET firmware = EXCLUDED.firmware`,
        [deviceId, firmware]
      );

      // 2. Insert mesure (parent)
      const [mRes] = await conn.query(
        `INSERT INTO mesures (device_id, timestamp_ms) VALUES (?, ?)`,
        [deviceId, tsMs]
      );
      const mesureId = mRes.insertId;

      // 3. Insert supercap
      await conn.query(
        `INSERT INTO supercap (mesure_id, tension_V, energie_J) VALUES (?, ?, ?)`,
        [mesureId, sc.voltage ?? null, sc.energy_j ?? null]
      );

      // 4. Insert batterie
      await conn.query(
        `INSERT INTO batterie (mesure_id, tension_V, courant_A, etat) VALUES (?, ?, ?, ?)`,
        [mesureId, bat.voltage ?? null, bat.current_a ?? null, bat.direction ?? null]
      );

      // 5. Insert systeme
      await conn.query(
        `INSERT INTO systeme (mesure_id, led_on, status) VALUES (?, ?, ?)`,
        [
          mesureId,
          sys.led_on !== undefined ? (sys.led_on ? 1 : 0) : null,
          sys.status ?? null,
        ]
      );

      await conn.commit();

      // 6. Récupérer la ligne complète
      const [rows] = await conn.query(JOIN_SQL + " WHERE m.id = ?", [mesureId]);
      const payload = normalize(rows[0]);

      // 7. Emit Socket.io
      const io = req.app.locals.io;
      if (io) {
        io.emit("telemetry_update", payload);
        console.log(`[telemetry] Socket emit → ${deviceId}`);
      }

      console.log(`[telemetry] Reçu OK → device=${deviceId} sc=${sc.voltage}V bat=${bat.voltage}V`);
      return res.status(201).json({ ok: true, id: mesureId, data: payload });

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[telemetry] Erreur receive:", err.message);
    next(err);
  }
};

// ── GET /api/telemetry/latest?deviceId=... ────────────────────────────────────

exports.getLatest = async (req, res, next) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) return res.status(400).json({ error: "deviceId requis" });

    const [rows] = await db.query(
      JOIN_SQL + " WHERE m.device_id = ? ORDER BY m.timestamp_ms DESC LIMIT 1",
      [deviceId]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Aucune mesure pour ce device" });

    return res.json(normalize(rows[0]));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/telemetry/history?deviceId=...&range=10m|1h|24h|7d ──────────────

const RANGE_MAP = { "10m": 10, "1h": 60, "24h": 1440, "7d": 10080 };

exports.getHistory = async (req, res, next) => {
  try {
    const { deviceId, range = "10m" } = req.query;
    if (!deviceId) return res.status(400).json({ error: "deviceId requis" });

    const minutes = RANGE_MAP[range] ?? 10;

    const [rows] = await db.query(
      JOIN_SQL +
      " WHERE m.device_id = ? AND m.created_at >= NOW() - (? * INTERVAL '1 minute')" +
      " ORDER BY m.timestamp_ms ASC LIMIT 1000",
      [deviceId, minutes]
    );

    return res.json(rows.map(normalize));
  } catch (err) {
    next(err);
  }
};

// ── GET /api/telemetry/devices ────────────────────────────────────────────────

exports.getDevices = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT d.device_id, d.firmware, d.created_at,
              MAX(m.created_at) AS last_seen
       FROM devices d
       LEFT JOIN mesures m ON m.device_id = d.device_id
       GROUP BY d.device_id, d.firmware, d.created_at
       ORDER BY last_seen DESC`
    );
    return res.json(rows);
  } catch (err) {
    next(err);
  }
};

// ── GET /api/telemetry/test ───────────────────────────────────────────────────

exports.test = async (req, res) => {
  const result = { ok: false, database: db.name, tables: [], error: null };
  try {
    const [rows] = await db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('devices','mesures','supercap','batterie','systeme') ORDER BY table_name"
    );
    result.tables = rows.map(r => r.table_name);
    result.ok = result.tables.length > 0;
    return res.json(result);
  } catch (err) {
    result.error = err.message;
    return res.status(503).json(result);
  }
};
