import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker-api/image-hosting-worker.js";

class FakeStatement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new FakeStatement(this.db, this.sql, params);
  }

  run() {
    return this.db.execute(this.sql, this.params, "run");
  }

  first() {
    return this.db.execute(this.sql, this.params, "first");
  }

  all() {
    return this.db.execute(this.sql, this.params, "all");
  }
}

class FakeD1 {
  constructor() {
    this.apiUsers = new Map();
    this.vipCodes = new Map();
    this.dailyUsage = new Map();
    this.idempotency = new Map();
    this.images = new Map();
    this.uploadEvents = [];
    this.vacuumRuns = 0;
    this.imageColumns = new Set([
      "id", "r2_key", "public_url", "folder", "status", "risk", "risk_reasons",
      "size", "mime", "file_hash", "ip", "ip_hash", "country", "region",
      "region_code", "city", "timezone", "colo", "user_agent", "origin",
      "referer", "vip_id", "duration", "is_vip", "is_personal", "uploaded_at",
      "audited_at", "deleted_at", "expires_at", "created_at", "updated_at"
    ]);
    this.apiUserColumns = new Set([
      "id", "code", "note", "key_prefix", "key_hash", "plan_type",
      "allow_temporary", "temporary_daily_limit", "allow_permanent",
      "permanent_quota_total", "permanent_quota_used", "payment_status",
      "price_cents", "payment_note", "active", "created_at", "updated_at",
      "last_used_at"
    ]);
    this.vipColumns = new Set(["code", "note", "active", "created_at", "updated_at"]);
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }

  usageKey(userId, usageDate) {
    return `${userId}|${usageDate}`;
  }

  idempotencyKey(userId, key) {
    return `${userId}|${key}`;
  }

  result(results = [], changes = 0) {
    return { success: true, results, meta: { changes } };
  }

  async execute(sql, params, mode) {
    const normalized = sql.replace(/\s+/g, " ").trim();
    const upper = normalized.toUpperCase();

    if (upper === "PRAGMA TABLE_INFO(IMAGES)") {
      const rows = [...this.imageColumns].map((name, cid) => ({ cid, name }));
      return mode === "first" ? rows[0] || null : this.result(rows);
    }

    if (upper === "PRAGMA TABLE_INFO(API_USERS)") {
      const rows = [...this.apiUserColumns].map((name, cid) => ({ cid, name }));
      return mode === "first" ? rows[0] || null : this.result(rows);
    }

    if (upper === "PRAGMA TABLE_INFO(VIP_CODES)") {
      const rows = [...this.vipColumns].map((name, cid) => ({ cid, name }));
      return mode === "first" ? rows[0] || null : this.result(rows);
    }

    if (upper.startsWith("ALTER TABLE IMAGES ADD COLUMN")) {
      const match = normalized.match(/ADD COLUMN\s+([a-z0-9_]+)/i);
      if (match) this.imageColumns.add(match[1]);
      return this.result([], 1);
    }

    if (upper.startsWith("ALTER TABLE API_USERS ADD COLUMN")) {
      const match = normalized.match(/ADD COLUMN\s+([a-z0-9_]+)/i);
      if (match) this.apiUserColumns.add(match[1]);
      return this.result([], 1);
    }

    if (upper.startsWith("ALTER TABLE VIP_CODES ADD COLUMN")) {
      const match = normalized.match(/ADD COLUMN\s+([a-z0-9_]+)/i);
      if (match) this.vipColumns.add(match[1]);
      return this.result([], 1);
    }

    if (upper.startsWith("CREATE TABLE") || upper.startsWith("CREATE INDEX")) {
      return mode === "first" ? null : this.result();
    }

    if (upper.startsWith("INSERT OR IGNORE INTO API_IDEMPOTENCY")) {
      const [userId, key, fingerprint, createdAt, updatedAt] = params;
      const mapKey = this.idempotencyKey(userId, key);
      if (this.idempotency.has(mapKey)) return this.result();
      this.idempotency.set(mapKey, {
        api_user_id: userId,
        idempotency_key: key,
        request_fingerprint: fingerprint,
        state: "processing",
        response_status: null,
        response_body: null,
        response_headers: null,
        created_at: createdAt,
        updated_at: updatedAt
      });
      return this.result([], 1);
    }

    if (upper.includes("FROM API_IDEMPOTENCY") &&
        upper.includes("WHERE API_USER_ID = ? AND IDEMPOTENCY_KEY = ?")) {
      const row = this.idempotency.get(this.idempotencyKey(params[0], params[1])) || null;
      return mode === "first"
        ? (row ? structuredClone(row) : null)
        : this.result(row ? [structuredClone(row)] : []);
    }

    if (upper.startsWith("UPDATE API_IDEMPOTENCY") && upper.includes("SET STATE = 'COMPLETED'")) {
      const [status, body, headers, updatedAt, userId, key, fingerprint] = params;
      const row = this.idempotency.get(this.idempotencyKey(userId, key));
      if (!row || row.state !== "processing" || row.request_fingerprint !== fingerprint) {
        return this.result();
      }
      row.state = "completed";
      row.response_status = status;
      row.response_body = body;
      row.response_headers = headers;
      row.updated_at = updatedAt;
      return this.result([], 1);
    }

    if (upper.startsWith("DELETE FROM API_IDEMPOTENCY") &&
        upper.includes("STATE = 'COMPLETED'")) {
      const cutoff = params[0];
      let changes = 0;
      for (const [key, row] of this.idempotency) {
        if (row.state !== "completed" || row.updated_at >= cutoff) continue;
        this.idempotency.delete(key);
        changes += 1;
      }
      return this.result([], changes);
    }

    if (upper.startsWith("DELETE FROM API_IDEMPOTENCY")) {
      const [userId, key, fingerprint] = params;
      const mapKey = this.idempotencyKey(userId, key);
      const row = this.idempotency.get(mapKey);
      if (!row ||
          row.state !== "processing" ||
          row.request_fingerprint !== fingerprint ||
          (params.length > 3 && row.updated_at !== params[3])) {
        return this.result();
      }
      this.idempotency.delete(mapKey);
      return this.result([], 1);
    }

    if (upper.startsWith("INSERT INTO API_USERS")) {
      const [
        id, code, note, email, emailVerified, emailVerifiedAt,
        keyPrefix, keyHash, planType,
        allowTemporary, temporaryDailyLimit,
        allowPermanent, permanentQuotaTotal,
        paymentStatus, priceCents, paymentNote,
        active, createdAt, updatedAt
      ] = params;
      if ([...this.apiUsers.values()].some((user) => user.code.toLowerCase() === String(code).toLowerCase())) {
        throw new Error("UNIQUE constraint failed: api_users.code");
      }
      this.apiUsers.set(id, {
        id,
        code,
        note,
        email,
        email_verified: emailVerified,
        email_verified_at: emailVerifiedAt,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        plan_type: planType,
        allow_temporary: allowTemporary,
        temporary_daily_limit: temporaryDailyLimit,
        allow_permanent: allowPermanent,
        permanent_quota_total: permanentQuotaTotal,
        permanent_quota_used: 0,
        payment_status: paymentStatus,
        price_cents: priceCents,
        payment_note: paymentNote,
        active,
        created_at: createdAt,
        updated_at: updatedAt,
        last_used_at: null
      });
      return this.result([], 1);
    }

    if (upper.startsWith("UPDATE API_USERS") && upper.includes("SET NOTE = ?")) {
      const [
        note, email, emailVerified, emailVerifiedAt, planType,
        allowTemporary, temporaryDailyLimit, allowPermanent, permanentQuotaTotal,
        paymentStatus, priceCents, paymentNote, active, updatedAt, id
      ] = params;
      const user = this.apiUsers.get(id);
      if (!user) return this.result();
      Object.assign(user, {
        note,
        email,
        email_verified: emailVerified,
        email_verified_at: emailVerifiedAt,
        plan_type: planType,
        allow_temporary: allowTemporary,
        temporary_daily_limit: temporaryDailyLimit,
        allow_permanent: allowPermanent,
        permanent_quota_total: permanentQuotaTotal,
        payment_status: paymentStatus,
        price_cents: priceCents,
        payment_note: paymentNote,
        active,
        updated_at: updatedAt
      });
      return this.result([], 1);
    }

    if (upper.startsWith("INSERT INTO VIP_CODES")) {
      const [code, note, email, emailVerified, emailVerifiedAt, createdAt, updatedAt] = params;
      const current = this.vipCodes.get(code);
      this.vipCodes.set(code, {
        code,
        note,
        email,
        email_verified: emailVerified,
        email_verified_at: emailVerifiedAt,
        active: 1,
        created_at: current?.created_at || createdAt,
        updated_at: updatedAt
      });
      return this.result([], 1);
    }

    if (upper.startsWith("UPDATE VIP_CODES") && upper.includes("SET ACTIVE = 0")) {
      const [updatedAt, code] = params;
      const vip = this.vipCodes.get(code);
      if (vip) {
        vip.active = 0;
        vip.updated_at = updatedAt;
      }
      return this.result([], vip ? 1 : 0);
    }

    if (upper.startsWith("SELECT CODE FROM VIP_CODES WHERE CODE = ?")) {
      const vip = this.vipCodes.get(params[0]);
      const row = vip ? { code: vip.code } : null;
      return mode === "first" ? row : this.result(row ? [row] : []);
    }

    if (upper.startsWith("SELECT CODE, NOTE, EMAIL") && upper.includes("FROM VIP_CODES")) {
      const rows = [...this.vipCodes.values()]
        .filter((vip) => vip.active === 1)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((vip) => structuredClone(vip));
      return mode === "first" ? rows[0] || null : this.result(rows);
    }

    if (upper.includes("FROM API_USERS WHERE ID = ? AND KEY_HASH = ?")) {
      const row = this.apiUsers.get(params[0]) || null;
      const authenticated = row?.key_hash === params[1] ? row : null;
      return mode === "first"
        ? structuredClone(authenticated)
        : this.result(authenticated ? [structuredClone(authenticated)] : []);
    }

    if (upper.includes("FROM API_USERS WHERE KEY_HASH = ?")) {
      const row = [...this.apiUsers.values()].find((user) => user.key_hash === params[0]) || null;
      return mode === "first" ? structuredClone(row) : this.result(row ? [structuredClone(row)] : []);
    }

    if (upper.includes("FROM API_USERS WHERE ID = ?")) {
      const row = this.apiUsers.get(params[0]) || null;
      return mode === "first" ? structuredClone(row) : this.result(row ? [structuredClone(row)] : []);
    }

    if (upper.startsWith("SELECT U.*") && upper.includes("FROM API_USERS U")) {
      const usageDate = params[0];
      const rows = [...this.apiUsers.values()].map((user) => {
        const usage = this.dailyUsage.get(this.usageKey(user.id, usageDate));
        return {
          ...structuredClone(user),
          temporary_used_today: usage?.temporary_count || 0,
          permanent_uploaded_today: usage?.permanent_count || 0
        };
      });
      return mode === "all" ? this.result(rows) : rows[0] || null;
    }

    if (upper.startsWith("INSERT INTO API_DAILY_USAGE")) {
      const [userId, usageDate, updatedAt] = params;
      const key = this.usageKey(userId, usageDate);
      if (!this.dailyUsage.has(key)) {
        this.dailyUsage.set(key, {
          api_user_id: userId,
          usage_date: usageDate,
          temporary_count: 0,
          permanent_count: 0,
          updated_at: updatedAt
        });
        return this.result([], 1);
      }
      return this.result();
    }

    if (upper.includes("SET TEMPORARY_COUNT = TEMPORARY_COUNT + ?")) {
      const [count, updatedAt, userId, usageDate, attempted, limit] = params;
      const usage = this.dailyUsage.get(this.usageKey(userId, usageDate));
      if (!usage || usage.temporary_count + attempted > limit) return this.result();
      usage.temporary_count += count;
      usage.updated_at = updatedAt;
      return this.result([{
        temporary_count: usage.temporary_count,
        permanent_count: usage.permanent_count
      }], 1);
    }

    if (upper.includes("SET TEMPORARY_COUNT = MAX(0, TEMPORARY_COUNT - ?)")) {
      const [count, updatedAt, userId, usageDate] = params;
      const usage = this.dailyUsage.get(this.usageKey(userId, usageDate));
      if (usage) {
        usage.temporary_count = Math.max(0, usage.temporary_count - count);
        usage.updated_at = updatedAt;
      }
      return this.result([], usage ? 1 : 0);
    }

    if (upper.includes("SET PERMANENT_COUNT = PERMANENT_COUNT + ?")) {
      const [count, updatedAt, userId, usageDate] = params;
      const usage = this.dailyUsage.get(this.usageKey(userId, usageDate));
      if (usage) {
        usage.permanent_count += count;
        usage.updated_at = updatedAt;
      }
      return this.result([], usage ? 1 : 0);
    }

    if (upper.includes("SELECT TEMPORARY_COUNT, PERMANENT_COUNT") && upper.includes("FROM API_DAILY_USAGE")) {
      const usage = this.dailyUsage.get(this.usageKey(params[0], params[1])) || null;
      const row = usage ? {
        temporary_count: usage.temporary_count,
        permanent_count: usage.permanent_count
      } : null;
      return mode === "first" ? row : this.result(row ? [row] : []);
    }

    if (upper.includes("SET PERMANENT_QUOTA_USED = PERMANENT_QUOTA_USED + ?")) {
      const [count, updatedAt, userId, attempted] = params;
      const user = this.apiUsers.get(userId);
      if (!user || !user.active || user.permanent_quota_used + attempted > user.permanent_quota_total) {
        return mode === "first" ? null : this.result();
      }
      user.permanent_quota_used += count;
      user.updated_at = updatedAt;
      const row = {
        permanent_quota_used: user.permanent_quota_used,
        permanent_quota_total: user.permanent_quota_total
      };
      return mode === "first" ? row : this.result([row], 1);
    }

    if (upper.includes("SET PERMANENT_QUOTA_USED = MAX(0, PERMANENT_QUOTA_USED - ?)")) {
      const [count, updatedAt, userId] = params;
      const user = this.apiUsers.get(userId);
      if (user) {
        user.permanent_quota_used = Math.max(0, user.permanent_quota_used - count);
        user.updated_at = updatedAt;
      }
      return this.result([], user ? 1 : 0);
    }

    if (upper.includes("SELECT PERMANENT_QUOTA_USED, PERMANENT_QUOTA_TOTAL") && upper.includes("FROM API_USERS")) {
      const user = this.apiUsers.get(params[0]);
      const row = user ? {
        permanent_quota_used: user.permanent_quota_used,
        permanent_quota_total: user.permanent_quota_total
      } : null;
      return mode === "first" ? row : this.result(row ? [row] : []);
    }

    if (upper.includes("SET LAST_USED_AT = ?")) {
      const [lastUsedAt, updatedAt, userId] = params;
      const user = this.apiUsers.get(userId);
      if (user) {
        user.last_used_at = lastUsedAt;
        user.updated_at = updatedAt;
      }
      return this.result([], user ? 1 : 0);
    }

    if (upper.startsWith("DELETE FROM API_DAILY_USAGE")) {
      return this.result([], this.dailyUsage.delete(this.usageKey(params[0], params[1])) ? 1 : 0);
    }

    if (upper.includes("FROM HIGH_RISK_USERS")) {
      return mode === "first" ? null : this.result();
    }

    if (upper.startsWith("SELECT R2_KEY, FOLDER, DURATION") && upper.includes("FROM IMAGES")) {
      return mode === "first" ? null : this.result();
    }

    if (upper.startsWith("DELETE FROM UPLOAD_EVENTS") &&
        upper.includes("R2_KEY IN (SELECT R2_KEY FROM IMAGES WHERE STATUS = 'DELETED')")) {
      const deletedKeys = new Set(
        [...this.images.values()].filter((row) => row.status === "deleted").map((row) => row.r2_key)
      );
      const before = this.uploadEvents.length;
      this.uploadEvents = this.uploadEvents.filter((event) => !deletedKeys.has(event.r2_key));
      return this.result([], before - this.uploadEvents.length);
    }

    if (upper === "DELETE FROM IMAGES WHERE STATUS = 'DELETED'") {
      let changes = 0;
      for (const [key, row] of this.images) {
        if (row.status !== "deleted") continue;
        this.images.delete(key);
        changes += 1;
      }
      return this.result([], changes);
    }

    if (upper.startsWith("DELETE FROM UPLOAD_EVENTS") && upper.includes("CREATED_AT < DATETIME('NOW', ?)")) {
      const days = Number(String(params[0] || "").match(/-(\d+)\s+days/i)?.[1] || 90);
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const before = this.uploadEvents.length;
      this.uploadEvents = this.uploadEvents.filter((event) => new Date(event.created_at).getTime() >= cutoff);
      return this.result([], before - this.uploadEvents.length);
    }

    if (upper === "VACUUM") {
      this.vacuumRuns += 1;
      return this.result();
    }

    const filteredImages = () => [...this.images.values()].filter((row) => {
      if (upper.includes("I.STATUS IN ('PENDING', 'SUSPICIOUS')") &&
          !["pending", "suspicious"].includes(row.status)) return false;
      if (upper.includes("I.STATUS = 'AUDITED'") && row.status !== "audited") return false;
      if (upper.includes("I.UPLOAD_SOURCE = 'API'") && row.upload_source !== "api") return false;
      if (upper.includes("COALESCE(I.UPLOAD_SOURCE, 'WEB') != 'API'") && row.upload_source === "api") return false;
      return row.status !== "deleted";
    });

    if (upper.startsWith("SELECT COUNT(*) AS COUNT FROM IMAGES I")) {
      const row = { count: filteredImages().length };
      return mode === "first" ? row : this.result([row]);
    }

    if (upper.startsWith("SELECT I.*") && upper.includes("FROM IMAGES I")) {
      const rows = filteredImages().map((row) => ({
        ...structuredClone(row),
        ip_blocked: 0,
        high_risk_user: 0
      }));
      return mode === "first" ? rows[0] || null : this.result(rows);
    }

    if (upper.startsWith("SELECT ID, R2_KEY, PUBLIC_URL, SIZE, MIME, UPLOADED_AT") &&
        upper.includes("FROM IMAGES")) {
      const userId = params[0];
      const hasCursor = upper.includes("UPLOADED_AT < ?");
      const cursorUploadedAt = hasCursor ? params[1] : null;
      const cursorId = hasCursor ? params[3] : null;
      const limit = Number(params[params.length - 1]);
      const rows = [...this.images.values()]
        .filter((row) => row.api_user_id === userId &&
          row.upload_source === "api" &&
          row.status !== "deleted")
        .filter((row) => !hasCursor ||
          row.uploaded_at < cursorUploadedAt ||
          (row.uploaded_at === cursorUploadedAt && row.id < cursorId))
        .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at) || b.id.localeCompare(a.id))
        .slice(0, limit)
        .map((row) => ({
          id: row.id,
          r2_key: row.r2_key,
          public_url: row.public_url,
          size: row.size,
          mime: row.mime,
          uploaded_at: row.uploaded_at
        }));
      return mode === "first" ? rows[0] || null : this.result(rows);
    }

    if (upper.startsWith("SELECT R2_KEY, PUBLIC_URL") &&
        upper.includes("API_USER_ID = ?") &&
        upper.includes("UPLOAD_SOURCE = 'API'")) {
      const [r2Key, userId] = params;
      const row = this.images.get(r2Key);
      const found = row &&
        row.api_user_id === userId &&
        row.upload_source === "api" &&
        row.status !== "deleted"
        ? { r2_key: row.r2_key, public_url: row.public_url }
        : null;
      return mode === "first" ? found : this.result(found ? [found] : []);
    }

    if (upper.startsWith("INSERT INTO IMAGES")) {
      const row = {
        id: params[0],
        r2_key: params[1],
        public_url: params[2],
        folder: params[3],
        status: params[4],
        risk: params[5],
        risk_reasons: params[6],
        size: params[7],
        mime: params[8],
        file_hash: params[9],
        ip: params[10],
        ip_hash: params[11],
        country: params[12],
        region: params[13],
        region_code: params[14],
        city: params[15],
        timezone: params[16],
        colo: params[17],
        user_agent: params[18],
        origin: params[19],
        referer: params[20],
        vip_id: params[21],
        duration: params[22],
        is_vip: params[23],
        is_personal: params[24],
        uploaded_at: params[25],
        audited_at: params[26],
        deleted_at: params[27],
        expires_at: params[28],
        created_at: params[29],
        updated_at: params[30],
        upload_source: "web",
        api_user_id: null
      };
      this.images.set(row.r2_key, row);
      return this.result([], 1);
    }

    if (upper.includes("SET UPLOAD_SOURCE = 'API'")) {
      const [apiUserId, updatedAt, r2Key] = params;
      const row = this.images.get(r2Key);
      if (row) {
        row.upload_source = "api";
        row.api_user_id = apiUserId;
        row.updated_at = updatedAt;
      }
      return this.result([], row ? 1 : 0);
    }

    if (upper.startsWith("UPDATE IMAGES") && upper.includes("SET STATUS = 'DELETED'")) {
      const [deletedAt, updatedAt, r2Key] = params;
      const row = this.images.get(r2Key);
      if (row) {
        row.status = "deleted";
        row.deleted_at = deletedAt;
        row.updated_at = updatedAt;
      }
      return this.result([], row ? 1 : 0);
    }

    if (upper.startsWith("UPDATE IMAGES") || upper.startsWith("INSERT INTO UPLOAD_EVENTS")) {
      return this.result([], 1);
    }

    throw new Error(`Unsupported fake D1 query: ${normalized}`);
  }
}

class FakeR2 {
  constructor() {
    this.objects = new Map();
  }

  async put(key, body, options = {}) {
    this.objects.set(key, { body, options, uploaded: new Date() });
  }

  async get(key) {
    const value = this.objects.get(key);
    if (!value) return null;
    return {
      uploaded: value.uploaded,
      customMetadata: value.options.customMetadata || {},
      text: async () => typeof value.body === "string" ? value.body : new TextDecoder().decode(value.body),
      arrayBuffer: async () => value.body
    };
  }

  async delete(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.objects.delete(key);
  }

  async list() {
    return { objects: [], truncated: false };
  }
}

function createEnv() {
  return {
    ADMIN_PASSWORD: "admin-secret",
    DB: new FakeD1(),
    R2_BUCKET: new FakeR2()
  };
}

async function callWorker(env, path, options = {}) {
  return worker.fetch(new Request(`https://api.mini-tools.uk${path}`, options), env, {
    waitUntil() {}
  });
}

async function createApiUser(env, body) {
  const response = await callWorker(env, "/?action=api_user_create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": "admin-secret"
    },
    body: JSON.stringify({
      email: "verified@example.com",
      email_verified: true,
      ...body
    })
  });
  const data = await response.json();
  assert.equal(response.status, 201, JSON.stringify(data));
  assert.match(data.api_key, /^mtu_live_/);
  return data;
}

function imageFile(name = "image.png") {
  const bytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
  ]);
  return new File([bytes], name, { type: "image/png" });
}

function invalidImageFile(name = "invalid.png") {
  return new File([new Uint8Array([0x00, 0x01, 0x02, 0x03])], name, { type: "image/png" });
}

async function createSolvedCaptcha(env) {
  const response = await callWorker(env, "/?action=captcha", {
    headers: {
      Origin: "https://mini-tools.uk",
      "User-Agent": "Mozilla/5.0 test browser"
    }
  });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  const match = String(data.question || "").match(/(\d+)\s*([+-])\s*(\d+)/);
  assert.ok(match, `Unexpected captcha question: ${data.question}`);
  const left = Number(match[1]);
  const right = Number(match[3]);
  return {
    id: data.captcha_id,
    answer: match[2] === "+" ? left + right : left - right
  };
}

function webUploadRequest(file, duration, vipId, captcha) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("duration", duration);
  formData.set("vip_id", vipId);
  formData.set("captcha_id", captcha.id);
  formData.set("captcha_answer", String(captcha.answer));
  return {
    method: "POST",
    headers: {
      Origin: "https://mini-tools.uk",
      "User-Agent": "Mozilla/5.0 test browser"
    },
    body: formData
  };
}

function uploadRequest(apiKey, userId, duration, files, extraHeaders = {}) {
  const formData = new FormData();
  formData.set("duration", duration);
  for (const file of files) formData.append("file", file);
  return {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-API-User-ID": userId,
      ...extraHeaders
    },
    body: formData
  };
}

test("API user keys are returned once and omitted from admin lists", async () => {
  const env = createEnv();
  const created = await createApiUser(env, {
    code: "temp_user",
    plan_type: "custom",
    allow_temporary: true,
    temporary_daily_limit: 1,
    allow_permanent: false,
    permanent_quota_total: 0,
    payment_status: "paid",
    price_cents: 1000
  });

  const response = await callWorker(env, "/?action=api_user_list", {
    headers: { "X-Admin-Key": "admin-secret" }
  });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.users.length, 1);
  assert.equal(data.users[0].key_prefix, created.user.key_prefix);
  assert.equal("api_key" in data.users[0], false);
  assert.equal("key_hash" in data.users[0], false);
  assert.doesNotMatch(JSON.stringify(data), new RegExp(created.api_key));
});

test("unverified API email blocks access and verified email stays private", async () => {
  const env = createEnv();
  const created = await createApiUser(env, {
    code: "email_gate",
    email: "Applicant@Example.com",
    email_verified: false,
    plan_type: "temporary_100",
    allow_temporary: true,
    temporary_daily_limit: 100,
    allow_permanent: false
  });

  const headers = {
    Authorization: `Bearer ${created.api_key}`,
    "X-API-User-ID": created.user.id
  };
  const blocked = await callWorker(env, "/v1/usage", { headers });
  const blockedData = await blocked.json();
  assert.equal(blocked.status, 403);
  assert.equal(blockedData.code, "EMAIL_VERIFICATION_REQUIRED");

  const update = await callWorker(env, "/?action=api_user_update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": "admin-secret"
    },
    body: JSON.stringify({
      id: created.user.id,
      email: "applicant@example.com",
      email_verified: true,
      plan_type: "temporary_100",
      allow_temporary: true,
      temporary_daily_limit: 100,
      allow_permanent: false,
      payment_status: "unpaid",
      active: true
    })
  });
  assert.equal(update.status, 200, await update.text());

  const allowed = await callWorker(env, "/v1/usage", { headers });
  const allowedData = await allowed.json();
  assert.equal(allowed.status, 200, JSON.stringify(allowedData));
  assert.equal(JSON.stringify(allowedData).includes("applicant@example.com"), false);
  assert.equal("email" in allowedData.usage, false);
});

test("permanent web uploads require an administrator-verified email", async () => {
  const env = createEnv();
  const add = await callWorker(env, "/?action=vip_add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": "admin-secret"
    },
    body: JSON.stringify({
      code: "permanent_email_gate",
      email: "owner@example.com",
      email_verified: false,
      note: "manual email review"
    })
  });
  assert.equal(add.status, 200, await add.text());

  const firstCaptcha = await createSolvedCaptcha(env);
  const blocked = await callWorker(
    env,
    "/",
    webUploadRequest(imageFile("blocked.png"), "permanent", "permanent_email_gate", firstCaptcha)
  );
  const blockedData = await blocked.json();
  assert.equal(blocked.status, 403, JSON.stringify(blockedData));
  assert.equal(blockedData.code, "EMAIL_VERIFICATION_REQUIRED");

  const verify = await callWorker(env, "/?action=vip_update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": "admin-secret"
    },
    body: JSON.stringify({
      code: "permanent_email_gate",
      email: "owner@example.com",
      email_verified: true,
      note: "manual email review"
    })
  });
  assert.equal(verify.status, 200, await verify.text());

  const secondCaptcha = await createSolvedCaptcha(env);
  const uploaded = await callWorker(
    env,
    "/",
    webUploadRequest(imageFile("allowed.png"), "permanent", "permanent_email_gate", secondCaptcha)
  );
  const uploadedData = await uploaded.json();
  assert.equal(uploaded.status, 200, JSON.stringify(uploadedData));
  const [image] = [...env.DB.images.values()];
  assert.equal(image.status, "pending");
  assert.equal(image.upload_source, "web");
  assert.equal(image.vip_id, "permanent_email_gate");
});

test("normal web uploads enter the manual review queue without an email account", async () => {
  const env = createEnv();
  const captcha = await createSolvedCaptcha(env);
  const response = await callWorker(
    env,
    "/",
    webUploadRequest(imageFile("normal.png"), "1-day", "", captcha)
  );
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  const [image] = [...env.DB.images.values()];
  assert.equal(image.status, "pending");
  assert.equal(image.upload_source, "web");
  assert.equal(image.duration, "1-day");
  assert.equal(image.vip_id, null);
});

test("legacy VIP configuration migrates from R2 to private D1 storage", async () => {
  const env = createEnv();
  await env.R2_BUCKET.put("_config/vip_codes.json", JSON.stringify([{
    code: "legacy_vip",
    note: "legacy record",
    created_at: "2026-01-01T00:00:00.000Z"
  }]));

  const response = await callWorker(env, "/?action=vip_list", {
    headers: { "X-Admin-Key": "admin-secret" }
  });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  assert.equal(data.vips[0].code, "legacy_vip");
  assert.equal(data.vips[0].email_verified, false);
  assert.equal(env.R2_BUCKET.objects.has("_config/vip_codes.json"), false);
  assert.equal(env.DB.vipCodes.get("legacy_vip").active, 1);
});

test("legacy VIP migration preserves newer D1 email verification records", async () => {
  const env = createEnv();
  env.DB.vipCodes.set("existing_vip", {
    code: "existing_vip",
    note: "verified in admin",
    email: "owner@example.com",
    email_verified: 1,
    email_verified_at: "2026-08-01T00:00:00.000Z",
    active: 1,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z"
  });
  await env.R2_BUCKET.put("_config/vip_codes.json", JSON.stringify([{
    code: "existing_vip",
    note: "stale legacy record",
    created_at: "2026-01-01T00:00:00.000Z"
  }]));

  const response = await callWorker(env, "/?action=vip_list", {
    headers: { "X-Admin-Key": "admin-secret" }
  });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  assert.equal(data.vips[0].email, "owner@example.com");
  assert.equal(data.vips[0].email_verified, true);
  assert.equal(data.vips[0].note, "verified in admin");
  assert.equal(env.R2_BUCKET.objects.has("_config/vip_codes.json"), false);
});

test("public API requires the assigned user ID together with the API key", async () => {
  const env = createEnv();
  const created = await createApiUser(env, {
    code: "paired_credentials",
    plan_type: "custom",
    allow_temporary: true,
    temporary_daily_limit: 5,
    allow_permanent: false,
    payment_status: "paid",
    price_cents: 1000,
    payment_note: "internal only"
  });

  const missingUser = await callWorker(env, "/v1/usage", {
    headers: { Authorization: `Bearer ${created.api_key}` }
  });
  assert.equal(missingUser.status, 401);
  assert.equal((await missingUser.json()).code, "MISSING_API_USER_ID");

  const wrongUser = await callWorker(env, "/v1/usage", {
    headers: {
      Authorization: `Bearer ${created.api_key}`,
      "X-API-User-ID": crypto.randomUUID()
    }
  });
  assert.equal(wrongUser.status, 401);
  assert.equal((await wrongUser.json()).code, "INVALID_API_CREDENTIALS");

  const usage = await callWorker(env, "/v1/usage", {
    headers: {
      Authorization: `Bearer ${created.api_key}`,
      "X-API-User-ID": created.user.id
    }
  });
  const usageData = await usage.json();
  assert.equal(usage.status, 200, JSON.stringify(usageData));
  assert.equal(usageData.usage.user_id, created.user.id);
  assert.equal(usageData.usage.temporary.used, 0);
  assert.equal(usageData.usage.temporary.remaining, 5);
  assert.equal("payment_status" in usageData.usage, false);
  assert.doesNotMatch(JSON.stringify(usageData), /internal only|price_cents/);
});

test("temporary API uploads enforce the Shanghai daily quota", async () => {
  const env = createEnv();
  const created = await createApiUser(env, {
    code: "daily_one",
    plan_type: "custom",
    allow_temporary: true,
    temporary_daily_limit: 1,
    allow_permanent: false,
    payment_status: "unpaid",
    price_cents: 1000
  });

  const first = await callWorker(
    env,
    "/v1/upload",
    uploadRequest(created.api_key, created.user.id, "1-day", [imageFile()])
  );
  const firstData = await first.json();
  assert.equal(first.status, 201, JSON.stringify(firstData));
  assert.equal(firstData.uploaded.length, 1);
  assert.equal(firstData.account.temporary_used_today, 1);
  assert.equal(first.headers.get("x-ratelimit-remaining"), "0");
  const [imageRecord] = [...env.DB.images.values()];
  assert.equal(imageRecord.upload_source, "api");
  assert.equal(imageRecord.api_user_id, created.user.id);
  assert.equal(env.DB.imageColumns.has("upload_source"), true);
  assert.equal(env.DB.imageColumns.has("api_user_id"), true);

  const second = await callWorker(
    env,
    "/v1/upload",
    uploadRequest(created.api_key, created.user.id, "1-day", [imageFile("two.png")])
  );
  const secondData = await second.json();
  assert.equal(second.status, 429);
  assert.equal(secondData.code, "DAILY_QUOTA_EXHAUSTED");
  assert.equal(secondData.used_today, 1);
  assert.equal(secondData.remaining_today, 0);

  const account = await callWorker(env, "/v1/account", {
    headers: {
      "X-Upload-Token": created.api_key,
      "X-API-User-ID": created.user.id
    }
  });
  const accountData = await account.json();
  assert.equal(account.status, 200);
  assert.equal(accountData.account.temporary_used_today, 1);
  assert.equal(accountData.account.timezone, "Asia/Shanghai");
});

test("permanent API uploads use a total quota without a daily limit", async () => {
  const env = createEnv();
  const created = await createApiUser(env, {
    code: "permanent_two",
    plan_type: "custom",
    allow_temporary: false,
    temporary_daily_limit: 0,
    allow_permanent: true,
    permanent_quota_total: 2,
    payment_status: "paid",
    price_cents: 1000
  });

  const first = await callWorker(
    env,
    "/v1/upload",
    uploadRequest(
      created.api_key,
      created.user.id,
      "permanent",
      [imageFile("one.png"), imageFile("two.png")]
    )
  );
  const firstData = await first.json();
  assert.equal(first.status, 201, JSON.stringify(firstData));
  assert.equal(firstData.uploaded.length, 2);
  assert.equal(firstData.account.permanent_quota_used, 2);
  assert.equal(firstData.account.permanent_quota_remaining, 0);

  const second = await callWorker(
    env,
    "/v1/upload",
    uploadRequest(created.api_key, created.user.id, "permanent", [imageFile("three.png")])
  );
  const secondData = await second.json();
  assert.equal(second.status, 429);
  assert.equal(secondData.code, "PERMANENT_QUOTA_EXHAUSTED");
  assert.equal(secondData.quota_used, 2);
  assert.equal(secondData.quota_remaining, 0);
});

test("failed image validation refunds the reserved API quota", async () => {
  const env = createEnv();
  const created = await createApiUser(env, {
    code: "refund_invalid",
    plan_type: "custom",
    allow_temporary: true,
    temporary_daily_limit: 1,
    allow_permanent: false,
    payment_status: "paid",
    price_cents: 1000
  });

  const invalid = await callWorker(
    env,
    "/v1/upload",
    uploadRequest(created.api_key, created.user.id, "1-day", [invalidImageFile()])
  );
  const invalidData = await invalid.json();
  assert.equal(invalid.status, 422);
  assert.equal(invalidData.failed[0].code, "INVALID_IMAGE_CONTENT");
  assert.equal(invalidData.account.temporary_used_today, 0);

  const valid = await callWorker(
    env,
    "/v1/upload",
    uploadRequest(created.api_key, created.user.id, "1-day", [imageFile("after-refund.png")])
  );
  const validData = await valid.json();
  assert.equal(valid.status, 201, JSON.stringify(validData));
  assert.equal(validData.account.temporary_used_today, 1);
});

test("API users can list and delete only their own uploaded images", async () => {
  const env = createEnv();
  const owner = await createApiUser(env, {
    code: "image_owner",
    plan_type: "custom",
    allow_temporary: true,
    temporary_daily_limit: 5,
    allow_permanent: false,
    payment_status: "paid"
  });
  const other = await createApiUser(env, {
    code: "other_owner",
    plan_type: "custom",
    allow_temporary: true,
    temporary_daily_limit: 5,
    allow_permanent: false,
    payment_status: "paid"
  });

  const upload = await callWorker(
    env,
    "/v1/upload",
    uploadRequest(
      owner.api_key,
      owner.user.id,
      "7-day",
      [imageFile("first.png"), imageFile("second.png")]
    )
  );
  const uploadData = await upload.json();
  assert.equal(upload.status, 201, JSON.stringify(uploadData));

  const otherUpload = await callWorker(
    env,
    "/v1/upload",
    uploadRequest(other.api_key, other.user.id, "7-day", [imageFile("other.png")])
  );
  assert.equal(otherUpload.status, 201);

  const authHeaders = {
    Authorization: `Bearer ${owner.api_key}`,
    "X-API-User-ID": owner.user.id
  };
  const firstPage = await callWorker(env, "/v1/images?limit=1", { headers: authHeaders });
  const firstPageData = await firstPage.json();
  assert.equal(firstPage.status, 200, JSON.stringify(firstPageData));
  assert.equal(firstPageData.records.length, 1);
  assert.ok(firstPageData.next_cursor);
  assert.deepEqual(
    Object.keys(firstPageData.records[0]).sort(),
    ["key", "mime", "size", "uploaded_at", "url"]
  );
  assert.match(firstPageData.records[0].url, /^https:\/\/pub\.mini-tools\.uk\//);
  assert.equal("expires_at" in firstPageData.records[0], false);
  assert.equal("status" in firstPageData.records[0], false);
  assert.equal("duration" in firstPageData.records[0], false);

  const secondPage = await callWorker(
    env,
    `/v1/images?limit=1&cursor=${encodeURIComponent(firstPageData.next_cursor)}`,
    { headers: authHeaders }
  );
  const secondPageData = await secondPage.json();
  assert.equal(secondPage.status, 200, JSON.stringify(secondPageData));
  assert.equal(secondPageData.records.length, 1);
  assert.equal(secondPageData.next_cursor, null);
  assert.deepEqual(
    new Set([...firstPageData.records, ...secondPageData.records].map((item) => item.key)),
    new Set(uploadData.uploaded.map((item) => item.key))
  );

  const keyToDelete = uploadData.uploaded[0].key;
  const deniedDelete = await callWorker(
    env,
    `/v1/images/${encodeURIComponent(keyToDelete)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${other.api_key}`,
        "X-API-User-ID": other.user.id
      }
    }
  );
  assert.equal(deniedDelete.status, 404);
  assert.equal(env.R2_BUCKET.objects.has(keyToDelete), true);

  const ownerDelete = await callWorker(
    env,
    `/v1/images/${encodeURIComponent(keyToDelete)}`,
    { method: "DELETE", headers: authHeaders }
  );
  const deleteData = await ownerDelete.json();
  assert.equal(ownerDelete.status, 200, JSON.stringify(deleteData));
  assert.equal(deleteData.deleted.key, keyToDelete);
  assert.equal(env.R2_BUCKET.objects.has(keyToDelete), false);
  assert.equal(env.DB.images.get(keyToDelete).status, "deleted");

  const usage = await callWorker(env, "/v1/usage", { headers: authHeaders });
  assert.equal((await usage.json()).usage.temporary.used, 2);
});

test("Idempotency-Key replays an upload without consuming quota twice", async () => {
  const env = createEnv();
  const created = await createApiUser(env, {
    code: "idempotent_upload",
    plan_type: "custom",
    allow_temporary: true,
    temporary_daily_limit: 1,
    allow_permanent: false,
    payment_status: "paid"
  });
  const idempotencyHeaders = { "Idempotency-Key": "upload-request-001" };

  const first = await callWorker(
    env,
    "/v1/upload",
    uploadRequest(
      created.api_key,
      created.user.id,
      "1-day",
      [imageFile("same.png")],
      idempotencyHeaders
    )
  );
  const firstData = await first.json();
  assert.equal(first.status, 201, JSON.stringify(firstData));
  assert.equal(first.headers.get("x-idempotent-replayed"), "false");

  const replay = await callWorker(
    env,
    "/v1/upload",
    uploadRequest(
      created.api_key,
      created.user.id,
      "1-day",
      [imageFile("same.png")],
      idempotencyHeaders
    )
  );
  const replayData = await replay.json();
  assert.equal(replay.status, 201, JSON.stringify(replayData));
  assert.equal(replay.headers.get("x-idempotent-replayed"), "true");
  assert.equal(replayData.uploaded[0].url, firstData.uploaded[0].url);
  assert.equal(env.DB.images.size, 1);
  assert.equal(replayData.usage.temporary.used, 1);

  const reused = await callWorker(
    env,
    "/v1/upload",
    uploadRequest(
      created.api_key,
      created.user.id,
      "1-day",
      [imageFile("different.png")],
      idempotencyHeaders
    )
  );
  const reusedData = await reused.json();
  assert.equal(reused.status, 409);
  assert.equal(reusedData.code, "IDEMPOTENCY_KEY_REUSED");
  assert.equal(env.DB.images.size, 1);
});

test("admin review queues keep API and web pending images separate", async () => {
  const env = createEnv();
  const created = await createApiUser(env, {
    code: "review_user",
    plan_type: "custom",
    allow_temporary: true,
    temporary_daily_limit: 5,
    allow_permanent: false,
    payment_status: "paid",
    price_cents: 1000
  });

  const upload = await callWorker(
    env,
    "/v1/upload",
    uploadRequest(created.api_key, created.user.id, "1-day", [imageFile("api-review.png")])
  );
  assert.equal(upload.status, 201);

  const [apiImage] = [...env.DB.images.values()];
  env.DB.images.set("1-day/web-upload.png", {
    ...structuredClone(apiImage),
    id: "web-image",
    r2_key: "1-day/web-upload.png",
    public_url: "https://pub.mini-tools.uk/1-day/web-upload.png",
    upload_source: "web",
    api_user_id: null,
    vip_id: null
  });

  const headers = { "X-Admin-Key": "admin-secret" };
  const apiQueue = await callWorker(
    env,
    "/?action=list&status_group=api_review&include_summary=0",
    { headers }
  );
  const apiData = await apiQueue.json();
  assert.equal(apiQueue.status, 200, JSON.stringify(apiData));
  assert.deepEqual(apiData.items.map((item) => item.key), [apiImage.r2_key]);
  assert.equal(apiData.items[0].uploadSource, "api");
  assert.equal(apiData.items[0].apiUserId, created.user.id);

  const webQueue = await callWorker(
    env,
    "/?action=list&status_group=pending&include_summary=0",
    { headers }
  );
  const webData = await webQueue.json();
  assert.equal(webQueue.status, 200, JSON.stringify(webData));
  assert.deepEqual(webData.items.map((item) => item.key), ["1-day/web-upload.png"]);
});

test("D1 history cleanup is admin-only and purges deleted rows and old events", async () => {
  const env = createEnv();
  const now = Date.now();
  env.DB.images.set("deleted.png", {
    r2_key: "deleted.png",
    status: "deleted"
  });
  env.DB.images.set("audited.png", {
    r2_key: "audited.png",
    status: "audited"
  });
  env.DB.uploadEvents = [
    { r2_key: "deleted.png", created_at: new Date(now - 2 * 86400000).toISOString() },
    { r2_key: "audited.png", created_at: new Date(now - 120 * 86400000).toISOString() },
    { r2_key: "audited.png", created_at: new Date(now - 2 * 86400000).toISOString() }
  ];

  const unauthorized = await callWorker(env, "/?action=cleanup_d1_history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_retention_days: 90, purge_deleted_images: true })
  });
  assert.equal(unauthorized.status, 401);

  const response = await callWorker(env, "/?action=cleanup_d1_history", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": "admin-secret"
    },
    body: JSON.stringify({ event_retention_days: 90, purge_deleted_images: true })
  });
  const data = await response.json();

  assert.equal(response.status, 200, JSON.stringify(data));
  assert.equal(data.images_deleted, 1);
  assert.equal(data.events_for_deleted_images, 1);
  assert.equal(data.events_deleted, 1);
  assert.equal(data.event_retention_days, 90);
  assert.equal(data.vacuumed, true);
  assert.equal(env.DB.images.has("deleted.png"), false);
  assert.equal(env.DB.images.has("audited.png"), true);
  assert.equal(env.DB.uploadEvents.length, 1);
});

test("scheduled maintenance runs D1 history cleanup after expired-image cleanup", async () => {
  const env = createEnv();
  let scheduledPromise;
  worker.scheduled({}, env, {
    waitUntil(promise) {
      scheduledPromise = promise;
    }
  });

  assert.ok(scheduledPromise);
  await scheduledPromise;
  assert.equal(env.DB.vacuumRuns, 1);
});
