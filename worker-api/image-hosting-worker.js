const DEFAULT_ALLOWED_ORIGINS = [
  "https://mini-tools.uk",
  "https://www.mini-tools.uk",
  "http://localhost:8787",
  "http://localhost:3000"
];

const VIP_CONFIG_FILE = "_config/vip_codes.json";

// 算术验证码配置
const CAPTCHA_PREFIX = "_captcha/";
const CAPTCHA_EXPIRE_MS = 5 * 60 * 1000; // 5分钟

// 安全与风控配置
const SECURITY_PREFIX = "_security/";
const BLOCKED_IP_PREFIX = `${SECURITY_PREFIX}blocked_ips/`;
const HIGH_RISK_USER_PREFIX = `${SECURITY_PREFIX}high_risk_users/`;
const RATE_PREFIX = `${SECURITY_PREFIX}rate/`;
const RECENT_PREFIX = `${SECURITY_PREFIX}recent/`;
const UPLOAD_LOG_PREFIX = `${SECURITY_PREFIX}upload_logs/`;
const UPLOAD_INDEX_PREFIX = `${SECURITY_PREFIX}upload_index/`;
const SUSPICIOUS_PREFIX = "_suspicious/";

const PUBLIC_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ADMIN_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB，后台 personal 上传上限
const API_MAX_FILES_PER_REQUEST = 10;
const API_MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 控制 multipart 解析时的内存占用
const API_TIME_ZONE = "Asia/Shanghai";
const API_KEY_PREFIX = "mtu_live_";
const API_IDEMPOTENCY_MAX_LENGTH = 128;
const API_IDEMPOTENCY_RETENTION_DAYS = 7;
const API_IDEMPOTENCY_PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;
const API_IMAGE_LIST_DEFAULT_LIMIT = 20;
const API_IMAGE_LIST_MAX_LIMIT = 100;
const MAX_FILENAME_LENGTH = 180;
const MAX_USER_AGENT_LENGTH = 240;
const MAX_HEADER_VALUE_LENGTH = 300;

const API_PLAN_PRESETS = {
  temporary_100: {
    label: "限时图片 100 张/天",
    allowTemporary: true,
    temporaryDailyLimit: 100,
    allowPermanent: false,
    permanentQuotaTotal: 0,
    priceCents: 1000
  },
  temporary_200: {
    label: "限时图片 200 张/天",
    allowTemporary: true,
    temporaryDailyLimit: 200,
    allowPermanent: false,
    permanentQuotaTotal: 0,
    priceCents: 2000
  },
  permanent_100: {
    label: "永久图片 100 张",
    allowTemporary: false,
    temporaryDailyLimit: 0,
    allowPermanent: true,
    permanentQuotaTotal: 100,
    priceCents: 1000
  }
};

const API_PAYMENT_STATUSES = new Set(["unpaid", "paid", "refunded", "complimentary"]);
const API_TEMPORARY_DURATIONS = new Set(["1-day", "7-day", "30-day"]);

const RATE_RULES = [
  { name: "1m", windowMs: 60 * 1000, limit: 10 },
  { name: "10m", windowMs: 10 * 60 * 1000, limit: 30 },
  { name: "1d", windowMs: 24 * 60 * 60 * 1000, limit: 80 }
];

const PROGRAMMATIC_UA_RE = /(curl|python|node-fetch|axios|bot|spider|crawler|wget|java|okhttp|go-http-client|httpclient|scrapy|aiohttp|libwww|powershell)/i;

const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp"
};

function getAllowedOrigins(env) {
  const fromEnv = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv]);
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins(env);
  const allowOrigin = origin && allowedOrigins.has(origin) ? origin : "https://mini-tools.uk";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key, X-Admin-Key, X-Upload-Token, X-API-User-ID",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function jsonResponse(request, env, data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...getCorsHeaders(request, env),
      ...extraHeaders
    }
  });
}

function textResponse(request, env, text, status = 200, extraHeaders = {}) {
  return new Response(text, {
    status,
    headers: {
      ...getCorsHeaders(request, env),
      ...extraHeaders
    }
  });
}

function isAdminRequest(request, env) {
  const password = env.ADMIN_PASSWORD;
  if (!password) return false;
  return request.headers.get("X-Admin-Key") === password;
}

function getClientIp(request) {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) return cfIp.trim();

  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) return forwarded.split(",")[0].trim();

  return "unknown";
}

function getCfGeo(request) {
  const cf = request.cf || {};
  const headerCountry = request.headers.get("CF-IPCountry") || "";

  return {
    country: truncate(cf.country || headerCountry || "XX", 16),
    region: truncate(cf.region || "", 80),
    regionCode: truncate(cf.regionCode || "", 40),
    city: truncate(cf.city || "", 100),
    timezone: truncate(cf.timezone || "", 80),
    colo: truncate(cf.colo || "", 20)
  };
}

function getCountry(request) {
  return getCfGeo(request).country || "XX";
}

function truncate(value, maxLength) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getRequestContext(request) {
  const userAgent = request.headers.get("User-Agent") || "";
  const origin = request.headers.get("Origin") || "";
  const referer = request.headers.get("Referer") || "";
  const secFetchSite = request.headers.get("Sec-Fetch-Site") || "";
  const geo = getCfGeo(request);

  return {
    ip: getClientIp(request),
    ...geo,
    userAgent: truncate(userAgent, MAX_USER_AGENT_LENGTH),
    origin: truncate(origin, MAX_HEADER_VALUE_LENGTH),
    referer: truncate(referer, MAX_HEADER_VALUE_LENGTH),
    secFetchSite: truncate(secFetchSite, 80)
  };
}

function isAllowedOriginOrReferer(request, env) {
  const allowedOrigins = getAllowedOrigins(env);
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");

  if (origin) {
    return allowedOrigins.has(origin);
  }

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      return allowedOrigins.has(refererOrigin);
    } catch (e) {
      return false;
    }
  }

  // 没有 Origin/Referer 不一定直接拒绝，部分浏览器/隐私插件会隐藏。
  // 后续风控会把它标记为风险。
  return true;
}

function isProgrammaticUserAgent(userAgent) {
  return PROGRAMMATIC_UA_RE.test(userAgent || "");
}

async function sha256Hex(input) {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function ipHash(ip) {
  return sha256Hex(`mini-tools-ip:${ip}`);
}

async function deviceHashFromClientId(clientId) {
  const value = String(clientId || "").trim();
  if (!value) return "";
  return sha256Hex(`mini-tools-device:${value}`);
}

async function deviceHashFromUserAgent(userAgent) {
  const value = String(userAgent || "").trim();
  if (!value) return "";
  return sha256Hex(`mini-tools-ua:${value}`);
}

async function getUploadDeviceHash(ctx, clientDeviceId) {
  const fromClient = await deviceHashFromClientId(clientDeviceId);
  if (fromClient) return fromClient;
  return deviceHashFromUserAgent(ctx?.userAgent || "");
}

function highRiskR2Key(id) {
  return `${HIGH_RISK_USER_PREFIX}${encodeURIComponent(id)}.json`;
}

function datePart(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function uploadIndexKey(fileKey) {
  return `${UPLOAD_INDEX_PREFIX}${encodeURIComponent(fileKey)}.json`;
}

async function saveUploadIndex(env, fileKey, data) {
  await putJsonObject(env, uploadIndexKey(fileKey), {
    key: fileKey,
    ...data,
    updatedAt: new Date().toISOString()
  });
}

async function getUploadIndex(env, fileKey) {
  return getJsonObject(env, uploadIndexKey(fileKey), null);
}

async function clearUploadRisk(env, fileKey) {
  const indexData = await getUploadIndex(env, fileKey);
  if (!indexData) return;

  await saveUploadIndex(env, fileKey, {
    ...indexData,
    risk: "normal",
    riskReasons: [],
    auditedAt: new Date().toISOString()
  });
}

async function deleteUploadIndex(env, fileKey) {
  await env.R2_BUCKET.delete(uploadIndexKey(fileKey));
}

function rateWindowStart(now, windowMs) {
  return Math.floor(now / windowMs) * windowMs;
}

function rateKey(hash, rule, now) {
  const start = rateWindowStart(now, rule.windowMs);
  return `${RATE_PREFIX}${rule.name}/${start}/${hash}.json`;
}

async function getJsonObject(env, key, fallback = null) {
  try {
    const file = await env.R2_BUCKET.get(key);
    if (!file) return fallback;
    return JSON.parse(await file.text());
  } catch (e) {
    return fallback;
  }
}

async function putJsonObject(env, key, data) {
  await env.R2_BUCKET.put(key, JSON.stringify(data), {
    httpMetadata: { contentType: "application/json" }
  });
}

async function isIpBlocked(env, hash) {
  const file = await env.R2_BUCKET.get(`${BLOCKED_IP_PREFIX}${hash}.json`);
  return Boolean(file);
}

async function setIpBlocked(env, hash, data) {
  await putJsonObject(env, `${BLOCKED_IP_PREFIX}${hash}.json`, data);
}

async function removeIpBlocked(env, hash) {
  await env.R2_BUCKET.delete(`${BLOCKED_IP_PREFIX}${hash}.json`);
}

async function setHighRiskUserR2(env, data) {
  const id = data.id || `risk:${data.ip_hash || "noip"}:${data.device_hash || "nodev"}`;
  await putJsonObject(env, highRiskR2Key(id), { ...data, id });
  return id;
}

async function removeHighRiskUserR2(env, id) {
  if (!id) return;
  await env.R2_BUCKET.delete(highRiskR2Key(id));
}

async function checkUploadRate(env, hash, incrementBy = 1) {
  const now = Date.now();
  const counters = [];

  for (const rule of RATE_RULES) {
    const key = rateKey(hash, rule, now);
    const current = await getJsonObject(env, key, { count: 0, windowStart: rateWindowStart(now, rule.windowMs) });
    const count = Number(current.count || 0);

    if (count + incrementBy > rule.limit) {
      return {
        ok: false,
        status: 429,
        error: "上传过于频繁，请稍后再试。",
        reason: `rate_limit_${rule.name}`,
        detail: {
          rule: rule.name,
          limit: rule.limit,
          current: count,
          attempted: incrementBy
        }
      };
    }

    counters.push({ key, rule, count, nextCount: count + incrementBy });
  }

  return { ok: true, counters };
}

async function commitUploadRate(env, rateCheck) {
  if (!rateCheck?.counters) return;
  const now = Date.now();
  await Promise.all(
    rateCheck.counters.map(({ key, rule, nextCount }) =>
      putJsonObject(env, key, {
        count: nextCount,
        updatedAt: now,
        expiresAt: now + rule.windowMs + 60 * 1000
      })
    )
  );
}

async function updateRecentUploadStats(env, hash) {
  const now = Date.now();
  const key = `${RECENT_PREFIX}${hash}.json`;
  const recent = await getJsonObject(env, key, { timestamps: [] });
  const timestamps = Array.isArray(recent.timestamps) ? recent.timestamps : [];
  timestamps.push(now);

  const cutoff = now - 30 * 60 * 1000;
  const compact = timestamps.filter((t) => Number(t) >= cutoff).slice(-40);

  await putJsonObject(env, key, {
    timestamps: compact,
    updatedAt: now
  });

  if (compact.length < 30) {
    return { suspicious: false, count: compact.length };
  }

  const last30 = compact.slice(-30);
  const span = last30[last30.length - 1] - last30[0];
  const avgInterval = span / Math.max(1, last30.length - 1);

  return {
    suspicious: avgInterval < 5000,
    count: compact.length,
    avgIntervalMs: Math.round(avgInterval)
  };
}

async function logUpload(env, payload) {
  const now = Date.now();
  const key = `${UPLOAD_LOG_PREFIX}${datePart(now)}/${now}-${crypto.randomUUID()}.json`;
  await putJsonObject(env, key, {
    ...payload,
    loggedAt: new Date(now).toISOString()
  });
}

async function markSuspicious(env, fileKey, payload) {
  await putJsonObject(env, `${SUSPICIOUS_PREFIX}${fileKey}.json`, payload);
}

async function getVipConfig(env) {
  if (!hasD1(env)) throw new Error("VIP email verification requires the D1 binding DB");
  await ensureVipSchema(env);
  await migrateLegacyVipConfigToD1(env);
  const rows = await d1All(env, `
    SELECT code, note, email, email_verified, email_verified_at, created_at, updated_at
    FROM vip_codes
    WHERE active = 1
    ORDER BY created_at ASC
  `);
  return rows.map((row) => ({
    code: row.code,
    note: row.note || "",
    email: row.email || "",
    email_verified: Number(row.email_verified || 0) === 1,
    email_verified_at: row.email_verified_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

function captchaKey(id) {
  return `${CAPTCHA_PREFIX}${id}.json`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCaptchaQuestion() {
  const useAddition = Math.random() > 0.35;

  if (useAddition) {
    const a = randomInt(1, 9);
    const b = randomInt(1, 9);
    return {
      question: `${a} + ${b} = ?`,
      answer: a + b
    };
  }

  const a = randomInt(5, 18);
  const b = randomInt(1, a - 1);
  return {
    question: `${a} - ${b} = ?`,
    answer: a - b
  };
}

async function createCaptcha(env, request) {
  const ctx = getRequestContext(request);
  const hash = await ipHash(ctx.ip);
  const id = crypto.randomUUID();
  const challenge = generateCaptchaQuestion();
  const payload = {
    answer: challenge.answer,
    expiresAt: Date.now() + CAPTCHA_EXPIRE_MS,
    attempts: 0,
    ipHash: hash,
    userAgentHash: await sha256Hex(ctx.userAgent || "unknown")
  };

  await putJsonObject(env, captchaKey(id), payload);

  return {
    captcha_id: id,
    question: challenge.question,
    expires_in_seconds: Math.floor(CAPTCHA_EXPIRE_MS / 1000)
  };
}

async function verifyCaptcha(env, request, captchaId, captchaAnswer) {
  if (!captchaId || captchaAnswer === null || captchaAnswer === undefined || String(captchaAnswer).trim() === "") {
    return {
      ok: false,
      status: 400,
      error: "缺少验证码参数"
    };
  }

  const key = captchaKey(captchaId);
  const file = await env.R2_BUCKET.get(key);
  if (!file) {
    return {
      ok: false,
      status: 400,
      error: "验证码已过期或无效"
    };
  }

  let saved;
  try {
    saved = JSON.parse(await file.text());
  } catch (e) {
    await env.R2_BUCKET.delete(key);
    return {
      ok: false,
      status: 500,
      error: "验证码数据损坏"
    };
  }

  if (!saved.expiresAt || Date.now() > Number(saved.expiresAt)) {
    await env.R2_BUCKET.delete(key);
    return {
      ok: false,
      status: 400,
      error: "验证码已过期"
    };
  }

  const ctx = getRequestContext(request);
  const currentIpHash = await ipHash(ctx.ip);
  const currentUaHash = await sha256Hex(ctx.userAgent || "unknown");

  if (saved.ipHash && saved.ipHash !== currentIpHash) {
    await env.R2_BUCKET.delete(key);
    return {
      ok: false,
      status: 403,
      error: "验证码会话异常，请刷新页面后重试"
    };
  }

  if (saved.userAgentHash && saved.userAgentHash !== currentUaHash) {
    await env.R2_BUCKET.delete(key);
    return {
      ok: false,
      status: 403,
      error: "验证码会话异常，请刷新页面后重试"
    };
  }

  const answerNum = Number(String(captchaAnswer).trim());
  if (!Number.isFinite(answerNum)) {
    return {
      ok: false,
      status: 400,
      error: "验证码答案必须为数字"
    };
  }

  if (answerNum !== Number(saved.answer)) {
    // 错误时销毁，避免暴力尝试。
    await env.R2_BUCKET.delete(key);
    return {
      ok: false,
      status: 403,
      error: "验证码错误"
    };
  }

  // 成功后销毁，避免重复使用。
  await env.R2_BUCKET.delete(key);

  return { ok: true };
}

function isValidUploadFile(file) {
  if (!file || typeof file !== "object") {
    return { ok: false, status: 400, error: "无文件" };
  }

  if (!MIME_TO_EXT[file.type]) {
    return { ok: false, status: 415, error: "不支持的格式" };
  }

  return { ok: true };
}

function isLikelyImageByMagicBytes(mime, bytes) {
  if (!bytes || bytes.length < 4) return false;

  if (mime === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mime === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }

  if (mime === "image/gif") {
    return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
  }

  if (mime === "image/webp") {
    const text = new TextDecoder().decode(bytes.slice(0, 12));
    return text.startsWith("RIFF") && text.includes("WEBP");
  }

  return false;
}

function normalizeDuration(duration) {
  const validDurations = ["1-day", "7-day", "30-day"];
  return validDurations.includes(duration) ? duration : "1-day";
}

async function listObjects(env, options = {}) {
  let allObjects = [];
  let cursor = undefined;

  do {
    const listed = await env.R2_BUCKET.list({
      ...options,
      cursor
    });
    allObjects.push(...listed.objects);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  return allObjects;
}

function shouldHideInternalObject(key) {
  return (
    key.startsWith("_config/") ||
    key.startsWith("_captcha/") ||
    key.startsWith(SECURITY_PREFIX)
  );
}


function rowToAdminImage(row) {
  return {
    key: row.r2_key,
    r2_key: row.r2_key,
    url: row.public_url,
    public_url: row.public_url,
    size: Number(row.size || 0),
    uploaded: row.uploaded_at,
    isPersonal: Number(row.is_personal || 0) === 1,
    vipId: row.vip_id || null,
    uploadSource: row.upload_source || "web",
    apiUserId: row.api_user_id || null,
    fileHash: row.file_hash || null,
    ip: row.ip || null,
    ipHash: row.ip_hash || null,
    country: row.country || null,
    region: row.region || null,
    regionCode: row.region_code || null,
    city: row.city || null,
    timezone: row.timezone || null,
    colo: row.colo || null,
    userAgent: row.user_agent || null,
    origin: row.origin || null,
    referer: row.referer || null,
    duration: row.duration || null,
    risk: row.risk || "normal",
    riskReasons: parseJsonArrayText(row.risk_reasons),
    loggedAt: row.uploaded_at || null,
    status: row.status || "pending",
    ipBlocked: Number(row.ip_blocked || 0) === 1,
    highRiskUser: Number(row.high_risk_user || 0) === 1
  };
}

function buildD1WhereFromUrl(url) {
  const statusGroup = String(url.searchParams.get("status_group") || "").trim();
  const filterStatus = String(url.searchParams.get("status") || "").trim();
  const filterRisk = String(url.searchParams.get("risk") || "").trim();
  const filterCategory = String(url.searchParams.get("category") || "").trim();
  const filterVip = String(url.searchParams.get("vip") || "").trim();
  const filterIp = String(url.searchParams.get("ip") || "").trim();
  const filterIpHash = String(url.searchParams.get("ip_hash") || "").trim();
  const filterIpQ = String(url.searchParams.get("ip_q") || "").trim();
  const filterCountry = String(url.searchParams.get("country") || "").trim().toUpperCase();
  const filterRegion = String(url.searchParams.get("region") || "").trim().toLowerCase();
  const filterCity = String(url.searchParams.get("city") || "").trim().toLowerCase();
  const includeExpired = url.searchParams.get("include_expired") === "1";

  const where = [];
  const params = [];

  if (filterStatus) {
    where.push("i.status = ?");
    params.push(filterStatus);
  } else if (statusGroup === "pending") {
    where.push("i.status IN ('pending', 'suspicious')");
    where.push("COALESCE(i.upload_source, 'web') != 'api'");
  } else if (statusGroup === "api_review") {
    where.push("i.status IN ('pending', 'suspicious')");
    where.push("i.upload_source = 'api'");
  } else if (statusGroup === "audited") {
    where.push("i.status = 'audited'");
  } else if (statusGroup === "personal") {
    where.push("i.status = 'personal'");
  } else {
    where.push("i.status != 'deleted'");
  }

  // 后台列表默认不显示已过期的临时图片。真正删除由 scheduled 定时任务处理；这里是兜底，避免后台看到坏图。
  if (!includeExpired) {
    where.push("(i.expires_at IS NULL OR i.expires_at = '' OR i.expires_at > ?)");
    params.push(new Date().toISOString());
  }

  if (filterRisk && filterRisk !== "all") {
    if (filterRisk === "blocked") {
      where.push("EXISTS (SELECT 1 FROM blocked_ips b2 WHERE b2.ip_hash = i.ip_hash)");
    } else if (filterRisk === "missing_ip") {
      where.push("(i.ip IS NULL AND i.ip_hash IS NULL)");
    } else {
      where.push("i.risk = ?");
      params.push(filterRisk);
    }
  }

  if (filterCategory && filterCategory !== "all") {
    where.push("i.folder = ?");
    params.push(filterCategory);
  }

  if (filterVip) {
    where.push("i.vip_id LIKE ?");
    params.push(`%${filterVip}%`);
  }

  if (filterIp && filterIpHash) {
    where.push("(i.ip = ? OR i.ip_hash = ?)");
    params.push(filterIp, filterIpHash);
  } else if (filterIp) {
    where.push("(i.ip = ? OR i.ip_hash = ?)");
    params.push(filterIp, filterIp);
  } else if (filterIpHash) {
    where.push("i.ip_hash = ?");
    params.push(filterIpHash);
  }

  if (filterIpQ) {
    where.push("(i.ip LIKE ? OR i.ip_hash LIKE ? OR i.country LIKE ? OR i.region LIKE ? OR i.city LIKE ?)");
    const q = `%${filterIpQ}%`;
    params.push(q, q, q, q, q);
  }

  if (filterCountry) {
    where.push("UPPER(COALESCE(i.country, '')) = ?");
    params.push(filterCountry);
  }

  if (filterRegion) {
    where.push("LOWER(COALESCE(i.region, i.region_code, '')) LIKE ?");
    params.push(`%${filterRegion}%`);
  }

  if (filterCity) {
    where.push("LOWER(COALESCE(i.city, '')) LIKE ?");
    params.push(`%${filterCity}%`);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
    filters: {
      status_group: statusGroup || null,
      status: filterStatus || null,
      risk: filterRisk || null,
      category: filterCategory || null,
      vip: filterVip || null,
      ip: filterIp || null,
      ip_hash: filterIpHash || null,
      ip_q: filterIpQ || null,
      country: filterCountry || null,
      region: filterRegion || null,
      city: filterCity || null,
      include_expired: includeExpired
    }
  };
}

async function getD1DashboardCounts(env) {
  const rows = await d1All(env, `
    SELECT status, COUNT(*) AS count
    FROM images
    WHERE status != 'deleted'
      AND (expires_at IS NULL OR expires_at = '' OR expires_at > ?)
    GROUP BY status
  `, [new Date().toISOString()]);

  const counts = {
    pending: 0,
    suspicious: 0,
    audited: 0,
    personal: 0,
    deleted: 0,
    total: 0
  };

  for (const row of rows) {
    const status = row.status || "unknown";
    const count = Number(row.count || 0);
    counts[status] = count;
    counts.total += count;
  }

  // 待审核卡片需要同时包含普通待审核和可疑图
  counts.review = Number(counts.pending || 0) + Number(counts.suspicious || 0);
  const apiReviewRow = await d1First(env, `
    SELECT COUNT(*) AS count
    FROM images
    WHERE upload_source = 'api'
      AND status IN ('pending', 'suspicious')
      AND (expires_at IS NULL OR expires_at = '' OR expires_at > ?)
  `, [new Date().toISOString()]);
  counts.api_review = Number(apiReviewRow?.count || 0);
  counts.web_review = Math.max(0, counts.review - counts.api_review);
  return counts;
}

async function getD1IpSummary(env, url) {
  // IP 汇总用于风控/黑名单，不应该跟随当前图片分类。
  // 增加分页，避免所有 IP 一次性堆到后台页面。
  const page = Math.max(Number(url.searchParams.get("ip_page") || 1), 1);
  const pageSize = Math.min(Math.max(Number(url.searchParams.get("ip_page_size") || 30), 10), 100);
  const offset = (page - 1) * pageSize;
  const q = String(url.searchParams.get("ip_q") || url.searchParams.get("q") || "").trim();
  const blockedOnly = url.searchParams.get("ip_blocked") === "1" || url.searchParams.get("blocked") === "1";

  const where = [
    "i.status != 'deleted'",
    "(i.expires_at IS NULL OR i.expires_at = '' OR i.expires_at > ?)"
  ];
  const params = [new Date().toISOString()];

  if (q) {
    where.push("(i.ip LIKE ? OR i.ip_hash LIKE ? OR i.country LIKE ? OR i.region LIKE ? OR i.region_code LIKE ? OR i.city LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }

  if (blockedOnly) {
    where.push("b.ip_hash IS NOT NULL");
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const countRow = await d1First(env, `
    SELECT COUNT(*) AS count
    FROM (
      SELECT COALESCE(i.ip, i.ip_hash, 'unknown') AS group_key
      FROM images i
      LEFT JOIN blocked_ips b ON b.ip_hash = i.ip_hash
      ${whereSql}
      GROUP BY group_key
    ) t
  `, params);

  const total = Number(countRow?.count || 0);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  const rows = await d1All(env, `
    SELECT
      COALESCE(i.ip, i.ip_hash, 'unknown') AS group_key,
      MAX(i.ip) AS ip,
      MAX(i.ip_hash) AS ipHash,
      MAX(i.country) AS country,
      MAX(i.region) AS region,
      MAX(i.region_code) AS regionCode,
      MAX(i.city) AS city,
      MAX(i.timezone) AS timezone,
      MAX(i.colo) AS colo,
      COUNT(*) AS count,
      SUM(CASE WHEN i.status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN i.status = 'suspicious' THEN 1 ELSE 0 END) AS suspicious,
      SUM(CASE WHEN i.status = 'audited' THEN 1 ELSE 0 END) AS audited,
      SUM(CASE WHEN i.status = 'personal' THEN 1 ELSE 0 END) AS personal,
      MAX(i.uploaded_at) AS latestUpload,
      MAX(CASE WHEN b.ip_hash IS NOT NULL THEN 1 ELSE 0 END) AS blocked
    FROM images i
    LEFT JOIN blocked_ips b ON b.ip_hash = i.ip_hash
    ${whereSql}
    GROUP BY group_key
    ORDER BY latestUpload DESC
    LIMIT ? OFFSET ?
  `, [...params, pageSize, offset]);

  const items = rows.map((row) => ({
    ip: row.ip || null,
    ipHash: row.ipHash || null,
    country: row.country || null,
    region: row.region || null,
    regionCode: row.regionCode || null,
    city: row.city || null,
    timezone: row.timezone || null,
    colo: row.colo || null,
    count: Number(row.count || 0),
    pending: Number(row.pending || 0),
    suspicious: Number(row.suspicious || 0),
    audited: Number(row.audited || 0),
    personal: Number(row.personal || 0),
    latestUpload: row.latestUpload || null,
    blocked: Number(row.blocked || 0) === 1
  }));

  return {
    items,
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages,
    q: q || null,
    blockedOnly
  };
}

async function handleD1AdminList(request, env, url) {
  const statusGroup = String(url.searchParams.get("status_group") || "").trim();
  const apiReviewOnly = statusGroup === "api_review";
  if (!hasD1(env) || url.searchParams.get("source") === "r2") {
    if (apiReviewOnly) {
      return jsonResponse(request, env, {
        error: "API 图片审核依赖 D1，当前无法安全区分 API 上传来源"
      }, 503);
    }
    return await handleR2AdminList(request, env, url);
  }

  const page = Math.max(Number(url.searchParams.get("page") || 1), 1);
  const pageSize = Math.min(Math.max(Number(url.searchParams.get("page_size") || 16), 1), 100);
  const offset = (page - 1) * pageSize;
  const sort = String(url.searchParams.get("sort") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const includeSummary = url.searchParams.get("include_summary") !== "0";

  const { whereSql, params, filters } = buildD1WhereFromUrl(url);

  try {
    await ensureApiSchema(env);
    await ensureHighRiskSchema(env);
    const countRow = await d1First(env, `
      SELECT COUNT(*) AS count
      FROM images i
      ${whereSql}
    `, params);

    const totalFiltered = Number(countRow?.count || 0);
    const rows = await d1All(env, `
      SELECT i.*,
             CASE WHEN b.ip_hash IS NOT NULL THEN 1 ELSE 0 END AS ip_blocked,
             CASE WHEN hr.id IS NOT NULL THEN 1 ELSE 0 END AS high_risk_user
      FROM images i
      LEFT JOIN blocked_ips b ON b.ip_hash = i.ip_hash
      LEFT JOIN high_risk_users hr
        ON hr.active = 1
       AND hr.ip_hash IS NOT NULL
       AND hr.ip_hash = i.ip_hash
      ${whereSql}
      ORDER BY i.uploaded_at ${sort}
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);

    const dashboardCounts = includeSummary ? await getD1DashboardCounts(env) : null;
    const ipSummaryData = includeSummary ? await getD1IpSummary(env, url) : {
      items: [],
      page: 1,
      page_size: 30,
      total: 0,
      total_pages: 1
    };

    return jsonResponse(request, env, {
      source: "d1",
      items: rows.map(rowToAdminImage),
      keys: rows.map(rowToAdminImage),
      page,
      page_size: pageSize,
      total_pages: Math.max(Math.ceil(totalFiltered / pageSize), 1),
      total: dashboardCounts?.total ?? totalFiltered,
      filtered: totalFiltered,
      filters,
      dashboardCounts,
      ipSummary: ipSummaryData.items,
      ipSummaryPagination: ipSummaryData
    });
  } catch (error) {
    if (apiReviewOnly) {
      console.error("D1 API review list failed:", error && error.message ? error.message : error);
      return jsonResponse(request, env, {
        error: "API 图片审核列表读取失败"
      }, 503);
    }
    // D1 出问题时，不让后台直接挂死；临时降级回 R2 旧列表。
    console.error("D1 list failed, fallback to R2:", error && error.message ? error.message : error);
    return await handleR2AdminList(request, env, url);
  }
}

function isMigratableImageObject(obj) {
  if (!obj || !obj.key) return false;
  if (shouldHideInternalObject(obj.key)) return false;
  if (obj.key.startsWith("_audited/")) return false;
  if (obj.key.startsWith(SUSPICIOUS_PREFIX)) return false;
  return true;
}

function safeUploadedIso(value) {
  try {
    if (!value) return new Date().toISOString();
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isFinite(date.getTime())) return date.toISOString();
    return new Date().toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
}

async function collectAuditAndSuspiciousSets(env) {
  const auditSet = new Set();
  const suspiciousSet = new Set();

  const auditObjects = await listObjects(env, { prefix: "_audited/" });
  for (const obj of auditObjects) auditSet.add(obj.key.replace("_audited/", ""));

  const suspiciousObjects = await listObjects(env, { prefix: SUSPICIOUS_PREFIX });
  for (const obj of suspiciousObjects) suspiciousSet.add(obj.key.replace(SUSPICIOUS_PREFIX, "").replace(/\.json$/, ""));

  return { auditSet, suspiciousSet };
}

async function migrateVipCodesToD1(env) {
  const vips = await getVipConfig(env);
  let count = 0;

  for (const vip of vips) {
    if (!vip?.code) continue;
    await d1UpsertVipCode(env, {
      code: vip.code,
      note: vip.note || "",
      createdAt: new Date().toISOString()
    });
    count += 1;
  }

  return count;
}

async function migrateBlockedIpsToD1(env) {
  const listed = await env.R2_BUCKET.list({ prefix: BLOCKED_IP_PREFIX, limit: 1000 });
  let count = 0;

  for (const obj of listed.objects || []) {
    const data = await getJsonObject(env, obj.key, {});
    const ipHashValue = obj.key.replace(BLOCKED_IP_PREFIX, "").replace(/\.json$/, "");
    if (!ipHashValue) continue;

    await d1SetBlockedIp(env, {
      ipHash: ipHashValue,
      ip: data.ip || null,
      note: data.note || "",
      sourceKey: data.source_key || data.sourceKey || null,
      createdAt: data.created_at || data.createdAt || new Date().toISOString()
    });
    count += 1;
  }

  return count;
}

async function handleD1MigrateFromR2(request, env, url) {
  if (!hasD1(env)) {
    return jsonResponse(request, env, {
      ok: false,
      error: "D1 binding DB not found. 请检查 Worker Bindings 里是否绑定变量名 DB。"
    }, 500);
  }

  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 500), 1), 1000);
  const cursor = url.searchParams.get("cursor") || undefined;
  const dryRun = url.searchParams.get("dry_run") === "1";
  const defaultStatus = String(url.searchParams.get("default_status") || "audited").trim();

  // v4：按真实图片目录迁移，避免从桶根目录扫到 _audited / _security 等内部标记文件。
  // 示例：?action=d1_migrate&prefix=30-day/&limit=500
  const rawPrefix = String(url.searchParams.get("prefix") || "").trim();
  const allowedPrefixes = new Set(["1-day/", "7-day/", "30-day/", "permanent/", "personal/"]);
  const prefix = allowedPrefixes.has(rawPrefix) ? rawPrefix : "";

  if (!prefix) {
    return jsonResponse(request, env, {
      ok: false,
      error: "v4 迁移必须指定 prefix。允许值：1-day/、7-day/、30-day/、permanent/、personal/。这样不会再扫描 _audited 等内部标记。",
      example: "https://api.mini-tools.uk?action=d1_migrate&prefix=30-day/&limit=500"
    }, 400);
  }

  const listed = await env.R2_BUCKET.list({
    prefix,
    include: ["customMetadata"],
    limit,
    cursor
  });

  const objects = listed.objects || [];
  const migratableObjects = objects.filter(isMigratableImageObject);

  let migrated = 0;
  let skipped = objects.length - migratableObjects.length;
  let vipSynced = 0;
  let blockedSynced = 0;
  const errors = [];

  if (!dryRun && !cursor) {
    vipSynced = await migrateVipCodesToD1(env);
    blockedSynced = await migrateBlockedIpsToD1(env);
  }

  for (const obj of migratableObjects) {
    try {
      const indexData = await getUploadIndex(env, obj.key);
      const custom = obj.customMetadata || {};
      const uploadedAt = safeUploadedIso(indexData?.loggedAt || obj.uploaded);
      const isPersonal = obj.key.startsWith("personal/");

      // 线上迁移按用户要求：历史公开图默认通过，不再挤到待审核。
      let status = defaultStatus === "pending" ? "pending" : "audited";
      if (isPersonal) status = "personal";

      const folder = folderFromKey(obj.key);
      const duration = indexData?.duration || (folder === "personal" ? "personal" : folder);
      const risk = status === "audited" || status === "personal"
        ? "normal"
        : (indexData?.risk || custom.risk || "normal");

      if (!dryRun) {
        await d1UpsertImage(env, {
          r2Key: obj.key,
          publicUrl: `https://pub.mini-tools.uk/${obj.key}`,
          folder,
          status,
          risk,
          riskReasons: status === "audited" || status === "personal" ? [] : (indexData?.riskReasons || []),
          size: obj.size || indexData?.fileSize || 0,
          mime: indexData?.fileType || custom.mime || null,
          fileHash: indexData?.fileHash || custom.file_hash || null,
          ip: indexData?.ip || null,
          ipHash: indexData?.ipHash || custom.ip_hash || null,
          country: indexData?.country || custom.country || null,
          region: indexData?.region || custom.region || null,
          regionCode: indexData?.regionCode || custom.region_code || null,
          city: indexData?.city || custom.city || null,
          timezone: indexData?.timezone || null,
          colo: indexData?.colo || null,
          userAgent: indexData?.userAgent || null,
          origin: indexData?.origin || null,
          referer: indexData?.referer || null,
          vipId: indexData?.vipId || custom.vip_id || null,
          duration,
          isVip: Boolean(indexData?.isVip || custom.vip_id),
          isPersonal,
          uploadedAt,
          auditedAt: status === "audited" ? new Date().toISOString() : null,
          expiresAt: isPersonal ? null : calculateExpiresAt(duration, uploadedAt)
        });

        await d1LogEvent(env, {
          r2Key: obj.key,
          ip: indexData?.ip || null,
          ipHash: indexData?.ipHash || custom.ip_hash || null,
          country: indexData?.country || custom.country || null,
          region: indexData?.region || custom.region || null,
          city: indexData?.city || custom.city || null,
          eventType: "migrate",
          risk,
          riskReasons: [],
          fileSize: obj.size || 0,
          mime: indexData?.fileType || null,
          createdAt: new Date().toISOString()
        });
      }

      migrated += 1;
    } catch (error) {
      errors.push({
        key: obj.key,
        error: error && error.message ? error.message : String(error)
      });
    }
  }

  return jsonResponse(request, env, {
    ok: errors.length === 0,
    dry_run: dryRun,
    prefix,
    default_status: defaultStatus,
    processed_objects: objects.length,
    migrated_images: migrated,
    skipped_internal_or_marker_objects: skipped,
    vip_synced: vipSynced,
    blocked_ip_synced: blockedSynced,
    limit,
    truncated: Boolean(listed.truncated),
    next_cursor: listed.truncated ? listed.cursor : null,
    errors: errors.slice(0, 20),
    note: dryRun
      ? "dry_run=1 仅预览，不写入 D1。去掉 dry_run 后执行正式迁移。"
      : "v4 已按 prefix 目录迁移，不再扫描 _audited 等内部标记。如果 truncated=true，只继续当前 prefix 的 next_cursor。"
  });
}

async function handleR2AdminList(request, env, url) {
  const allObjects = await listObjects(env, { include: ["customMetadata"] });

  const filterIp = String(url.searchParams.get("ip") || "").trim();
  const filterIpHash = String(url.searchParams.get("ip_hash") || "").trim();
  const filterCountry = String(url.searchParams.get("country") || "").trim().toUpperCase();
  const filterRegion = String(url.searchParams.get("region") || "").trim().toLowerCase();
  const filterCity = String(url.searchParams.get("city") || "").trim().toLowerCase();
  const filterStatus = String(url.searchParams.get("status") || "").trim();
  const filterRisk = String(url.searchParams.get("risk") || "").trim();
  const includeExpired = url.searchParams.get("include_expired") === "1";

  const ipPage = Math.max(Number(url.searchParams.get("ip_page") || 1), 1);
  const ipPageSize = Math.min(Math.max(Number(url.searchParams.get("ip_page_size") || 30), 10), 100);
  const ipQ = String(url.searchParams.get("ip_q") || url.searchParams.get("q") || "").trim();
  const ipBlockedOnly = url.searchParams.get("ip_blocked") === "1" || url.searchParams.get("blocked") === "1";

  const fileMap = new Map();
  const auditSet = new Set();
  const suspiciousSet = new Set();
  const blockedHashSet = new Set();
  const uploadIndexMap = new Map();

  for (const obj of allObjects) {
    if (obj.key.startsWith(BLOCKED_IP_PREFIX)) {
      blockedHashSet.add(obj.key.replace(BLOCKED_IP_PREFIX, "").replace(/\.json$/, ""));
      continue;
    }

    if (obj.key.startsWith(UPLOAD_INDEX_PREFIX)) {
      const data = await getJsonObject(env, obj.key, null);
      if (data?.key) {
        uploadIndexMap.set(data.key, data);
      }
    }
  }

  allObjects.forEach((obj) => {
    if (shouldHideInternalObject(obj.key)) return;

    if (obj.key.startsWith("_audited/")) {
      auditSet.add(obj.key.replace("_audited/", ""));
      return;
    }

    if (obj.key.startsWith(SUSPICIOUS_PREFIX)) {
      suspiciousSet.add(obj.key.replace(SUSPICIOUS_PREFIX, "").replace(/\.json$/, ""));
      return;
    }

    const indexData = uploadIndexMap.get(obj.key) || {};
    const mergedIpHash = indexData.ipHash || obj.customMetadata?.ip_hash || null;
    const folder = folderFromKey(obj.key);
    const duration = indexData.duration || (folder === "personal" ? "personal" : folder);
    const expiresAt = indexData.expiresAt || calculateExpiresAt(duration, indexData.loggedAt || obj.uploaded);

    fileMap.set(obj.key, {
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      expiresAt,
      isPersonal: obj.key.startsWith("personal/"),
      vipId: obj.customMetadata?.vip_id || null,
      fileHash: indexData.fileHash || obj.customMetadata?.file_hash || null,
      ip: indexData.ip || null,
      ipHash: mergedIpHash,
      country: indexData.country || obj.customMetadata?.country || null,
      region: indexData.region || obj.customMetadata?.region || null,
      regionCode: indexData.regionCode || obj.customMetadata?.region_code || null,
      city: indexData.city || obj.customMetadata?.city || null,
      timezone: indexData.timezone || null,
      colo: indexData.colo || null,
      userAgent: indexData.userAgent || null,
      origin: indexData.origin || null,
      referer: indexData.referer || null,
      duration,
      risk: indexData.risk || obj.customMetadata?.risk || "normal",
      riskReasons: indexData.riskReasons || [],
      loggedAt: indexData.loggedAt || null,
      ipBlocked: mergedIpHash ? blockedHashSet.has(mergedIpHash) : false
    });
  });

  const resultFiles = Array.from(fileMap.values())
    .map((file) => ({
      ...file,
      status: file.isPersonal
        ? "personal"
        : suspiciousSet.has(file.key)
          ? "suspicious"
          : auditSet.has(file.key)
            ? "audited"
            : "pending"
    }))
    .filter((file) => includeExpired || !isExpiredAdminFile(file));

  const filteredFiles = resultFiles.filter((file) => {
    if (filterIp && file.ip !== filterIp) return false;
    if (filterIpHash && file.ipHash !== filterIpHash) return false;
    if (filterCountry && String(file.country || "").toUpperCase() !== filterCountry) return false;
    if (filterRegion && !String(file.region || file.regionCode || "").toLowerCase().includes(filterRegion)) return false;
    if (filterCity && !String(file.city || "").toLowerCase().includes(filterCity)) return false;
    if (filterStatus && file.status !== filterStatus) return false;
    if (filterRisk && file.risk !== filterRisk) return false;
    return true;
  });

  const ipSummaryMap = new Map();
  for (const file of resultFiles) {
    const key = file.ip || file.ipHash || "unknown";
    const current = ipSummaryMap.get(key) || {
      ip: file.ip || null,
      ipHash: file.ipHash || null,
      country: file.country || null,
      region: file.region || null,
      regionCode: file.regionCode || null,
      city: file.city || null,
      timezone: file.timezone || null,
      colo: file.colo || null,
      count: 0,
      pending: 0,
      suspicious: 0,
      audited: 0,
      personal: 0,
      blocked: false,
      latestUpload: null
    };

    current.count += 1;
    current[file.status] = Number(current[file.status] || 0) + 1;
    current.blocked = current.blocked || Boolean(file.ipBlocked);

    const uploaded = file.loggedAt || file.uploaded;
    if (uploaded && (!current.latestUpload || String(uploaded) > String(current.latestUpload))) {
      current.latestUpload = uploaded;
      current.country = file.country || current.country || null;
      current.region = file.region || current.region || null;
      current.regionCode = file.regionCode || current.regionCode || null;
      current.city = file.city || current.city || null;
      current.timezone = file.timezone || current.timezone || null;
      current.colo = file.colo || current.colo || null;
    }

    ipSummaryMap.set(key, current);
  }

  let allIpSummary = Array.from(ipSummaryMap.values());

  if (ipQ) {
    allIpSummary = allIpSummary.filter((item) =>
      String(item.ip || "").includes(ipQ) ||
      String(item.ipHash || "").includes(ipQ) ||
      String(item.country || "").includes(ipQ) ||
      String(item.region || "").includes(ipQ) ||
      String(item.regionCode || "").includes(ipQ) ||
      String(item.city || "").includes(ipQ)
    );
  }

  if (ipBlockedOnly) {
    allIpSummary = allIpSummary.filter((item) => item.blocked);
  }

  allIpSummary.sort((a, b) => String(b.latestUpload || "").localeCompare(String(a.latestUpload || "")));

  const ipTotal = allIpSummary.length;
  const ipTotalPages = Math.max(Math.ceil(ipTotal / ipPageSize), 1);
  const ipStart = (ipPage - 1) * ipPageSize;
  const ipSummary = allIpSummary.slice(ipStart, ipStart + ipPageSize);

  return jsonResponse(request, env, {
    keys: filteredFiles,
    items: filteredFiles,
    total: resultFiles.length,
    filtered: filteredFiles.length,
    filters: {
      ip: filterIp || null,
      ip_hash: filterIpHash || null,
      country: filterCountry || null,
      region: filterRegion || null,
      city: filterCity || null,
      status: filterStatus || null,
      risk: filterRisk || null,
      include_expired: includeExpired
    },
    ipSummary,
    ipSummaryPagination: {
      items: ipSummary,
      page: ipPage,
      page_size: ipPageSize,
      total: ipTotal,
      total_pages: ipTotalPages,
      q: ipQ || null,
      blockedOnly: ipBlockedOnly
    }
  });
}

async function handleSecurityLogs(request, env, url) {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 500);
  const date = url.searchParams.get("date") || datePart();
  const prefix = `${UPLOAD_LOG_PREFIX}${date}/`;
  const objects = await env.R2_BUCKET.list({ prefix, limit });

  const logs = [];
  for (const obj of objects.objects) {
    const data = await getJsonObject(env, obj.key, null);
    if (data) logs.push({ key: obj.key, ...data });
  }

  const filterIp = String(url.searchParams.get("ip") || "").trim();
  const filterIpHash = String(url.searchParams.get("ip_hash") || "").trim();
  const filteredLogs = logs.filter((log) => {
    if (filterIp && log.ip !== filterIp) return false;
    if (filterIpHash && log.ipHash !== filterIpHash) return false;
    return true;
  });

  filteredLogs.sort((a, b) => String(b.loggedAt || "").localeCompare(String(a.loggedAt || "")));

  return jsonResponse(request, env, { logs: filteredLogs, date, limit, filters: { ip: filterIp || null, ip_hash: filterIpHash || null } });
}

async function handleBlockedIps(request, env) {
  const objects = await env.R2_BUCKET.list({ prefix: BLOCKED_IP_PREFIX, limit: 1000 });
  const blocked = [];

  for (const obj of objects.objects) {
    const data = await getJsonObject(env, obj.key, {});
    blocked.push({
      ip_hash: obj.key.replace(BLOCKED_IP_PREFIX, "").replace(/\.json$/, ""),
      ...data
    });
  }

  return jsonResponse(request, env, { blocked });
}

async function handleBlockIp(request, env) {
  const body = await request.json();
  const rawIp = String(body.ip || "").trim();
  const rawHash = String(body.ip_hash || "").trim();

  if (!rawIp && !rawHash) {
    return jsonResponse(request, env, { error: "缺少 ip 或 ip_hash" }, 400);
  }

  const hash = rawHash || await ipHash(rawIp);
  const blockedData = {
    ip: rawIp || null,
    ip_hash: hash,
    note: body.note || "",
    created_at: new Date().toISOString()
  };

  await setIpBlocked(env, hash, blockedData);
  await d1SetBlockedIp(env, {
    ipHash: hash,
    ip: rawIp || null,
    note: body.note || "",
    createdAt: blockedData.created_at
  });

  return jsonResponse(request, env, { success: true, ip: rawIp || null, ip_hash: hash });
}

async function handleBlockFileIp(request, env) {
  const body = await request.json();
  const fileKey = String(body.key || "").trim();

  if (!fileKey) {
    return jsonResponse(request, env, { error: "缺少图片 key" }, 400);
  }

  if (shouldHideInternalObject(fileKey) || fileKey.startsWith("_audited/") || fileKey.startsWith(SUSPICIOUS_PREFIX)) {
    return jsonResponse(request, env, { error: "不能根据内部文件拉黑 IP" }, 400);
  }

  const indexData = await getUploadIndex(env, fileKey);
  const object = await env.R2_BUCKET.get(fileKey);
  const hash = indexData?.ipHash || object?.customMetadata?.ip_hash || "";

  if (!hash || hash === "admin") {
    return jsonResponse(request, env, { error: "该图片没有可拉黑的上传 IP" }, 400);
  }

  const blockedData = {
    ip: indexData?.ip || null,
    ip_hash: hash,
    note: body.note || `从图片 ${fileKey} 拉黑`,
    source_key: fileKey,
    created_at: new Date().toISOString()
  };

  await setIpBlocked(env, hash, blockedData);
  await d1SetBlockedIp(env, {
    ipHash: hash,
    ip: indexData?.ip || null,
    note: blockedData.note,
    sourceKey: fileKey,
    createdAt: blockedData.created_at
  });

  return jsonResponse(request, env, {
    success: true,
    key: fileKey,
    ip: indexData?.ip || null,
    ip_hash: hash
  });
}

async function handleUnblockIp(request, env) {
  const body = await request.json();
  const rawIp = String(body.ip || "").trim();
  const rawHash = String(body.ip_hash || "").trim();

  if (!rawIp && !rawHash) {
    return jsonResponse(request, env, { error: "缺少 ip 或 ip_hash" }, 400);
  }

  const hash = rawHash || await ipHash(rawIp);
  await removeIpBlocked(env, hash);
  await d1RemoveBlockedIp(env, hash);

  return jsonResponse(request, env, { success: true, ip_hash: hash });
}

async function resolveHighRiskSourceData(env, body = {}) {
  const sourceKey = String(body.key || body.source_key || "").trim();
  let row = null;
  let indexData = null;
  let object = null;

  if (sourceKey) {
    indexData = await getUploadIndex(env, sourceKey);
    try {
      object = await env.R2_BUCKET.get(sourceKey);
    } catch (e) {
      object = null;
    }
    if (hasD1(env)) {
      try {
        row = await d1First(env, `
          SELECT r2_key, ip, ip_hash, user_agent, vip_id
          FROM images
          WHERE r2_key = ?
          LIMIT 1
        `, [sourceKey]);
      } catch (e) {
        row = null;
      }
    }
  }

  const ip = String(body.ip || row?.ip || indexData?.ip || "").trim();
  const ipHashValue = String(body.ip_hash || body.ipHash || row?.ip_hash || indexData?.ipHash || object?.customMetadata?.ip_hash || "").trim()
    || (ip ? await ipHash(ip) : "");
  const userAgent = String(body.user_agent || body.userAgent || row?.user_agent || indexData?.userAgent || "").trim();
  const deviceHash = String(body.device_hash || body.deviceHash || indexData?.deviceHash || indexData?.device_hash || "").trim()
    || await deviceHashFromUserAgent(userAgent);

  return {
    sourceKey,
    ip: ip || null,
    ipHash: ipHashValue || null,
    deviceHash: deviceHash || null,
    userAgent: userAgent || null
  };
}

async function deleteImageKeys(env, keys) {
  const safeKeys = (Array.isArray(keys) ? keys : [])
    .map((key) => String(key || ""))
    .filter((key) => key && !shouldHideInternalObject(key) && !key.startsWith("_audited/") && !key.startsWith(SUSPICIOUS_PREFIX));

  if (!safeKeys.length) return { count: 0, keys: [] };

  const deletePromises = safeKeys.flatMap((key) => [
    env.R2_BUCKET.delete(key),
    env.R2_BUCKET.delete(`_audited/${key}`),
    env.R2_BUCKET.delete(`${SUSPICIOUS_PREFIX}${key}.json`),
    deleteUploadIndex(env, key)
  ]);

  await Promise.all(deletePromises);
  await d1MarkImagesDeleted(env, safeKeys);
  await Promise.all(safeKeys.map((key) => d1LogEvent(env, {
    r2Key: key,
    eventType: "delete"
  })));

  return { count: safeKeys.length, keys: safeKeys };
}


function isExpiredIso(expiresAt, nowMs = Date.now()) {
  if (!expiresAt) return false;
  const time = new Date(expiresAt).getTime();
  return Number.isFinite(time) && time <= nowMs;
}

function isTemporaryImageDuration(duration) {
  return duration === "1-day" || duration === "7-day" || duration === "30-day";
}

function isTemporaryImageFolder(folder) {
  return folder === "1-day" || folder === "7-day" || folder === "30-day";
}

function durationFromR2Key(key) {
  const folder = folderFromKey(key);
  return isTemporaryImageFolder(folder) ? folder : null;
}

function isPermanentOrPersonalImage(row) {
  if (!row) return true;
  if (Number(row.is_personal || 0) === 1) return true;
  if (row.folder === "personal") return true;
  if (row.folder === "permanent") return true;
  if (row.duration === "personal") return true;
  if (row.duration === "permanent") return true;
  if (row.vip_id) return true;
  return false;
}

function isExpiredD1Image(row, nowMs = Date.now()) {
  if (!row || !row.r2_key) return false;
  if (isPermanentOrPersonalImage(row)) return false;

  if (isExpiredIso(row.expires_at, nowMs)) return true;

  const uploadedAt = row.uploaded_at || row.created_at;
  if (!uploadedAt) return false;

  const folder = row.folder || folderFromKey(row.r2_key);
  const duration = row.duration || folder;

  if (!isTemporaryImageDuration(duration) && !isTemporaryImageFolder(folder)) {
    return false;
  }

  const expiresAt = calculateExpiresAt(duration, uploadedAt) || calculateExpiresAt(folder, uploadedAt);
  return isExpiredIso(expiresAt, nowMs);
}

function isExpiredR2Object(obj, nowMs = Date.now()) {
  if (!obj?.key || shouldHideInternalObject(obj.key)) return false;

  const duration = durationFromR2Key(obj.key);
  if (!duration) return false;

  const uploadedAt = obj.uploaded;
  if (!uploadedAt) return false;

  return isExpiredIso(calculateExpiresAt(duration, uploadedAt), nowMs);
}

function isExpiredAdminFile(file, nowMs = Date.now()) {
  if (!file) return false;
  if (file.isPersonal) return false;
  if (String(file.key || "").startsWith("personal/")) return false;
  if (String(file.key || "").startsWith("permanent/")) return false;
  if (file.duration === "personal" || file.duration === "permanent") return false;
  if (file.vipId) return false;

  if (isExpiredIso(file.expiresAt || file.expires_at, nowMs)) return true;

  const duration = file.duration || folderFromKey(file.key);
  const uploadedAt = file.loggedAt || file.uploaded || file.uploaded_at;
  if (!uploadedAt) return false;

  return isExpiredIso(calculateExpiresAt(duration, uploadedAt), nowMs);
}

async function cleanupExpiredD1Images(env, options = {}) {
  if (!hasD1(env)) {
    return {
      source: "d1",
      skipped: true,
      checked: 0,
      deleted: 0,
      keys: [],
      reason: "D1 binding DB not found"
    };
  }

  const batchSize = Math.min(Math.max(Number(options.batchSize || 500), 50), 1000);
  const maxBatches = Math.min(Math.max(Number(options.maxBatches || 50), 1), 100);
  const nowMs = Date.now();

  let checked = 0;
  let deleted = 0;
  const deletedKeys = [];

  for (let batch = 0; batch < maxBatches; batch++) {
    const rows = await d1All(env, `
      SELECT
        r2_key,
        folder,
        duration,
        uploaded_at,
        created_at,
        expires_at,
        is_personal,
        vip_id
      FROM images
      WHERE status != 'deleted'
        AND COALESCE(folder, '') NOT IN ('personal', 'permanent')
        AND COALESCE(duration, '') NOT IN ('personal', 'permanent')
        AND COALESCE(is_personal, 0) != 1
        AND vip_id IS NULL
        AND (
          expires_at IS NOT NULL
          OR folder IN ('1-day', '7-day', '30-day')
          OR duration IN ('1-day', '7-day', '30-day')
        )
      ORDER BY COALESCE(expires_at, uploaded_at, created_at) ASC
      LIMIT ?
    `, [batchSize]);

    checked += rows.length;
    if (!rows.length) break;

    const expiredKeys = rows
      .filter((row) => isExpiredD1Image(row, nowMs))
      .map((row) => row.r2_key)
      .filter(Boolean);

    if (!expiredKeys.length) break;

    const result = await deleteImageKeys(env, expiredKeys);
    deleted += Number(result.count || 0);
    deletedKeys.push(...(result.keys || []));

    await Promise.all((result.keys || []).map((key) => d1LogEvent(env, {
      r2Key: key,
      eventType: "expired_cleanup",
      createdAt: new Date().toISOString()
    })));

    if (rows.length < batchSize) break;
  }

  return {
    source: "d1",
    checked,
    deleted,
    keys: deletedKeys.slice(0, 100)
  };
}

async function cleanupExpiredR2Images(env, options = {}) {
  const prefixes = ["1-day/", "7-day/", "30-day/"];
  const maxDelete = Math.min(Math.max(Number(options.maxDelete || 5000), 100), 20000);
  const nowMs = Date.now();

  let checked = 0;
  const expiredKeys = [];

  for (const prefix of prefixes) {
    let cursor = undefined;

    do {
      const listed = await env.R2_BUCKET.list({
        prefix,
        cursor,
        limit: 1000
      });

      for (const obj of listed.objects || []) {
        checked += 1;
        if (expiredKeys.length >= maxDelete) break;

        if (isExpiredR2Object(obj, nowMs)) {
          expiredKeys.push(obj.key);
        }
      }

      if (expiredKeys.length >= maxDelete) break;
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    if (expiredKeys.length >= maxDelete) break;
  }

  if (!expiredKeys.length) {
    return {
      source: "r2",
      checked,
      deleted: 0,
      keys: []
    };
  }

  const result = await deleteImageKeys(env, expiredKeys);

  await Promise.all((result.keys || []).map((key) => d1LogEvent(env, {
    r2Key: key,
    eventType: "expired_cleanup_r2",
    createdAt: new Date().toISOString()
  })));

  return {
    source: "r2",
    checked,
    deleted: Number(result.count || 0),
    keys: (result.keys || []).slice(0, 100)
  };
}

async function cleanupExpiredImages(env, options = {}) {
  const startedAt = new Date().toISOString();

  const d1 = await cleanupExpiredD1Images(env, {
    batchSize: options.batchSize || 500,
    maxBatches: options.maxBatches || 50
  });

  const r2 = await cleanupExpiredR2Images(env, {
    maxDelete: options.maxDelete || 5000
  });

  const result = {
    success: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    deleted: Number(d1.deleted || 0) + Number(r2.deleted || 0),
    d1,
    r2
  };

  console.log("expired cleanup result:", JSON.stringify(result));
  return result;
}

async function handleCleanupExpiredImages(request, env, url) {
  const batchSize = Math.min(Math.max(Number(url.searchParams.get("batch_size") || 500), 50), 1000);
  const maxBatches = Math.min(Math.max(Number(url.searchParams.get("max_batches") || 50), 1), 100);
  const maxDelete = Math.min(Math.max(Number(url.searchParams.get("max_delete") || 5000), 100), 20000);

  const result = await cleanupExpiredImages(env, {
    batchSize,
    maxBatches,
    maxDelete
  });

  return jsonResponse(request, env, result);
}

function clampD1EventRetentionDays(value) {
  const days = Number(value);
  if (!Number.isFinite(days)) return 90;
  return Math.max(30, Math.min(365, Math.floor(days)));
}

async function cleanupD1History(env, options = {}) {
  if (!hasD1(env)) {
    return {
      success: false,
      skipped: true,
      reason: "D1 binding DB not found",
      images_deleted: 0,
      events_deleted: 0,
      events_for_deleted_images: 0,
      vacuumed: false
    };
  }

  const eventRetentionDays = clampD1EventRetentionDays(options.event_retention_days);
  const purgeDeletedImages = options.purge_deleted_images !== false;
  const cutoff = `-${eventRetentionDays} days`;
  const startedAt = new Date().toISOString();

  let imagesDeleted = 0;
  let eventsForDeletedImages = 0;
  let eventsDeleted = 0;
  let vacuumed = false;

  if (purgeDeletedImages) {
    const eventsForDeletedResult = await env.DB.prepare(`
      DELETE FROM upload_events
      WHERE r2_key IN (SELECT r2_key FROM images WHERE status = 'deleted')
    `).run();
    eventsForDeletedImages = Number(eventsForDeletedResult.meta?.changes || 0);

    const imagesResult = await env.DB.prepare(`
      DELETE FROM images WHERE status = 'deleted'
    `).run();
    imagesDeleted = Number(imagesResult.meta?.changes || 0);
  }

  const eventsResult = await env.DB.prepare(`
    DELETE FROM upload_events
    WHERE created_at < datetime('now', ?)
  `).bind(cutoff).run();
  eventsDeleted = Number(eventsResult.meta?.changes || 0);

  try {
    await env.DB.prepare("VACUUM").run();
    vacuumed = true;
  } catch (error) {
    console.warn("D1 VACUUM skipped:", error && error.message ? error.message : error);
  }

  const result = {
    success: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    images_deleted: imagesDeleted,
    events_for_deleted_images: eventsForDeletedImages,
    events_deleted: eventsDeleted,
    event_retention_days: eventRetentionDays,
    purge_deleted_images: purgeDeletedImages,
    vacuumed
  };

  console.log("D1 history cleanup result:", JSON.stringify(result));
  return result;
}

async function handleCleanupD1History(request, env, url) {
  let body = {};
  try {
    body = await request.json();
  } catch (error) {
    body = {};
  }

  const eventRetentionDays = clampD1EventRetentionDays(
    body.event_retention_days ?? url.searchParams.get("event_retention_days")
  );
  const purgeDeletedImages = body.purge_deleted_images !== false
    && url.searchParams.get("purge_deleted_images") !== "0";

  const result = await cleanupD1History(env, {
    event_retention_days: eventRetentionDays,
    purge_deleted_images: purgeDeletedImages
  });

  return jsonResponse(request, env, result, result.success ? 200 : 500);
}

async function handleHighRiskUsers(request, env) {
  const users = await d1ListHighRiskUsers(env);
  return jsonResponse(request, env, { users });
}

async function handleMarkHighRiskUser(request, env) {
  const body = await request.json();
  const source = await resolveHighRiskSourceData(env, body);

  if (!source.ipHash && !source.deviceHash) {
    return jsonResponse(request, env, { error: "缺少可标记的 IPHash 或设备码" }, 400);
  }

  const reason = String(body.reason || "manual_high_risk").trim();
  const note = String(body.note || "").trim();
  const createdAt = new Date().toISOString();
  const id = `risk:${source.ipHash || "noip"}:${source.deviceHash || "nodev"}`;

  const record = {
    id,
    ip: source.ip,
    ipHash: source.ipHash,
    deviceHash: source.deviceHash,
    userAgent: source.userAgent,
    sourceKey: source.sourceKey || null,
    reason,
    note,
    createdAt,
    updatedAt: createdAt,
    active: 1
  };

  await d1SetHighRiskUser(env, record);
  await setHighRiskUserR2(env, {
    id,
    ip: source.ip,
    ip_hash: source.ipHash,
    device_hash: source.deviceHash,
    user_agent: source.userAgent,
    source_key: source.sourceKey || null,
    reason,
    note,
    active: 1,
    created_at: createdAt,
    updated_at: createdAt
  });

  let deleted = { count: 0, keys: [] };
  if (body.delete_image && source.sourceKey) {
    deleted = await deleteImageKeys(env, [source.sourceKey]);
  }

  await d1LogEvent(env, {
    r2Key: source.sourceKey || null,
    ip: source.ip,
    ipHash: source.ipHash,
    eventType: body.delete_image ? "mark_high_risk_delete" : "mark_high_risk",
    risk: "high_risk",
    riskReasons: [reason],
    createdAt
  });

  return jsonResponse(request, env, {
    success: true,
    user: record,
    deleted
  });
}

async function handleUnmarkHighRiskUser(request, env) {
  const body = await request.json();
  const id = String(body.id || "").trim();
  if (!id) return jsonResponse(request, env, { error: "缺少高危用户 ID" }, 400);

  await d1DeactivateHighRiskUser(env, id);
  await removeHighRiskUserR2(env, id);

  return jsonResponse(request, env, { success: true, id });
}


async function handleAudit(request, env) {
  const body = await request.json();
  if (!body.keys || !Array.isArray(body.keys)) {
    return jsonResponse(request, env, { error: "缺少主键" }, 400);
  }

  const keys = body.keys
    .map((key) => String(key || ""))
    .filter((key) => key && !shouldHideInternalObject(key) && !key.startsWith("_audited/") && !key.startsWith(SUSPICIOUS_PREFIX));

  if (keys.length === 0) {
    return jsonResponse(request, env, { error: "没有可审核的图片" }, 400);
  }

  const auditTasks = keys.flatMap((key) => [
    env.R2_BUCKET.put(`_audited/${key}`, "ok"),
    // 关键修复：可疑图片一旦人工审核通过，就删除可疑标记。
    // 否则刷新列表时，status 会再次被 _suspicious/ 标记覆盖成 suspicious。
    env.R2_BUCKET.delete(`${SUSPICIOUS_PREFIX}${key}.json`),
    clearUploadRisk(env, key)
  ]);

  await Promise.all(auditTasks);
  await d1MarkImagesAudited(env, keys);
  await Promise.all(keys.map((key) => d1LogEvent(env, {
    r2Key: key,
    eventType: "audit",
    risk: "normal"
  })));

  return jsonResponse(request, env, { success: true, count: keys.length });
}

async function handleDelete(request, env) {
  const body = await request.json();
  if (!body.keys || !Array.isArray(body.keys)) {
    return jsonResponse(request, env, { error: "缺少主键" }, 400);
  }

  const deleted = await deleteImageKeys(env, body.keys);
  if (!deleted.count) {
    return jsonResponse(request, env, { error: "没有可删除的图片" }, 400);
  }

  return jsonResponse(request, env, { success: true, count: deleted.count });
}

async function handleVipList(request, env) {
  const vips = await getVipConfig(env);
  return jsonResponse(request, env, { vips });
}

async function handleVipAdd(request, env) {
  const body = await request.json();
  const code = String(body.code || "").trim();
  const email = normalizeEmail(body.email);

  if (!code) {
    return jsonResponse(request, env, { error: "缺少激活码" }, 400);
  }
  if (!isValidEmail(email)) {
    return jsonResponse(request, env, { error: "请输入有效的认证邮箱" }, 400);
  }

  let vips = await getVipConfig(env);
  if (vips.find((v) => v.code === code)) {
    return jsonResponse(request, env, { error: "已存在" }, 400);
  }

  const vipRecord = {
    code,
    note: body.note || "",
    email,
    emailVerified: toFlag(body.email_verified, false),
    emailVerifiedAt: toFlag(body.email_verified, false) ? new Date().toISOString() : null,
    created_at: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
  };

  await d1UpsertVipCode(env, {
    code,
    note: body.note || "",
    email: vipRecord.email,
    emailVerified: vipRecord.emailVerified,
    emailVerifiedAt: vipRecord.emailVerifiedAt,
    createdAt: new Date().toISOString()
  });

  return jsonResponse(request, env, { success: true });
}

async function handleVipUpdate(request, env) {
  const body = await request.json();
  const code = String(body.code || "").trim();
  const email = normalizeEmail(body.email);
  if (!code) return jsonResponse(request, env, { error: "缺少长期存储码" }, 400);
  if (!isValidEmail(email)) return jsonResponse(request, env, { error: "请输入有效的认证邮箱" }, 400);

  const vips = await getVipConfig(env);
  const current = vips.find((vip) => vip.code === code);
  if (!current) return jsonResponse(request, env, { error: "未找到该长期存储码" }, 404);

  const emailVerified = toFlag(body.email_verified, false);
  const emailChanged = normalizeEmail(current.email) !== email;
  const emailVerifiedAt = emailVerified
    ? (!emailChanged && current.email_verified_at ? current.email_verified_at : new Date().toISOString())
    : null;
  await d1UpsertVipCode(env, {
    code,
    note: truncate(body.note ?? current.note ?? "", 300),
    email,
    emailVerified,
    emailVerifiedAt,
    createdAt: current.created_at || new Date().toISOString()
  });
  return jsonResponse(request, env, { success: true });
}

async function handleVipDel(request, env) {
  const body = await request.json();
  const code = String(body.code || "").trim();

  if (!code) {
    return jsonResponse(request, env, { error: "缺少激活码" }, 400);
  }

  const vips = await getVipConfig(env);
  const nextVips = vips.filter((v) => v.code !== code);

  if (nextVips.length === vips.length) {
    return jsonResponse(request, env, { error: "未找到该 VIP 码" }, 404);
  }

  await d1DeactivateVipCode(env, code);

  return jsonResponse(request, env, { success: true });
}

function isValidApiUserCode(code) {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(code);
}

async function handleApiUserList(request, env) {
  if (!hasD1(env)) {
    return jsonResponse(request, env, { error: "API 用户管理需要 D1 数据库" }, 503);
  }

  await ensureApiSchema(env);
  const dateInfo = apiUsageDateInfo();
  const rows = await d1All(env, `
    SELECT u.*,
           COALESCE(d.temporary_count, 0) AS temporary_used_today,
           COALESCE(d.permanent_count, 0) AS permanent_uploaded_today
    FROM api_users u
    LEFT JOIN api_daily_usage d
      ON d.api_user_id = u.id
     AND d.usage_date = ?
    ORDER BY u.created_at DESC
  `, [dateInfo.usageDate]);

  return jsonResponse(request, env, {
    success: true,
    users: rows.map((row) => apiUserPayload(row, {
      temporaryCount: Number(row.temporary_used_today || 0),
      permanentCount: Number(row.permanent_uploaded_today || 0)
    }, dateInfo)),
    presets: apiPlanPresetPayload()
  });
}

async function handleApiUserCreate(request, env) {
  if (!hasD1(env)) {
    return jsonResponse(request, env, { error: "API 用户管理需要 D1 数据库" }, 503);
  }

  await ensureApiSchema(env);
  const body = await request.json();
  const code = String(body.code || "").trim();
  if (!isValidApiUserCode(code)) {
    return jsonResponse(request, env, {
      error: "用户标识需为 3-64 位字母、数字、下划线或短横线，且必须以字母或数字开头"
    }, 400);
  }

  const normalized = normalizeApiUserInput(body);
  if (!normalized.ok) return jsonResponse(request, env, { error: normalized.error }, 400);

  const apiKey = generateApiKey();
  const keyHash = await sha256Hex(apiKey);
  const keyPrefix = apiKeyPrefix(apiKey);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const value = normalized.value;

  try {
    await env.DB.prepare(`
      INSERT INTO api_users (
        id, code, note, email, email_verified, email_verified_at,
        key_prefix, key_hash, plan_type,
        allow_temporary, temporary_daily_limit,
        allow_permanent, permanent_quota_total, permanent_quota_used,
        payment_status, price_cents, payment_note,
        active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      code,
      truncate(body.note || "", 300),
      value.email,
      value.emailVerified ? 1 : 0,
      value.emailVerified ? now : null,
      keyPrefix,
      keyHash,
      value.planType,
      value.allowTemporary ? 1 : 0,
      value.temporaryDailyLimit,
      value.allowPermanent ? 1 : 0,
      value.permanentQuotaTotal,
      value.paymentStatus,
      value.priceCents,
      value.paymentNote,
      value.active ? 1 : 0,
      now,
      now
    ).run();
  } catch (error) {
    const message = String(error?.message || error);
    const duplicate = /UNIQUE|constraint/i.test(message);
    return jsonResponse(request, env, {
      error: duplicate ? "用户标识已存在" : "创建 API 用户失败"
    }, duplicate ? 409 : 500);
  }

  const row = await d1First(env, "SELECT * FROM api_users WHERE id = ?", [id]);
  return jsonResponse(request, env, {
    success: true,
    user: apiUserPayload(row),
    api_key: apiKey,
    api_key_notice: "API Key 明文只返回这一次，请立即安全保存。"
  }, 201);
}

async function handleApiUserUpdate(request, env) {
  if (!hasD1(env)) {
    return jsonResponse(request, env, { error: "API 用户管理需要 D1 数据库" }, 503);
  }

  await ensureApiSchema(env);
  const body = await request.json();
  const id = String(body.id || "").trim();
  if (!id) return jsonResponse(request, env, { error: "缺少 API 用户 ID" }, 400);

  const current = await d1First(env, "SELECT * FROM api_users WHERE id = ?", [id]);
  if (!current) return jsonResponse(request, env, { error: "API 用户不存在" }, 404);

  const normalized = normalizeApiUserInput(body, current);
  if (!normalized.ok) return jsonResponse(request, env, { error: normalized.error }, 400);
  const value = normalized.value;
  const permanentUsed = Number(current.permanent_quota_used || 0);
  if (value.allowPermanent && value.permanentQuotaTotal < permanentUsed) {
    return jsonResponse(request, env, {
      error: `永久总额度不能低于已使用数量 ${permanentUsed}`
    }, 400);
  }

  const storedPermanentTotal = value.allowPermanent
    ? value.permanentQuotaTotal
    : Math.max(permanentUsed, 0);
  const now = new Date().toISOString();
  const emailChanged = normalizeEmail(current.email) !== value.email;
  const emailVerifiedAt = value.emailVerified
    ? (!emailChanged && current.email_verified_at ? current.email_verified_at : now)
    : null;

  await env.DB.prepare(`
    UPDATE api_users
    SET note = ?,
        email = ?,
        email_verified = ?,
        email_verified_at = ?,
        plan_type = ?,
        allow_temporary = ?,
        temporary_daily_limit = ?,
        allow_permanent = ?,
        permanent_quota_total = ?,
        payment_status = ?,
        price_cents = ?,
        payment_note = ?,
        active = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(
    truncate(body.note ?? current.note ?? "", 300),
    value.email,
    value.emailVerified ? 1 : 0,
    emailVerifiedAt,
    value.planType,
    value.allowTemporary ? 1 : 0,
    value.temporaryDailyLimit,
    value.allowPermanent ? 1 : 0,
    storedPermanentTotal,
    value.paymentStatus,
    value.priceCents,
    value.paymentNote,
    value.active ? 1 : 0,
    now,
    id
  ).run();

  const row = await d1First(env, "SELECT * FROM api_users WHERE id = ?", [id]);
  const usage = await getApiUsage(env, id);
  return jsonResponse(request, env, {
    success: true,
    user: apiUserPayload(row, usage)
  });
}

async function handleApiUserRotateKey(request, env) {
  if (!hasD1(env)) {
    return jsonResponse(request, env, { error: "API 用户管理需要 D1 数据库" }, 503);
  }

  await ensureApiSchema(env);
  const body = await request.json();
  const id = String(body.id || "").trim();
  if (!id) return jsonResponse(request, env, { error: "缺少 API 用户 ID" }, 400);

  const current = await d1First(env, "SELECT id FROM api_users WHERE id = ?", [id]);
  if (!current) return jsonResponse(request, env, { error: "API 用户不存在" }, 404);

  const apiKey = generateApiKey();
  await env.DB.prepare(`
    UPDATE api_users
    SET key_prefix = ?, key_hash = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    apiKeyPrefix(apiKey),
    await sha256Hex(apiKey),
    new Date().toISOString(),
    id
  ).run();

  return jsonResponse(request, env, {
    success: true,
    api_key: apiKey,
    key_prefix: apiKeyPrefix(apiKey),
    api_key_notice: "旧 Key 已立即失效；新 Key 明文只返回这一次。"
  });
}

async function handleApiUserResetDaily(request, env) {
  if (!hasD1(env)) {
    return jsonResponse(request, env, { error: "API 用户管理需要 D1 数据库" }, 503);
  }

  await ensureApiSchema(env);
  const body = await request.json();
  const id = String(body.id || "").trim();
  if (!id) return jsonResponse(request, env, { error: "缺少 API 用户 ID" }, 400);

  const dateInfo = apiUsageDateInfo();
  await env.DB.prepare(`
    DELETE FROM api_daily_usage
    WHERE api_user_id = ? AND usage_date = ?
  `).bind(id, dateInfo.usageDate).run();

  return jsonResponse(request, env, {
    success: true,
    usage_date: dateInfo.usageDate,
    reset_at: dateInfo.resetAt
  });
}


async function handleCaptcha(request, env) {
  const ctx = getRequestContext(request);
  const hash = await ipHash(ctx.ip);

  if (await isIpBlocked(env, hash)) {
    return jsonResponse(request, env, { error: "上传权限已被限制" }, 403);
  }

  // 获取验证码也限制频率，避免脚本无限刷题。
  const rateCheck = await checkUploadRate(env, `captcha-${hash}`, 1);
  if (!rateCheck.ok) {
    return jsonResponse(request, env, { error: "验证请求过于频繁，请稍后再试。" }, 429);
  }
  await commitUploadRate(env, rateCheck);

  const captcha = await createCaptcha(env, request);
  return jsonResponse(request, env, { success: true, ...captcha });
}


// ==============================
// D1 同步层：第一阶段只做“写入/同步”，不影响旧 R2 后台逻辑
// 绑定名要求：DB
// ==============================
function hasD1(env) {
  return Boolean(env && env.DB && typeof env.DB.prepare === "function");
}

async function d1Run(env, sql, params = []) {
  if (!hasD1(env)) return { ok: false, skipped: true, reason: "D1 binding DB not found" };

  try {
    await env.DB.prepare(sql).bind(...params).run();
    return { ok: true };
  } catch (error) {
    console.error("D1 sync failed:", error && error.message ? error.message : error);
    return { ok: false, error: error && error.message ? error.message : String(error) };
  }
}

async function d1First(env, sql, params = []) {
  if (!hasD1(env)) throw new Error("D1 binding DB not found");
  return env.DB.prepare(sql).bind(...params).first();
}

async function d1All(env, sql, params = []) {
  if (!hasD1(env)) throw new Error("D1 binding DB not found");
  const result = await env.DB.prepare(sql).bind(...params).all();
  return result?.results || [];
}

async function ensureImageApiColumns(env) {
  const addColumn = async (columnName, definition) => {
    let columns = await d1All(env, "PRAGMA table_info(images)");
    if (columns.some((column) => column.name === columnName)) return;

    try {
      await env.DB.prepare(`ALTER TABLE images ADD COLUMN ${definition}`).run();
    } catch (error) {
      // 并发请求可能已经完成同一迁移；复查后再决定是否抛错。
      columns = await d1All(env, "PRAGMA table_info(images)");
      if (!columns.some((column) => column.name === columnName)) throw error;
    }
  };

  await addColumn("upload_source", "upload_source TEXT NOT NULL DEFAULT 'web'");
  await addColumn("api_user_id", "api_user_id TEXT");
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_images_api_review ON images(upload_source, status, uploaded_at)"
  ).run();
}

const apiSchemaPromises = new WeakMap();
const vipSchemaPromises = new WeakMap();

async function ensureVipSchema(env) {
  if (!hasD1(env)) throw new Error("D1 binding DB not found");
  if (vipSchemaPromises.has(env.DB)) return vipSchemaPromises.get(env.DB);

  const schemaPromise = (async () => {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS vip_codes (
        code TEXT PRIMARY KEY,
        note TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        email_verified INTEGER NOT NULL DEFAULT 0,
        email_verified_at TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).run();

    const addColumn = async (columnName, definition) => {
      let columns = await d1All(env, "PRAGMA table_info(vip_codes)");
      if (columns.some((column) => column.name === columnName)) return;
      try {
        await env.DB.prepare(`ALTER TABLE vip_codes ADD COLUMN ${definition}`).run();
      } catch (error) {
        columns = await d1All(env, "PRAGMA table_info(vip_codes)");
        if (!columns.some((column) => column.name === columnName)) throw error;
      }
    };

    await addColumn("email", "email TEXT NOT NULL DEFAULT ''");
    await addColumn("email_verified", "email_verified INTEGER NOT NULL DEFAULT 0");
    await addColumn("email_verified_at", "email_verified_at TEXT");
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_vip_codes_active ON vip_codes(active, updated_at)").run();
  })();

  vipSchemaPromises.set(env.DB, schemaPromise);
  try {
    await schemaPromise;
  } catch (error) {
    vipSchemaPromises.delete(env.DB);
    throw error;
  }
}

async function migrateLegacyVipConfigToD1(env) {
  const file = await env.R2_BUCKET.get(VIP_CONFIG_FILE);
  if (!file) return;

  const parsed = JSON.parse(await file.text());
  const records = Array.isArray(parsed) ? parsed : [];
  for (const record of records) {
    const code = String(record?.code || "").trim();
    if (!code) continue;
    const existing = await d1First(env, `
      SELECT code
      FROM vip_codes
      WHERE code = ?
      LIMIT 1
    `, [code]);
    if (existing) continue;

    const result = await d1UpsertVipCode(env, {
      code,
      note: record.note || "",
      email: isValidEmail(record.email) ? normalizeEmail(record.email) : "",
      emailVerified: Boolean(record.email_verified) && isValidEmail(record.email),
      emailVerifiedAt: record.email_verified_at || null,
      createdAt: record.created_at || record.createdAt || new Date().toISOString()
    });
    if (!result?.ok) throw new Error(`Failed to migrate VIP code ${code} to D1`);
  }

  // The legacy R2 object may be reachable through the public R2 domain.
  await env.R2_BUCKET.delete(VIP_CONFIG_FILE);
}

async function ensureApiSchema(env) {
  if (!hasD1(env)) throw new Error("D1 binding DB not found");
  if (apiSchemaPromises.has(env.DB)) return apiSchemaPromises.get(env.DB);

  const schemaPromise = (async () => {
    await env.DB.batch([
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS api_users (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL COLLATE NOCASE UNIQUE,
          note TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL DEFAULT '',
          email_verified INTEGER NOT NULL DEFAULT 0,
          email_verified_at TEXT,
          key_prefix TEXT NOT NULL,
          key_hash TEXT NOT NULL UNIQUE,
          plan_type TEXT NOT NULL,
          allow_temporary INTEGER NOT NULL DEFAULT 0,
          temporary_daily_limit INTEGER NOT NULL DEFAULT 0,
          allow_permanent INTEGER NOT NULL DEFAULT 0,
          permanent_quota_total INTEGER NOT NULL DEFAULT 0,
          permanent_quota_used INTEGER NOT NULL DEFAULT 0,
          payment_status TEXT NOT NULL DEFAULT 'unpaid',
          price_cents INTEGER NOT NULL DEFAULT 0,
          payment_note TEXT NOT NULL DEFAULT '',
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_used_at TEXT
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS api_daily_usage (
          api_user_id TEXT NOT NULL,
          usage_date TEXT NOT NULL,
          temporary_count INTEGER NOT NULL DEFAULT 0,
          permanent_count INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (api_user_id, usage_date),
          FOREIGN KEY (api_user_id) REFERENCES api_users(id)
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS api_idempotency (
          api_user_id TEXT NOT NULL,
          idempotency_key TEXT NOT NULL,
          request_fingerprint TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'processing',
          response_status INTEGER,
          response_body TEXT,
          response_headers TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (api_user_id, idempotency_key),
          FOREIGN KEY (api_user_id) REFERENCES api_users(id)
        )
      `),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_api_users_key_hash ON api_users(key_hash)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_api_users_active ON api_users(active, updated_at)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_api_daily_usage_date ON api_daily_usage(usage_date)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_api_idempotency_updated ON api_idempotency(updated_at)")
    ]);
    const addApiUserColumn = async (columnName, definition) => {
      let columns = await d1All(env, "PRAGMA table_info(api_users)");
      if (columns.some((column) => column.name === columnName)) return;
      try {
        await env.DB.prepare(`ALTER TABLE api_users ADD COLUMN ${definition}`).run();
      } catch (error) {
        columns = await d1All(env, "PRAGMA table_info(api_users)");
        if (!columns.some((column) => column.name === columnName)) throw error;
      }
    };
    await addApiUserColumn("email", "email TEXT NOT NULL DEFAULT ''");
    await addApiUserColumn("email_verified", "email_verified INTEGER NOT NULL DEFAULT 0");
    await addApiUserColumn("email_verified_at", "email_verified_at TEXT");
    await ensureImageApiColumns(env);
    await env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_images_api_user_uploaded ON images(api_user_id, upload_source, uploaded_at DESC)"
    ).run();
  })();

  apiSchemaPromises.set(env.DB, schemaPromise);
  try {
    await schemaPromise;
  } catch (error) {
    apiSchemaPromises.delete(env.DB);
    throw error;
  }
}

function apiUsageDateInfo(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: API_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const usageDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const resetAt = new Date(Date.UTC(year, month - 1, day + 1) - 8 * 60 * 60 * 1000).toISOString();
  return { usageDate, resetAt, timeZone: API_TIME_ZONE };
}

function toFlag(value, fallback = false) {
  if (value === undefined || value === null || value === "") return Boolean(fallback);
  if (typeof value === "string") return !["0", "false", "off", "no"].includes(value.toLowerCase());
  return Boolean(value);
}

function nonNegativeInteger(value, fallback = 0, max = 100000) {
  if (value === undefined || value === null || value === "") return Math.min(Math.max(Number(fallback) || 0, 0), max);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) return null;
  return parsed;
}

function normalizeApiUserInput(body = {}, current = null) {
  const requestedPlan = String(body.plan_type || current?.plan_type || "temporary_100").trim();
  const preset = API_PLAN_PRESETS[requestedPlan] || null;
  const planType = preset ? requestedPlan : "custom";

  const allowTemporary = toFlag(
    body.allow_temporary,
    preset ? preset.allowTemporary : Number(current?.allow_temporary || 0) === 1
  );
  const allowPermanent = toFlag(
    body.allow_permanent,
    preset ? preset.allowPermanent : Number(current?.allow_permanent || 0) === 1
  );
  const temporaryDailyLimit = nonNegativeInteger(
    body.temporary_daily_limit,
    preset ? preset.temporaryDailyLimit : current?.temporary_daily_limit
  );
  const permanentQuotaTotal = nonNegativeInteger(
    body.permanent_quota_total,
    preset ? preset.permanentQuotaTotal : current?.permanent_quota_total
  );
  const priceCents = nonNegativeInteger(
    body.price_cents,
    preset ? preset.priceCents : current?.price_cents,
    100000000
  );
  const paymentStatus = String(body.payment_status || current?.payment_status || "unpaid").trim();
  const email = normalizeEmail(body.email ?? current?.email);
  const emailVerified = toFlag(
    body.email_verified,
    current ? Number(current.email_verified || 0) === 1 : false
  );

  if (temporaryDailyLimit === null || permanentQuotaTotal === null || priceCents === null) {
    return { ok: false, error: "额度和价格必须是有效的非负整数" };
  }
  if (allowTemporary && temporaryDailyLimit < 1) {
    return { ok: false, error: "启用限时图片时，每日额度必须大于 0" };
  }
  if (allowPermanent && permanentQuotaTotal < 1) {
    return { ok: false, error: "启用永久图片时，永久总额度必须大于 0" };
  }
  if (!allowTemporary && !allowPermanent) {
    return { ok: false, error: "至少需要启用一种上传类型" };
  }
  if (!API_PAYMENT_STATUSES.has(paymentStatus)) {
    return { ok: false, error: "收费状态无效" };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: "请输入有效的认证邮箱" };
  }

  return {
    ok: true,
    value: {
      planType,
      allowTemporary,
      temporaryDailyLimit: allowTemporary ? temporaryDailyLimit : 0,
      allowPermanent,
      permanentQuotaTotal: allowPermanent ? permanentQuotaTotal : 0,
      paymentStatus,
      priceCents,
      paymentNote: truncate(body.payment_note ?? current?.payment_note ?? "", 300),
      email,
      emailVerified,
      active: toFlag(body.active, current ? Number(current.active || 0) === 1 : true)
    }
  };
}

function apiPlanPresetPayload() {
  return Object.entries(API_PLAN_PRESETS).map(([id, preset]) => ({
    id,
    label: preset.label,
    allow_temporary: preset.allowTemporary,
    temporary_daily_limit: preset.temporaryDailyLimit,
    allow_permanent: preset.allowPermanent,
    permanent_quota_total: preset.permanentQuotaTotal,
    price_cents: preset.priceCents
  }));
}

function generateApiKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return API_KEY_PREFIX + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function apiKeyPrefix(apiKey) {
  return String(apiKey || "").slice(0, API_KEY_PREFIX.length + 10);
}

function getUploadToken(request) {
  const direct = String(request.headers.get("X-Upload-Token") || "").trim();
  if (direct) return direct;
  const authorization = String(request.headers.get("Authorization") || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function getApiUserId(request) {
  return String(request.headers.get("X-API-User-ID") || "").trim();
}

async function authenticateApiUser(request, env) {
  if (!hasD1(env)) {
    return { ok: false, status: 503, error: "API 服务尚未绑定 D1 数据库", code: "API_DATABASE_UNAVAILABLE" };
  }

  await ensureApiSchema(env);
  const userId = getApiUserId(request);
  const token = getUploadToken(request);
  if (!userId) {
    return { ok: false, status: 401, error: "缺少 API 用户 ID", code: "MISSING_API_USER_ID" };
  }
  if (!token || !token.startsWith(API_KEY_PREFIX) || token.length < API_KEY_PREFIX.length + 30) {
    return { ok: false, status: 401, error: "缺少或无效的 API Key", code: "INVALID_API_CREDENTIALS" };
  }

  const keyHash = await sha256Hex(token);
  const user = await d1First(
    env,
    "SELECT * FROM api_users WHERE id = ? AND key_hash = ? LIMIT 1",
    [userId, keyHash]
  );
  if (!user) {
    return { ok: false, status: 401, error: "API 用户 ID 或 API Key 无效", code: "INVALID_API_CREDENTIALS" };
  }
  if (Number(user.active || 0) !== 1) {
    return { ok: false, status: 403, error: "API 用户已停用", code: "API_USER_DISABLED" };
  }
  if (!isValidEmail(user.email) || Number(user.email_verified || 0) !== 1) {
    return {
      ok: false,
      status: 403,
      error: "API 用户邮箱尚未完成管理员认证",
      code: "EMAIL_VERIFICATION_REQUIRED"
    };
  }
  return { ok: true, user };
}

async function getApiUsage(env, apiUserId, usageDate = apiUsageDateInfo().usageDate) {
  const row = await d1First(env, `
    SELECT temporary_count, permanent_count
    FROM api_daily_usage
    WHERE api_user_id = ? AND usage_date = ?
  `, [apiUserId, usageDate]);
  return {
    temporaryCount: Number(row?.temporary_count || 0),
    permanentCount: Number(row?.permanent_count || 0)
  };
}

function apiUserPayload(row, usage = { temporaryCount: 0, permanentCount: 0 }, dateInfo = apiUsageDateInfo()) {
  const dailyLimit = Number(row.temporary_daily_limit || 0);
  const permanentTotal = Number(row.permanent_quota_total || 0);
  const permanentUsed = Number(row.permanent_quota_used || 0);
  return {
    id: row.id,
    code: row.code,
    note: row.note || "",
    email: row.email || "",
    email_verified: Number(row.email_verified || 0) === 1,
    email_verified_at: row.email_verified_at || null,
    key_prefix: row.key_prefix,
    plan_type: row.plan_type,
    allow_temporary: Number(row.allow_temporary || 0) === 1,
    temporary_daily_limit: dailyLimit,
    temporary_used_today: usage.temporaryCount,
    temporary_remaining_today: Math.max(0, dailyLimit - usage.temporaryCount),
    allow_permanent: Number(row.allow_permanent || 0) === 1,
    permanent_quota_total: permanentTotal,
    permanent_quota_used: permanentUsed,
    permanent_quota_remaining: Math.max(0, permanentTotal - permanentUsed),
    permanent_uploaded_today: usage.permanentCount,
    payment_status: row.payment_status || "unpaid",
    price_cents: Number(row.price_cents || 0),
    payment_note: row.payment_note || "",
    active: Number(row.active || 0) === 1,
    usage_date: dateInfo.usageDate,
    reset_at: dateInfo.resetAt,
    timezone: dateInfo.timeZone,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_used_at: row.last_used_at || null
  };
}

function apiPublicUsagePayload(row, usage = { temporaryCount: 0, permanentCount: 0 }, dateInfo = apiUsageDateInfo()) {
  const dailyLimit = Number(row.temporary_daily_limit || 0);
  const temporaryUsed = Number(usage.temporaryCount || 0);
  const permanentTotal = Number(row.permanent_quota_total || 0);
  const permanentUsed = Number(row.permanent_quota_used || 0);
  return {
    user_id: row.id,
    plan_type: row.plan_type,
    temporary: {
      enabled: Number(row.allow_temporary || 0) === 1,
      limit: dailyLimit,
      used: temporaryUsed,
      remaining: Math.max(0, dailyLimit - temporaryUsed),
      reset_at: dateInfo.resetAt,
      timezone: dateInfo.timeZone
    },
    permanent: {
      enabled: Number(row.allow_permanent || 0) === 1,
      limit: permanentTotal,
      used: permanentUsed,
      remaining: Math.max(0, permanentTotal - permanentUsed)
    },
    usage_date: dateInfo.usageDate
  };
}

function apiPublicAccountPayload(row, usage = { temporaryCount: 0, permanentCount: 0 }, dateInfo = apiUsageDateInfo()) {
  const quota = apiPublicUsagePayload(row, usage, dateInfo);
  return {
    id: quota.user_id,
    plan_type: quota.plan_type,
    allow_temporary: quota.temporary.enabled,
    temporary_daily_limit: quota.temporary.limit,
    temporary_used_today: quota.temporary.used,
    temporary_remaining_today: quota.temporary.remaining,
    allow_permanent: quota.permanent.enabled,
    permanent_quota_total: quota.permanent.limit,
    permanent_quota_used: quota.permanent.used,
    permanent_quota_remaining: quota.permanent.remaining,
    usage_date: quota.usage_date,
    reset_at: quota.temporary.reset_at,
    timezone: quota.temporary.timezone
  };
}

function parseApiIdempotencyKey(request) {
  if (!request.headers.has("Idempotency-Key")) return { ok: true, key: null };

  const key = String(request.headers.get("Idempotency-Key") || "").trim();
  if (!key || key.length > API_IDEMPOTENCY_MAX_LENGTH || !/^[\x21-\x7e]+$/.test(key)) {
    return {
      ok: false,
      status: 400,
      error: `Idempotency-Key 必须为 1-${API_IDEMPOTENCY_MAX_LENGTH} 个可见 ASCII 字符`,
      code: "INVALID_IDEMPOTENCY_KEY"
    };
  }
  return { ok: true, key };
}

async function prepareApiUploadFingerprint(duration, files) {
  const buffers = [];
  const descriptors = [];

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    buffers.push(buffer);
    descriptors.push({
      name: String(file.name || ""),
      type: String(file.type || ""),
      size: Number(file.size || 0),
      sha256: await sha256Hex(buffer)
    });
  }

  return {
    buffers,
    fingerprint: await sha256Hex(JSON.stringify({ duration, files: descriptors }))
  };
}

async function claimApiIdempotency(env, userId, idempotencyKey, fingerprint) {
  const now = new Date();
  const nowIso = now.toISOString();
  const retentionCutoff = new Date(
    now.getTime() - API_IDEMPOTENCY_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await env.DB.prepare(`
    DELETE FROM api_idempotency
    WHERE state = 'completed' AND updated_at < ?
  `).bind(retentionCutoff).run();

  const tryInsert = async () => env.DB.prepare(`
    INSERT OR IGNORE INTO api_idempotency (
      api_user_id, idempotency_key, request_fingerprint, state,
      response_status, response_body, response_headers, created_at, updated_at
    ) VALUES (?, ?, ?, 'processing', NULL, NULL, NULL, ?, ?)
  `).bind(userId, idempotencyKey, fingerprint, nowIso, nowIso).run();

  let insertResult = await tryInsert();
  if (Number(insertResult?.meta?.changes || 0) > 0) {
    return { ok: true, claimed: true };
  }

  let row = await d1First(env, `
    SELECT request_fingerprint, state, response_status, response_body,
           response_headers, updated_at
    FROM api_idempotency
    WHERE api_user_id = ? AND idempotency_key = ?
  `, [userId, idempotencyKey]);

  if (!row) {
    insertResult = await tryInsert();
    if (Number(insertResult?.meta?.changes || 0) > 0) {
      return { ok: true, claimed: true };
    }
    row = await d1First(env, `
      SELECT request_fingerprint, state, response_status, response_body,
             response_headers, updated_at
      FROM api_idempotency
      WHERE api_user_id = ? AND idempotency_key = ?
    `, [userId, idempotencyKey]);
  }

  if (!row) {
    throw new Error("Unable to claim idempotency key");
  }
  if (row.request_fingerprint !== fingerprint) {
    return {
      ok: false,
      status: 409,
      error: "该 Idempotency-Key 已用于不同的上传请求",
      code: "IDEMPOTENCY_KEY_REUSED"
    };
  }

  if (row.state === "completed") {
    let body;
    let headers;
    try {
      body = JSON.parse(row.response_body || "{}");
      headers = JSON.parse(row.response_headers || "{}");
    } catch (error) {
      throw new Error("Stored idempotency response is invalid");
    }
    return {
      ok: true,
      replay: true,
      status: Number(row.response_status || 200),
      body,
      headers: { ...headers, "X-Idempotent-Replayed": "true" }
    };
  }

  const updatedAt = new Date(row.updated_at || 0).getTime();
  if (Number.isFinite(updatedAt) && now.getTime() - updatedAt > API_IDEMPOTENCY_PROCESSING_TIMEOUT_MS) {
    await env.DB.prepare(`
      DELETE FROM api_idempotency
      WHERE api_user_id = ?
        AND idempotency_key = ?
        AND request_fingerprint = ?
        AND state = 'processing'
        AND updated_at = ?
    `).bind(userId, idempotencyKey, fingerprint, row.updated_at).run();

    insertResult = await tryInsert();
    if (Number(insertResult?.meta?.changes || 0) > 0) {
      return { ok: true, claimed: true };
    }
  }

  return {
    ok: false,
    status: 409,
    error: "相同 Idempotency-Key 的上传请求正在处理中",
    code: "IDEMPOTENCY_IN_PROGRESS"
  };
}

async function completeApiIdempotency(
  env,
  userId,
  idempotencyKey,
  fingerprint,
  status,
  body,
  headers
) {
  await env.DB.prepare(`
    UPDATE api_idempotency
    SET state = 'completed',
        response_status = ?,
        response_body = ?,
        response_headers = ?,
        updated_at = ?
    WHERE api_user_id = ?
      AND idempotency_key = ?
      AND request_fingerprint = ?
      AND state = 'processing'
  `).bind(
    status,
    JSON.stringify(body),
    JSON.stringify(headers || {}),
    new Date().toISOString(),
    userId,
    idempotencyKey,
    fingerprint
  ).run();
}

async function releaseApiIdempotency(env, userId, idempotencyKey, fingerprint) {
  if (!idempotencyKey || !fingerprint) return;
  await env.DB.prepare(`
    DELETE FROM api_idempotency
    WHERE api_user_id = ?
      AND idempotency_key = ?
      AND request_fingerprint = ?
      AND state = 'processing'
  `).bind(userId, idempotencyKey, fingerprint).run();
}

function encodeApiImageCursor(row) {
  const value = JSON.stringify({
    uploaded_at: row.uploaded_at,
    id: String(row.id)
  });
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeApiImageCursor(value) {
  if (!value) return null;
  try {
    const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const parsed = JSON.parse(atob(padded));
    const id = String(parsed.id || "");
    const uploadedAt = String(parsed.uploaded_at || "");
    if (!id || !Number.isFinite(new Date(uploadedAt).getTime())) {
      return null;
    }
    return { id, uploadedAt };
  } catch (error) {
    return null;
  }
}

function isDeletableApiImageKey(key) {
  const parts = String(key || "").split("/");
  return parts.length === 2
    && ["1-day", "7-day", "30-day", "permanent"].includes(parts[0])
    && /^[A-Za-z0-9._-]+$/.test(parts[1])
    && parts[1] !== "."
    && parts[1] !== "..";
}

async function reserveTemporaryQuota(env, user, count, dateInfo) {
  const now = new Date().toISOString();
  const results = await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO api_daily_usage (
        api_user_id, usage_date, temporary_count, permanent_count, updated_at
      ) VALUES (?, ?, 0, 0, ?)
      ON CONFLICT(api_user_id, usage_date) DO NOTHING
    `).bind(user.id, dateInfo.usageDate, now),
    env.DB.prepare(`
      UPDATE api_daily_usage
      SET temporary_count = temporary_count + ?, updated_at = ?
      WHERE api_user_id = ?
        AND usage_date = ?
        AND temporary_count + ? <= ?
      RETURNING temporary_count, permanent_count
    `).bind(
      count,
      now,
      user.id,
      dateInfo.usageDate,
      count,
      Number(user.temporary_daily_limit || 0)
    )
  ]);
  const row = results?.[1]?.results?.[0] || null;
  if (row) {
    return {
      ok: true,
      temporaryCount: Number(row.temporary_count || 0),
      permanentCount: Number(row.permanent_count || 0)
    };
  }
  const usage = await getApiUsage(env, user.id, dateInfo.usageDate);
  return { ok: false, ...usage };
}

async function refundTemporaryQuota(env, userId, count, usageDate) {
  if (count < 1) return;
  await env.DB.prepare(`
    UPDATE api_daily_usage
    SET temporary_count = MAX(0, temporary_count - ?), updated_at = ?
    WHERE api_user_id = ? AND usage_date = ?
  `).bind(count, new Date().toISOString(), userId, usageDate).run();
}

async function reservePermanentQuota(env, user, count) {
  const row = await env.DB.prepare(`
    UPDATE api_users
    SET permanent_quota_used = permanent_quota_used + ?, updated_at = ?
    WHERE id = ?
      AND active = 1
      AND permanent_quota_used + ? <= permanent_quota_total
    RETURNING permanent_quota_used, permanent_quota_total
  `).bind(count, new Date().toISOString(), user.id, count).first();
  if (!row) {
    const latest = await d1First(env, `
      SELECT permanent_quota_used, permanent_quota_total
      FROM api_users
      WHERE id = ?
    `, [user.id]);
    return {
      ok: false,
      permanentUsed: Number(latest?.permanent_quota_used || 0),
      permanentTotal: Number(latest?.permanent_quota_total || 0)
    };
  }
  return {
    ok: true,
    permanentUsed: Number(row.permanent_quota_used || 0),
    permanentTotal: Number(row.permanent_quota_total || 0)
  };
}

async function refundPermanentQuota(env, userId, count) {
  if (count < 1) return;
  await env.DB.prepare(`
    UPDATE api_users
    SET permanent_quota_used = MAX(0, permanent_quota_used - ?), updated_at = ?
    WHERE id = ?
  `).bind(count, new Date().toISOString(), userId).run();
}

async function recordPermanentDailyUsage(env, userId, count, usageDate) {
  if (count < 1) return;
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO api_daily_usage (
        api_user_id, usage_date, temporary_count, permanent_count, updated_at
      ) VALUES (?, ?, 0, 0, ?)
      ON CONFLICT(api_user_id, usage_date) DO NOTHING
    `).bind(userId, usageDate, now),
    env.DB.prepare(`
      UPDATE api_daily_usage
      SET permanent_count = permanent_count + ?, updated_at = ?
      WHERE api_user_id = ? AND usage_date = ?
    `).bind(count, now, userId, usageDate)
  ]);
}

async function touchApiUser(env, userId) {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE api_users
    SET last_used_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(now, now, userId).run();
}

function parseJsonArrayText(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function jsonText(value) {
  try {
    return JSON.stringify(value ?? []);
  } catch (e) {
    return "[]";
  }
}

function folderFromKey(key) {
  return String(key || "").split("/")[0] || "";
}

function calculateExpiresAt(duration, uploadedAtIso) {
  const base = new Date(uploadedAtIso).getTime();
  if (!Number.isFinite(base)) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  if (duration === "1-day") return new Date(base + dayMs).toISOString();
  if (duration === "7-day") return new Date(base + 7 * dayMs).toISOString();
  if (duration === "30-day") return new Date(base + 30 * dayMs).toISOString();

  return null;
}

function statusForD1({ admin, risk }) {
  if (admin) return "personal";
  if (risk === "suspicious") return "suspicious";
  return "pending";
}

async function d1UpsertImage(env, image) {
  const uploadedAt = image.uploadedAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();

  const sql = `
    INSERT INTO images (
      id, r2_key, public_url, folder, status, risk, risk_reasons,
      size, mime, file_hash,
      ip, ip_hash, country, region, region_code, city, timezone, colo,
      user_agent, origin, referer,
      vip_id, duration, is_vip, is_personal,
      uploaded_at, audited_at, deleted_at, expires_at,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(r2_key) DO UPDATE SET
      public_url = excluded.public_url,
      folder = excluded.folder,
      status = excluded.status,
      risk = excluded.risk,
      risk_reasons = excluded.risk_reasons,
      size = excluded.size,
      mime = excluded.mime,
      file_hash = excluded.file_hash,
      ip = excluded.ip,
      ip_hash = excluded.ip_hash,
      country = excluded.country,
      region = excluded.region,
      region_code = excluded.region_code,
      city = excluded.city,
      timezone = excluded.timezone,
      colo = excluded.colo,
      user_agent = excluded.user_agent,
      origin = excluded.origin,
      referer = excluded.referer,
      vip_id = excluded.vip_id,
      duration = excluded.duration,
      is_vip = excluded.is_vip,
      is_personal = excluded.is_personal,
      uploaded_at = excluded.uploaded_at,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
  `;

  return d1Run(env, sql, [
    image.id || crypto.randomUUID(),
    image.r2Key,
    image.publicUrl,
    image.folder || folderFromKey(image.r2Key),
    image.status || "pending",
    image.risk || "normal",
    jsonText(image.riskReasons || []),

    Number(image.size || 0),
    image.mime || null,
    image.fileHash || null,

    image.ip || null,
    image.ipHash || null,
    image.country || null,
    image.region || null,
    image.regionCode || null,
    image.city || null,
    image.timezone || null,
    image.colo || null,

    image.userAgent || null,
    image.origin || null,
    image.referer || null,

    image.vipId || null,
    image.duration || null,
    image.isVip ? 1 : 0,
    image.isPersonal ? 1 : 0,

    uploadedAt,
    image.auditedAt || null,
    image.deletedAt || null,
    image.expiresAt || calculateExpiresAt(image.duration, uploadedAt),

    image.createdAt || uploadedAt,
    updatedAt
  ]);
}

async function d1LogEvent(env, event) {
  const sql = `
    INSERT INTO upload_events (
      id, r2_key, ip, ip_hash, country, region, city,
      event_type, risk, risk_reasons, file_size, mime, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  return d1Run(env, sql, [
    event.id || crypto.randomUUID(),
    event.r2Key || null,
    event.ip || null,
    event.ipHash || null,
    event.country || null,
    event.region || null,
    event.city || null,
    event.eventType || "upload",
    event.risk || "normal",
    jsonText(event.riskReasons || []),
    Number(event.fileSize || 0),
    event.mime || null,
    event.createdAt || new Date().toISOString()
  ]);
}

async function d1MarkImagesAudited(env, keys) {
  if (!Array.isArray(keys) || !keys.length) return;
  const now = new Date().toISOString();
  await Promise.all(keys.map((key) => d1Run(env, `
    UPDATE images
    SET status = 'audited',
        risk = 'normal',
        risk_reasons = '[]',
        audited_at = ?,
        updated_at = ?
    WHERE r2_key = ?
  `, [now, now, key])));
}

async function d1MarkImagesDeleted(env, keys) {
  if (!Array.isArray(keys) || !keys.length) return;
  const now = new Date().toISOString();
  await Promise.all(keys.map((key) => d1Run(env, `
    UPDATE images
    SET status = 'deleted',
        deleted_at = ?,
        updated_at = ?
    WHERE r2_key = ?
  `, [now, now, key])));
}

async function d1SetBlockedIp(env, data) {
  const sql = `
    INSERT INTO blocked_ips (ip_hash, ip, note, source_key, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(ip_hash) DO UPDATE SET
      ip = excluded.ip,
      note = excluded.note,
      source_key = excluded.source_key,
      created_at = excluded.created_at
  `;

  return d1Run(env, sql, [
    data.ipHash || data.ip_hash,
    data.ip || null,
    data.note || "",
    data.sourceKey || data.source_key || null,
    data.createdAt || new Date().toISOString()
  ]);
}

async function d1RemoveBlockedIp(env, ipHashValue) {
  if (!ipHashValue) return;
  return d1Run(env, "DELETE FROM blocked_ips WHERE ip_hash = ?", [ipHashValue]);
}

async function ensureHighRiskSchema(env) {
  if (!hasD1(env)) return { ok: false, skipped: true };
  await d1Run(env, `
    CREATE TABLE IF NOT EXISTS high_risk_users (
      id TEXT PRIMARY KEY,
      ip TEXT,
      ip_hash TEXT,
      device_hash TEXT,
      user_agent TEXT,
      source_key TEXT,
      reason TEXT,
      note TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await d1Run(env, "CREATE INDEX IF NOT EXISTS idx_high_risk_ip_active ON high_risk_users(ip_hash, active)");
  await d1Run(env, "CREATE INDEX IF NOT EXISTS idx_high_risk_device_active ON high_risk_users(device_hash, active)");
  await d1Run(env, "CREATE INDEX IF NOT EXISTS idx_high_risk_source ON high_risk_users(source_key)");
  return { ok: true };
}

async function d1SetHighRiskUser(env, data) {
  if (!hasD1(env)) return { ok: false, skipped: true };
  await ensureHighRiskSchema(env);
  const now = new Date().toISOString();
  const id = data.id || `risk:${data.ipHash || data.ip_hash || "noip"}:${data.deviceHash || data.device_hash || "nodev"}`;
  const sql = `
    INSERT INTO high_risk_users (
      id, ip, ip_hash, device_hash, user_agent, source_key, reason, note, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      ip = COALESCE(excluded.ip, high_risk_users.ip),
      ip_hash = COALESCE(excluded.ip_hash, high_risk_users.ip_hash),
      device_hash = COALESCE(excluded.device_hash, high_risk_users.device_hash),
      user_agent = COALESCE(excluded.user_agent, high_risk_users.user_agent),
      source_key = COALESCE(excluded.source_key, high_risk_users.source_key),
      reason = excluded.reason,
      note = excluded.note,
      active = 1,
      updated_at = excluded.updated_at
  `;
  await d1Run(env, sql, [
    id,
    data.ip || null,
    data.ipHash || data.ip_hash || null,
    data.deviceHash || data.device_hash || null,
    data.userAgent || data.user_agent || null,
    data.sourceKey || data.source_key || null,
    data.reason || "manual_high_risk",
    data.note || "",
    data.createdAt || data.created_at || now,
    now
  ]);
  return { ok: true, id };
}

async function d1ListHighRiskUsers(env) {
  if (!hasD1(env)) return [];
  await ensureHighRiskSchema(env);
  return d1All(env, `
    SELECT id, ip, ip_hash AS ipHash, device_hash AS deviceHash, user_agent AS userAgent,
           source_key AS sourceKey, reason, note, active,
           created_at AS createdAt, updated_at AS updatedAt
    FROM high_risk_users
    WHERE active = 1
    ORDER BY updated_at DESC
    LIMIT 1000
  `);
}

async function d1DeactivateHighRiskUser(env, id) {
  if (!hasD1(env) || !id) return { ok: false };
  await ensureHighRiskSchema(env);
  return d1Run(env, `
    UPDATE high_risk_users
    SET active = 0,
        updated_at = ?
    WHERE id = ?
  `, [new Date().toISOString(), id]);
}

async function findActiveHighRiskUser(env, { ipHash: ipHashValue = "", deviceHash: deviceHashValue = "" } = {}) {
  if (!hasD1(env)) return null;
  await ensureHighRiskSchema(env);
  if (!ipHashValue && !deviceHashValue) return null;

  if (ipHashValue && deviceHashValue) {
    return d1First(env, `
      SELECT *
      FROM high_risk_users
      WHERE active = 1
        AND ((ip_hash IS NOT NULL AND ip_hash = ?) OR (device_hash IS NOT NULL AND device_hash = ?))
      ORDER BY updated_at DESC
      LIMIT 1
    `, [ipHashValue, deviceHashValue]);
  }

  if (ipHashValue) {
    return d1First(env, `
      SELECT *
      FROM high_risk_users
      WHERE active = 1
        AND ip_hash IS NOT NULL
        AND ip_hash = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `, [ipHashValue]);
  }

  return d1First(env, `
    SELECT *
    FROM high_risk_users
    WHERE active = 1
      AND device_hash IS NOT NULL
      AND device_hash = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `, [deviceHashValue]);
}

async function d1UpsertVipCode(env, vip) {
  const now = new Date().toISOString();
  const sql = `
    INSERT INTO vip_codes (
      code, note, email, email_verified, email_verified_at, active, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      note = excluded.note,
      email = excluded.email,
      email_verified = excluded.email_verified,
      email_verified_at = excluded.email_verified_at,
      active = 1,
      updated_at = excluded.updated_at
  `;

  return d1Run(env, sql, [
    vip.code,
    vip.note || "",
    normalizeEmail(vip.email),
    vip.emailVerified ? 1 : 0,
    vip.emailVerified ? (vip.emailVerifiedAt || now) : null,
    vip.createdAt || now,
    now
  ]);
}

async function d1DeactivateVipCode(env, code) {
  return d1Run(env, `
    UPDATE vip_codes
    SET active = 0,
        updated_at = ?
    WHERE code = ?
  `, [new Date().toISOString(), code]);
}



async function handleD1Health(request, env) {
  if (!hasD1(env)) {
    return jsonResponse(request, env, {
      ok: false,
      error: "D1 binding DB not found. 请检查 Worker Bindings 里是否绑定变量名 DB。"
    }, 500);
  }

  try {
    await ensureApiSchema(env);
    const images = await d1First(env, "SELECT COUNT(*) AS count FROM images");
    const blockedIps = await d1First(env, "SELECT COUNT(*) AS count FROM blocked_ips");
    const vipCodes = await d1First(env, "SELECT COUNT(*) AS count FROM vip_codes");
    const uploadEvents = await d1First(env, "SELECT COUNT(*) AS count FROM upload_events");
    const apiUsers = await d1First(env, "SELECT COUNT(*) AS count FROM api_users");
    await ensureHighRiskSchema(env);
    const highRiskUsers = await d1First(env, "SELECT COUNT(*) AS count FROM high_risk_users WHERE active = 1");

    return jsonResponse(request, env, {
      ok: true,
      binding: "DB",
      tables: {
        images: Number(images?.count || 0),
        blocked_ips: Number(blockedIps?.count || 0),
        high_risk_users: Number(highRiskUsers?.count || 0),
        vip_codes: Number(vipCodes?.count || 0),
        api_users: Number(apiUsers?.count || 0),
        upload_events: Number(uploadEvents?.count || 0)
      }
    });
  } catch (error) {
    return jsonResponse(request, env, {
      ok: false,
      error: error && error.message ? error.message : String(error)
    }, 500);
  }
}

function resolveApiDuration(user, requestedDuration) {
  const requested = String(requestedDuration || "").trim();
  const allowTemporary = Number(user.allow_temporary || 0) === 1;
  const allowPermanent = Number(user.allow_permanent || 0) === 1;
  const duration = requested || (allowTemporary ? "1-day" : "permanent");

  if (duration === "permanent") {
    return allowPermanent
      ? { ok: true, duration, permanent: true }
      : { ok: false, status: 403, error: "当前 API Key 未开通永久图片上传", code: "PERMANENT_NOT_ALLOWED" };
  }

  if (!API_TEMPORARY_DURATIONS.has(duration)) {
    return {
      ok: false,
      status: 400,
      error: "duration 仅支持 1-day、7-day、30-day 或 permanent",
      code: "INVALID_DURATION"
    };
  }
  if (!allowTemporary) {
    return { ok: false, status: 403, error: "当前 API Key 未开通限时图片上传", code: "TEMPORARY_NOT_ALLOWED" };
  }
  return { ok: true, duration, permanent: false };
}

function apiQuotaHeaders(user, usage, dateInfo) {
  const headers = {
    "X-Quota-Timezone": dateInfo.timeZone,
    "X-Quota-Reset": dateInfo.resetAt,
    "X-Permanent-Quota-Limit": String(Number(user.permanent_quota_total || 0)),
    "X-Permanent-Quota-Remaining": String(Math.max(
      0,
      Number(user.permanent_quota_total || 0) - Number(user.permanent_quota_used || 0)
    ))
  };
  if (Number(user.allow_temporary || 0) === 1) {
    const limit = Number(user.temporary_daily_limit || 0);
    headers["X-RateLimit-Limit"] = String(limit);
    headers["X-RateLimit-Remaining"] = String(Math.max(0, limit - Number(usage.temporaryCount || 0)));
    headers["X-RateLimit-Reset"] = dateInfo.resetAt;
  }
  return headers;
}

function createApiUploadError(message, status = 500, code = "UPLOAD_FAILED") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function storeApiImage(env, {
  file,
  fileBuffer,
  user,
  duration,
  ctx,
  ipHash: requestIpHash,
  riskReasons
}) {
  const extension = MIME_TO_EXT[file.type];
  const finalR2Path = `${duration}/${crypto.randomUUID()}.${extension}`;
  const isPermanent = duration === "permanent";
  let r2Stored = false;

  try {
    const arrayBuffer = fileBuffer || await file.arrayBuffer();
    const firstBytes = new Uint8Array(arrayBuffer.slice(0, 16));
    if (!isLikelyImageByMagicBytes(file.type, firstBytes)) {
      throw createApiUploadError("文件内容与图片格式不匹配", 415, "INVALID_IMAGE_CONTENT");
    }

    const fileHash = await sha256Hex(arrayBuffer);
    const risk = riskReasons.length ? "suspicious" : "normal";
    const metadata = {
      api_user_id: String(user.id),
      api_user_code: String(user.code),
      api_key_prefix: String(user.key_prefix),
      file_hash: fileHash,
      ip_hash: requestIpHash,
      country: ctx.country,
      region: ctx.region,
      region_code: ctx.regionCode,
      city: ctx.city,
      risk
    };

    await env.R2_BUCKET.put(finalR2Path, arrayBuffer, {
      httpMetadata: { contentType: file.type },
      customMetadata: metadata
    });
    r2Stored = true;

    const uploadedAtIso = new Date().toISOString();
    await saveUploadIndex(env, finalR2Path, {
      ip: ctx.ip,
      ipHash: requestIpHash,
      country: ctx.country,
      region: ctx.region,
      regionCode: ctx.regionCode,
      city: ctx.city,
      timezone: ctx.timezone,
      colo: ctx.colo,
      userAgent: ctx.userAgent,
      origin: ctx.origin,
      referer: ctx.referer,
      secFetchSite: ctx.secFetchSite,
      apiUpload: true,
      apiUserId: user.id,
      apiUserCode: user.code,
      apiKeyPrefix: user.key_prefix,
      fileName: truncate(file.name, MAX_FILENAME_LENGTH),
      fileSize: file.size,
      fileType: file.type,
      fileHash,
      duration,
      isVip: isPermanent,
      risk,
      riskReasons,
      loggedAt: uploadedAtIso
    });

    const publicUrl = `https://pub.mini-tools.uk/${finalR2Path}`;
    const imageRecord = await d1UpsertImage(env, {
      r2Key: finalR2Path,
      publicUrl,
      folder: folderFromKey(finalR2Path),
      status: statusForD1({ admin: false, risk }),
      risk,
      riskReasons,
      size: file.size,
      mime: file.type,
      fileHash,
      ip: ctx.ip,
      ipHash: requestIpHash,
      country: ctx.country,
      region: ctx.region,
      regionCode: ctx.regionCode,
      city: ctx.city,
      timezone: ctx.timezone,
      colo: ctx.colo,
      userAgent: ctx.userAgent,
      origin: ctx.origin,
      referer: ctx.referer,
      vipId: user.code,
      duration,
      isVip: isPermanent,
      isPersonal: false,
      uploadedAt: uploadedAtIso,
      expiresAt: calculateExpiresAt(duration, uploadedAtIso)
    });
    if (!imageRecord?.ok) {
      throw createApiUploadError("图片审核记录写入失败", 500, "IMAGE_RECORD_FAILED");
    }

    const sourceRecord = await d1Run(env, `
      UPDATE images
      SET upload_source = 'api',
          api_user_id = ?,
          updated_at = ?
      WHERE r2_key = ?
    `, [user.id, uploadedAtIso, finalR2Path]);
    if (!sourceRecord?.ok) {
      throw createApiUploadError("API 上传来源记录写入失败", 500, "IMAGE_SOURCE_FAILED");
    }

    if (risk === "suspicious") {
      await markSuspicious(env, finalR2Path, {
        key: finalR2Path,
        apiUserId: user.id,
        apiUserCode: user.code,
        ip: ctx.ip,
        ipHash: requestIpHash,
        reasons: riskReasons,
        createdAt: uploadedAtIso
      });
    }

    await logUpload(env, {
      ip: ctx.ip,
      ipHash: requestIpHash,
      country: ctx.country,
      region: ctx.region,
      regionCode: ctx.regionCode,
      city: ctx.city,
      timezone: ctx.timezone,
      colo: ctx.colo,
      userAgent: ctx.userAgent,
      origin: ctx.origin,
      referer: ctx.referer,
      apiUpload: true,
      apiUserId: user.id,
      apiUserCode: user.code,
      key: finalR2Path,
      fileName: truncate(file.name, MAX_FILENAME_LENGTH),
      fileSize: file.size,
      fileType: file.type,
      fileHash,
      duration,
      isVip: isPermanent,
      risk,
      riskReasons
    });

    await d1LogEvent(env, {
      r2Key: finalR2Path,
      ip: ctx.ip,
      ipHash: requestIpHash,
      country: ctx.country,
      region: ctx.region,
      city: ctx.city,
      eventType: isPermanent ? "api_permanent_upload" : "api_temporary_upload",
      risk,
      riskReasons,
      fileSize: file.size,
      mime: file.type,
      createdAt: uploadedAtIso
    });

    return {
      success: true,
      key: finalR2Path,
      url: publicUrl,
      duration,
      expires_at: calculateExpiresAt(duration, uploadedAtIso),
      size: file.size,
      mime: file.type,
      risk
    };
  } catch (error) {
    if (r2Stored) {
      try {
        await env.R2_BUCKET.delete(finalR2Path);
        await deleteUploadIndex(env, finalR2Path);
        await d1MarkImagesDeleted(env, [finalR2Path]);
      } catch (cleanupError) {
        console.error("API upload cleanup failed:", cleanupError);
      }
    }
    throw error;
  }
}

async function handleApiAccount(request, env) {
  let auth;
  try {
    auth = await authenticateApiUser(request, env);
  } catch (error) {
    return jsonResponse(request, env, {
      error: "API 用户数据库初始化失败",
      code: "API_DATABASE_UNAVAILABLE"
    }, 503);
  }
  if (!auth.ok) {
    return jsonResponse(request, env, { error: auth.error, code: auth.code }, auth.status);
  }

  const dateInfo = apiUsageDateInfo();
  const usage = await getApiUsage(env, auth.user.id, dateInfo.usageDate);
  return jsonResponse(
    request,
    env,
    { success: true, account: apiPublicAccountPayload(auth.user, usage, dateInfo) },
    200,
    apiQuotaHeaders(auth.user, usage, dateInfo)
  );
}

async function handleApiUsage(request, env) {
  let auth;
  try {
    auth = await authenticateApiUser(request, env);
  } catch (error) {
    return jsonResponse(request, env, {
      error: "API 用户数据库初始化失败",
      code: "API_DATABASE_UNAVAILABLE"
    }, 503);
  }
  if (!auth.ok) {
    return jsonResponse(request, env, { error: auth.error, code: auth.code }, auth.status);
  }

  const dateInfo = apiUsageDateInfo();
  const usage = await getApiUsage(env, auth.user.id, dateInfo.usageDate);
  return jsonResponse(
    request,
    env,
    { success: true, usage: apiPublicUsagePayload(auth.user, usage, dateInfo) },
    200,
    apiQuotaHeaders(auth.user, usage, dateInfo)
  );
}

async function handleApiImagesList(request, env) {
  let auth;
  try {
    auth = await authenticateApiUser(request, env);
  } catch (error) {
    return jsonResponse(request, env, {
      error: "API 用户数据库初始化失败",
      code: "API_DATABASE_UNAVAILABLE"
    }, 503);
  }
  if (!auth.ok) {
    return jsonResponse(request, env, { error: auth.error, code: auth.code }, auth.status);
  }

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") || API_IMAGE_LIST_DEFAULT_LIMIT);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
    return jsonResponse(request, env, {
      error: "limit 必须为正整数",
      code: "INVALID_LIMIT"
    }, 400);
  }
  const limit = Math.min(requestedLimit, API_IMAGE_LIST_MAX_LIMIT);
  const cursorValue = url.searchParams.get("cursor");
  const cursor = decodeApiImageCursor(cursorValue);
  if (cursorValue && !cursor) {
    return jsonResponse(request, env, {
      error: "cursor 无效",
      code: "INVALID_CURSOR"
    }, 400);
  }

  const params = [auth.user.id];
  let cursorClause = "";
  if (cursor) {
    cursorClause = "AND (uploaded_at < ? OR (uploaded_at = ? AND id < ?))";
    params.push(cursor.uploadedAt, cursor.uploadedAt, cursor.id);
  }
  params.push(limit + 1);

  const rows = await d1All(env, `
    SELECT id, r2_key, public_url, size, mime, uploaded_at
    FROM images
    WHERE api_user_id = ?
      AND upload_source = 'api'
      AND status != 'deleted'
      ${cursorClause}
    ORDER BY uploaded_at DESC, id DESC
    LIMIT ?
  `, params);

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const records = pageRows.map((row) => ({
    key: row.r2_key,
    url: row.public_url || `https://pub.mini-tools.uk/${row.r2_key}`,
    size: Number(row.size || 0),
    mime: row.mime || "application/octet-stream",
    uploaded_at: row.uploaded_at
  }));

  return jsonResponse(request, env, {
    success: true,
    records,
    next_cursor: hasMore ? encodeApiImageCursor(pageRows[pageRows.length - 1]) : null
  });
}

async function handleApiImageDelete(request, env, encodedKey) {
  let auth;
  try {
    auth = await authenticateApiUser(request, env);
  } catch (error) {
    return jsonResponse(request, env, {
      error: "API 用户数据库初始化失败",
      code: "API_DATABASE_UNAVAILABLE"
    }, 503);
  }
  if (!auth.ok) {
    return jsonResponse(request, env, { error: auth.error, code: auth.code }, auth.status);
  }

  let key;
  try {
    key = decodeURIComponent(encodedKey || "");
  } catch (error) {
    key = "";
  }
  if (!isDeletableApiImageKey(key)) {
    return jsonResponse(request, env, {
      error: "图片 key 无效",
      code: "INVALID_IMAGE_KEY"
    }, 400);
  }

  const image = await d1First(env, `
    SELECT r2_key, public_url
    FROM images
    WHERE r2_key = ?
      AND api_user_id = ?
      AND upload_source = 'api'
      AND status != 'deleted'
  `, [key, auth.user.id]);
  if (!image) {
    return jsonResponse(request, env, {
      error: "图片不存在或不属于当前 API 用户",
      code: "IMAGE_NOT_FOUND"
    }, 404);
  }

  await deleteImageKeys(env, [key]);
  return jsonResponse(request, env, {
    success: true,
    deleted: {
      key,
      url: image.public_url || `https://pub.mini-tools.uk/${key}`
    }
  });
}

async function handleApiUpload(request, env) {
  let auth;
  try {
    auth = await authenticateApiUser(request, env);
  } catch (error) {
    console.error("API authentication failed:", error);
    return jsonResponse(request, env, {
      error: "API 用户数据库初始化失败",
      code: "API_DATABASE_UNAVAILABLE"
    }, 503);
  }
  if (!auth.ok) {
    return jsonResponse(request, env, { error: auth.error, code: auth.code }, auth.status);
  }

  const user = auth.user;
  const ctx = getRequestContext(request);
  const requestIpHash = await ipHash(ctx.ip);
  if (await isIpBlocked(env, requestIpHash)) {
    return jsonResponse(request, env, { error: "当前 IP 的上传权限已被限制" }, 403);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (error) {
    return jsonResponse(request, env, {
      error: "请求必须使用 multipart/form-data",
      code: "INVALID_MULTIPART"
    }, 400);
  }

  const files = formData.getAll("file");
  if (!files.length) {
    return jsonResponse(request, env, { error: "缺少 file 字段", code: "NO_FILES" }, 400);
  }
  if (files.length > API_MAX_FILES_PER_REQUEST) {
    return jsonResponse(request, env, {
      error: `单次请求最多上传 ${API_MAX_FILES_PER_REQUEST} 张图片`,
      code: "TOO_MANY_FILES",
      max_files: API_MAX_FILES_PER_REQUEST
    }, 413);
  }

  let totalSize = 0;
  for (const file of files) {
    const valid = isValidUploadFile(file);
    if (!valid.ok) {
      return jsonResponse(request, env, { error: valid.error, code: "INVALID_FILE" }, valid.status);
    }
    if (file.size > PUBLIC_MAX_FILE_SIZE) {
      return jsonResponse(request, env, {
        error: `文件 ${truncate(file.name, MAX_FILENAME_LENGTH)} 超过 5MB`,
        code: "FILE_TOO_LARGE"
      }, 413);
    }
    totalSize += Number(file.size || 0);
  }
  if (totalSize > API_MAX_TOTAL_SIZE) {
    return jsonResponse(request, env, {
      error: "单次请求图片总大小不能超过 25MB",
      code: "REQUEST_FILES_TOO_LARGE",
      max_total_bytes: API_MAX_TOTAL_SIZE
    }, 413);
  }

  const durationCheck = resolveApiDuration(user, formData.get("duration"));
  if (!durationCheck.ok) {
    return jsonResponse(request, env, {
      error: durationCheck.error,
      code: durationCheck.code
    }, durationCheck.status);
  }

  const idempotencyCheck = parseApiIdempotencyKey(request);
  if (!idempotencyCheck.ok) {
    return jsonResponse(request, env, {
      error: idempotencyCheck.error,
      code: idempotencyCheck.code
    }, idempotencyCheck.status);
  }

  let idempotencyFingerprint = null;
  let preparedBuffers = null;
  if (idempotencyCheck.key) {
    const prepared = await prepareApiUploadFingerprint(durationCheck.duration, files);
    preparedBuffers = prepared.buffers;
    idempotencyFingerprint = prepared.fingerprint;

    const claim = await claimApiIdempotency(
      env,
      user.id,
      idempotencyCheck.key,
      idempotencyFingerprint
    );
    if (claim.replay) {
      return jsonResponse(request, env, claim.body, claim.status, claim.headers);
    }
    if (!claim.ok) {
      return jsonResponse(request, env, {
        error: claim.error,
        code: claim.code
      }, claim.status);
    }
  }

  const dateInfo = apiUsageDateInfo();
  let reservation;
  if (durationCheck.permanent) {
    reservation = await reservePermanentQuota(env, user, files.length);
    if (!reservation.ok) {
      await releaseApiIdempotency(env, user.id, idempotencyCheck.key, idempotencyFingerprint);
      return jsonResponse(request, env, {
        error: "永久图片额度已用完或本次上传超出剩余额度",
        code: "PERMANENT_QUOTA_EXHAUSTED",
        quota_total: reservation.permanentTotal,
        quota_used: reservation.permanentUsed,
        quota_remaining: Math.max(0, reservation.permanentTotal - reservation.permanentUsed),
        requested: files.length
      }, 429);
    }
    user.permanent_quota_used = reservation.permanentUsed;
  } else {
    reservation = await reserveTemporaryQuota(env, user, files.length, dateInfo);
    if (!reservation.ok) {
      await releaseApiIdempotency(env, user.id, idempotencyCheck.key, idempotencyFingerprint);
      return jsonResponse(request, env, {
        error: "今日上传数量已用完或本次上传超出今日剩余额度",
        code: "DAILY_QUOTA_EXHAUSTED",
        daily_limit: Number(user.temporary_daily_limit || 0),
        used_today: reservation.temporaryCount,
        remaining_today: Math.max(
          0,
          Number(user.temporary_daily_limit || 0) - Number(reservation.temporaryCount || 0)
        ),
        requested: files.length,
        reset_at: dateInfo.resetAt,
        timezone: dateInfo.timeZone
      }, 429, apiQuotaHeaders(user, reservation, dateInfo));
    }
  }

  const highRiskUser = await findActiveHighRiskUser(env, { ipHash: requestIpHash });
  const riskReasons = highRiskUser ? ["high_risk_user"] : [];
  const uploaded = [];
  const failed = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    try {
      uploaded.push(await storeApiImage(env, {
        file,
        fileBuffer: preparedBuffers?.[index],
        user,
        duration: durationCheck.duration,
        ctx,
        ipHash: requestIpHash,
        riskReasons
      }));
    } catch (error) {
      failed.push({
        index,
        file_name: truncate(file.name, MAX_FILENAME_LENGTH),
        error: error?.message || "上传失败",
        code: error?.code || "UPLOAD_FAILED"
      });
    }
  }

  if (failed.length) {
    if (durationCheck.permanent) {
      await refundPermanentQuota(env, user.id, failed.length);
      user.permanent_quota_used = Math.max(0, Number(user.permanent_quota_used || 0) - failed.length);
    } else {
      await refundTemporaryQuota(env, user.id, failed.length, dateInfo.usageDate);
    }
  }
  if (durationCheck.permanent && uploaded.length) {
    await recordPermanentDailyUsage(env, user.id, uploaded.length, dateInfo.usageDate);
  }
  if (uploaded.length) await touchApiUser(env, user.id);

  const finalUsage = await getApiUsage(env, user.id, dateInfo.usageDate);
  const latestUser = await d1First(env, "SELECT * FROM api_users WHERE id = ?", [user.id]);
  const responseStatus = uploaded.length === files.length ? 201 : uploaded.length ? 207 : 422;
  const publicAccount = apiPublicAccountPayload(latestUser, finalUsage, dateInfo);
  const responseBody = {
    success: failed.length === 0,
    partial: uploaded.length > 0 && failed.length > 0,
    uploaded,
    failed,
    account: publicAccount,
    usage: apiPublicUsagePayload(latestUser, finalUsage, dateInfo)
  };
  const responseHeaders = apiQuotaHeaders(latestUser, finalUsage, dateInfo);
  if (idempotencyCheck.key) {
    responseHeaders["X-Idempotent-Replayed"] = "false";
    await completeApiIdempotency(
      env,
      user.id,
      idempotencyCheck.key,
      idempotencyFingerprint,
      responseStatus,
      responseBody,
      responseHeaders
    );
  }
  return jsonResponse(request, env, responseBody, responseStatus, responseHeaders);
}

async function handleUpload(request, env) {
  const admin = isAdminRequest(request, env);
  const ctx = getRequestContext(request);
  const hash = await ipHash(ctx.ip);
  const riskReasons = [];

  if (!admin && await isIpBlocked(env, hash)) {
    return jsonResponse(request, env, { error: "上传权限已被限制" }, 403);
  }

  if (!admin && !isAllowedOriginOrReferer(request, env)) {
    return jsonResponse(request, env, { error: "非法来源请求" }, 403);
  }

  if (!admin && isProgrammaticUserAgent(ctx.userAgent)) {
    return jsonResponse(request, env, { error: "当前请求疑似自动化上传，已被限制" }, 403);
  }

  if (!admin && !ctx.origin && !ctx.referer) {
    riskReasons.push("missing_origin_referer");
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const validFile = isValidUploadFile(file);

  if (!validFile.ok) {
    return jsonResponse(request, env, { error: validFile.error }, validFile.status);
  }

  const maxSize = admin ? ADMIN_MAX_FILE_SIZE : PUBLIC_MAX_FILE_SIZE;
  if (file.size > maxSize) {
    return jsonResponse(request, env, { error: admin ? "超过后台上传上限 50MB" : "超过 5MB" }, 413);
  }

  const clientDeviceId = admin ? "" : String(formData.get("client_device_id") || "").trim();
  const deviceHash = admin ? "" : await getUploadDeviceHash(ctx, clientDeviceId);

  const highRiskUser = !admin
    ? await findActiveHighRiskUser(env, { ipHash: hash, deviceHash })
    : null;

  // 高危用户库只做“提示/追踪/待审加权”，不自动禁止上传。
  // 真正禁止上传仍然只通过手动拉黑 IP 完成。
  if (highRiskUser) {
    riskReasons.push("high_risk_user");
  }

  const rateCheck = admin ? { ok: true } : await checkUploadRate(env, hash, 1);
  if (!rateCheck.ok) {
    await logUpload(env, {
      ip: ctx.ip,
      ipHash: hash,
      country: ctx.country,
      userAgent: ctx.userAgent,
      origin: ctx.origin,
      referer: ctx.referer,
      blocked: true,
      reason: rateCheck.reason,
      fileName: truncate(file.name, MAX_FILENAME_LENGTH),
      fileSize: file.size,
      fileType: file.type
    });

    return jsonResponse(request, env, { error: rateCheck.error, reason: rateCheck.reason }, rateCheck.status);
  }

  let duration = "1-day";
  let providedVipId = "";
  let isVipUpload = false;
  let objectMetadata = {};
  let finalR2Path = "";

  if (admin) {
    // 后台直传 personal/
    const extension = MIME_TO_EXT[file.type];
    finalR2Path = `personal/${crypto.randomUUID()}.${extension}`;
  } else {
    duration = String(formData.get("duration") || "");
    providedVipId = String(formData.get("vip_id") || "").trim();
    const captchaId = formData.get("captcha_id");
    const captchaAnswer = formData.get("captcha_answer");

    if (!duration || !captchaId || captchaAnswer === null || captchaAnswer === undefined || String(captchaAnswer).trim() === "") {
      return jsonResponse(request, env, { error: "缺少安全参数" }, 400);
    }

    const captchaCheck = await verifyCaptcha(env, request, captchaId, captchaAnswer);
    if (!captchaCheck.ok) {
      await logUpload(env, {
        ip: ctx.ip,
        ipHash: hash,
        country: ctx.country,
        userAgent: ctx.userAgent,
        origin: ctx.origin,
        referer: ctx.referer,
        blocked: true,
        reason: "captcha_failed",
        captchaId: String(captchaId || ""),
        fileName: truncate(file.name, MAX_FILENAME_LENGTH),
        fileSize: file.size,
        fileType: file.type
      });

      return jsonResponse(request, env, { error: captchaCheck.error }, captchaCheck.status);
    }

    let verifiedVip = null;
    if (providedVipId) {
      const vipConfigData = await getVipConfig(env);
      verifiedVip = vipConfigData.find((vip) => (
        vip.code === providedVipId &&
        vip.email_verified === true &&
        isValidEmail(vip.email)
      )) || null;
    }

    const extension = MIME_TO_EXT[file.type];

    // 有效 VIP，进入 permanent/
    if (providedVipId && verifiedVip) {
      finalR2Path = `permanent/${crypto.randomUUID()}.${extension}`;
      isVipUpload = true;
      objectMetadata = { vip_id: providedVipId };
    } else {
      // 如果前端明确请求永久，但 VIP 码无效，直接报错。
      if (duration === "permanent") {
        return jsonResponse(request, env, {
          success: false,
          error: "长期存储码无效、已停用或尚未完成邮箱认证",
          code: "EMAIL_VERIFICATION_REQUIRED"
        }, 403);
      }

      const folderPrefix = normalizeDuration(duration);
      finalR2Path = `${folderPrefix}/${crypto.randomUUID()}.${extension}`;
    }
  }

  const arrayBuffer = await file.arrayBuffer();
  const firstBytes = new Uint8Array(arrayBuffer.slice(0, 16));

  if (!isLikelyImageByMagicBytes(file.type, firstBytes)) {
    return jsonResponse(request, env, { error: "文件内容与图片格式不匹配" }, 415);
  }

  const fileHash = await sha256Hex(arrayBuffer);
  const recentStats = admin ? { suspicious: false } : await updateRecentUploadStats(env, hash);

  if (recentStats.suspicious) {
    riskReasons.push("machine_interval_upload");
  }


  const risk = riskReasons.length ? "suspicious" : "normal";

  const metadata = {
    ...objectMetadata,
    file_hash: fileHash,
    ip_hash: admin ? "admin" : hash,
    device_hash: admin ? "" : deviceHash,
    country: ctx.country,
    region: ctx.region,
    region_code: ctx.regionCode,
    city: ctx.city,
    risk
  };

  await env.R2_BUCKET.put(finalR2Path, arrayBuffer, {
    httpMetadata: { contentType: file.type },
    customMetadata: metadata
  });

  const uploadedAtIso = new Date().toISOString();

  await saveUploadIndex(env, finalR2Path, {
    ip: admin ? "admin" : ctx.ip,
    ipHash: admin ? "admin" : hash,
    country: ctx.country,
    region: ctx.region,
    regionCode: ctx.regionCode,
    city: ctx.city,
    timezone: ctx.timezone,
    colo: ctx.colo,
    userAgent: ctx.userAgent,
    deviceHash: admin ? "" : deviceHash,
    origin: ctx.origin,
    referer: ctx.referer,
    secFetchSite: ctx.secFetchSite,
    adminUpload: admin,
    fileName: truncate(file.name, MAX_FILENAME_LENGTH),
    fileSize: file.size,
    fileType: file.type,
    fileHash,
    duration: admin ? "personal" : duration,
    isVip: isVipUpload,
    risk,
    riskReasons,
    loggedAt: uploadedAtIso
  });

  const publicUrl = `https://pub.mini-tools.uk/${finalR2Path}`;

  await d1UpsertImage(env, {
    r2Key: finalR2Path,
    publicUrl,
    folder: folderFromKey(finalR2Path),
    status: statusForD1({ admin, risk }),
    risk,
    riskReasons,
    size: file.size,
    mime: file.type,
    fileHash,
    ip: admin ? "admin" : ctx.ip,
    ipHash: admin ? "admin" : hash,
    country: ctx.country,
    region: ctx.region,
    regionCode: ctx.regionCode,
    city: ctx.city,
    timezone: ctx.timezone,
    colo: ctx.colo,
    userAgent: ctx.userAgent,
    origin: ctx.origin,
    referer: ctx.referer,
    vipId: isVipUpload ? providedVipId : null,
    duration: admin ? "personal" : duration,
    isVip: isVipUpload,
    isPersonal: admin,
    uploadedAt: uploadedAtIso,
    expiresAt: admin ? null : calculateExpiresAt(duration, uploadedAtIso)
  });

  if (!admin) {
    await commitUploadRate(env, rateCheck);
  }

  if (risk === "suspicious") {
    await markSuspicious(env, finalR2Path, {
      key: finalR2Path,
      ip: ctx.ip,
      ipHash: hash,
      country: ctx.country,
      region: ctx.region,
      regionCode: ctx.regionCode,
      city: ctx.city,
      timezone: ctx.timezone,
      colo: ctx.colo,
      reasons: riskReasons,
      recentStats,
      createdAt: new Date().toISOString()
    });
  }

  await logUpload(env, {
    ip: admin ? "admin" : ctx.ip,
    ipHash: admin ? "admin" : hash,
    country: ctx.country,
    region: ctx.region,
    regionCode: ctx.regionCode,
    city: ctx.city,
    timezone: ctx.timezone,
    colo: ctx.colo,
    userAgent: ctx.userAgent,
    deviceHash: admin ? "" : deviceHash,
    origin: ctx.origin,
    referer: ctx.referer,
    secFetchSite: ctx.secFetchSite,
    adminUpload: admin,
    key: finalR2Path,
    fileName: truncate(file.name, MAX_FILENAME_LENGTH),
    fileSize: file.size,
    fileType: file.type,
    fileHash,
    duration: admin ? "personal" : duration,
    isVip: isVipUpload,
    risk,
    riskReasons,
    recentStats
  });

  await d1LogEvent(env, {
    r2Key: finalR2Path,
    ip: admin ? "admin" : ctx.ip,
    ipHash: admin ? "admin" : hash,
    country: ctx.country,
    region: ctx.region,
    city: ctx.city,
    eventType: admin ? "admin_upload" : "upload",
    risk,
    riskReasons,
    fileSize: file.size,
    mime: file.type,
    createdAt: uploadedAtIso
  });

  return jsonResponse(request, env, {
    success: true,
    url: publicUrl,
    isVip: isVipUpload,
    risk
  });
}

export default {
  // Cloudflare Cron Trigger 执行入口。
  // wrangler.toml 使用 UTC：0 4 * * * = 北京/台北 12:00；0 16 * * * = 北京/台北 24:00。
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      await cleanupExpiredImages(env, {
        batchSize: 500,
        maxBatches: 50,
        maxDelete: 5000
      });
      await cleanupD1History(env, {
        event_retention_days: 90,
        purge_deleted_images: true
      });
    })());
  },

  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: getCorsHeaders(request, env) });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const admin = isAdminRequest(request, env);

    try {
      if (request.method === "GET" && pathname === "/v1/account") {
        return await handleApiAccount(request, env);
      }

      if (request.method === "GET" && pathname === "/v1/usage") {
        return await handleApiUsage(request, env);
      }

      if (request.method === "GET" && pathname === "/v1/images") {
        return await handleApiImagesList(request, env);
      }

      if (request.method === "DELETE" && pathname.startsWith("/v1/images/")) {
        return await handleApiImageDelete(request, env, pathname.slice("/v1/images/".length));
      }

      if (request.method === "POST" && pathname === "/v1/upload") {
        return await handleApiUpload(request, env);
      }

      // ==========================================
      // 路由 0：获取算术验证码
      // GET ?action=captcha
      // ==========================================
      if (request.method === "GET" && action === "captcha") {
        return await handleCaptcha(request, env);
      }

      // ==========================================
      // 管理类接口统一鉴权
      // ==========================================
      const adminActions = new Set([
        "list",
        "audit",
        "vip_list",
        "vip_add",
        "vip_update",
        "vip_del",
        "api_user_list",
        "api_user_create",
        "api_user_update",
        "api_user_rotate_key",
        "api_user_reset_daily",
        "security_logs",
        "blocked_ips",
        "block_ip",
        "block_file_ip",
        "unblock_ip",
        "high_risk_users",
        "mark_high_risk_user",
        "unmark_high_risk_user",
        "cleanup_expired",
        "cleanup_d1_history",
        "d1_health",
        "d1_migrate"
      ]);

      if (adminActions.has(action) || (request.method === "DELETE" && !action)) {
        if (!admin) {
          return jsonResponse(request, env, { error: "Unauthorized" }, 401);
        }
      }

      // ==========================================
      // 路由 1：GET 获取所有图片列表
      // ==========================================
      if (request.method === "GET" && action === "list") {
        return await handleD1AdminList(request, env, url);
      }

      // ==========================================
      // 路由 1.1：手动清理过期图片
      // POST ?action=cleanup_expired
      // ==========================================
      if (request.method === "POST" && action === "cleanup_expired") {
        return await handleCleanupExpiredImages(request, env, url);
      }

      // ==========================================
      // 路由 1.2：物理清理 D1 历史记录和旧事件
      // POST ?action=cleanup_d1_history
      // ==========================================
      if (request.method === "POST" && action === "cleanup_d1_history") {
        return await handleCleanupD1History(request, env, url);
      }

      // ==========================================
      // 路由 2：图片批量审核
      // ==========================================
      if (request.method === "POST" && action === "audit") {
        return await handleAudit(request, env);
      }

      // ==========================================
      // 路由 3：物理删除
      // ==========================================
      if (request.method === "DELETE" && !action) {
        return await handleDelete(request, env);
      }

      // ==========================================
      // 路由 4：VIP 激活码管理
      // ==========================================
      if (request.method === "GET" && action === "vip_list") {
        return await handleVipList(request, env);
      }

      if (request.method === "POST" && action === "vip_add") {
        return await handleVipAdd(request, env);
      }

      if (request.method === "POST" && action === "vip_update") {
        return await handleVipUpdate(request, env);
      }

      if (request.method === "DELETE" && action === "vip_del") {
        return await handleVipDel(request, env);
      }

      // ==========================================
      // 路由 4.1：API 用户、套餐和额度管理
      // ==========================================
      if (request.method === "GET" && action === "api_user_list") {
        return await handleApiUserList(request, env);
      }

      if (request.method === "POST" && action === "api_user_create") {
        return await handleApiUserCreate(request, env);
      }

      if (request.method === "POST" && action === "api_user_update") {
        return await handleApiUserUpdate(request, env);
      }

      if (request.method === "POST" && action === "api_user_rotate_key") {
        return await handleApiUserRotateKey(request, env);
      }

      if (request.method === "POST" && action === "api_user_reset_daily") {
        return await handleApiUserResetDaily(request, env);
      }

      // ==========================================
      // 路由 5：安全日志与 IP 封禁管理
      // ==========================================
      if (request.method === "GET" && action === "security_logs") {
        return await handleSecurityLogs(request, env, url);
      }

      if (request.method === "GET" && action === "blocked_ips") {
        return await handleBlockedIps(request, env);
      }

      if (request.method === "GET" && action === "high_risk_users") {
        return await handleHighRiskUsers(request, env);
      }

      if (request.method === "POST" && action === "mark_high_risk_user") {
        return await handleMarkHighRiskUser(request, env);
      }

      if (request.method === "DELETE" && action === "unmark_high_risk_user") {
        return await handleUnmarkHighRiskUser(request, env);
      }

      if (request.method === "GET" && action === "d1_health") {
        return await handleD1Health(request, env);
      }

      if (request.method === "GET" && action === "d1_migrate") {
        return await handleD1MigrateFromR2(request, env, url);
      }

      if (request.method === "POST" && action === "block_ip") {
        return await handleBlockIp(request, env);
      }

      if (request.method === "POST" && action === "block_file_ip") {
        return await handleBlockFileIp(request, env);
      }

      if (request.method === "DELETE" && action === "unblock_ip") {
        return await handleUnblockIp(request, env);
      }

      // ==========================================
      // 路由 6：前台上传逻辑
      // 需要前端提交：file、duration、vip_id、captcha_id、captcha_answer
      // ==========================================
      if (request.method === "POST" && !action) {
        return await handleUpload(request, env);
      }

      return textResponse(request, env, "Method Not Allowed", 405);
    } catch (error) {
      return jsonResponse(request, env, { error: "内部错误: " + error.message }, 500);
    }
  }
};
