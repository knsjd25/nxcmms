import { createPrivateKey, sign } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_GSC_PROPERTY = "sc-domain:mini-tools.uk";
const DEFAULT_GA4_PROPERTY_ID = "526213865";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
].join(" ");

function cliValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function isoDate(daysFromToday) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

function base64url(value) {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
}

async function createGoogleAccessToken(credentialPath) {
  const credentials = JSON.parse(await readFile(credentialPath, "utf8"));
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Google credential JSON is missing client_email or private_key");
  }

  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url({ alg: "RS256", typ: "JWT" })}.${base64url({
    iss: credentials.client_email,
    scope: GOOGLE_SCOPES,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;
  const assertion = `${unsigned}.${sign(
    "RSA-SHA256",
    Buffer.from(unsigned),
    createPrivateKey(credentials.private_key),
  ).toString("base64url")}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google token request failed (${response.status}): ${payload.error_description || payload.error || "unknown error"}`);
  }
  return payload.access_token;
}

async function googleJson(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${url} failed (${response.status}): ${payload.error?.message || payload.error_description || "unknown error"}`);
  }
  return payload;
}

function gscRows(payload, dimensions = []) {
  return (payload.rows || []).map((row) => ({
    ...Object.fromEntries(dimensions.map((name, index) => [name, row.keys?.[index] || ""])),
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0),
    position: Number(row.position || 0),
  }));
}

function gscTotal(payload) {
  return gscRows(payload)[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
}

async function querySearchConsole(accessToken, property, body) {
  return googleJson(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
    accessToken,
    { method: "POST", body: JSON.stringify({ dataState: "all", type: "web", ...body }) },
  );
}

function gaRows(payload) {
  const dimensions = payload.dimensionHeaders || [];
  const metrics = payload.metricHeaders || [];
  return (payload.rows || []).map((row) => ({
    ...Object.fromEntries(dimensions.map((header, index) => [header.name, row.dimensionValues?.[index]?.value || ""])),
    ...Object.fromEntries(metrics.map((header, index) => [header.name, Number(row.metricValues?.[index]?.value || 0)])),
  }));
}

async function queryGa4(accessToken, propertyId, body, realtime = false) {
  const method = realtime ? "runRealtimeReport" : "runReport";
  return googleJson(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:${method}`,
    accessToken,
    { method: "POST", body: JSON.stringify(body) },
  );
}

function percentageChange(current, previous) {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
}

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString("en-GB", { maximumFractionDigits: digits });
}

function formatPercent(value, digits = 1) {
  return `${formatNumber(Number(value || 0) * 100, digits)}%`;
}

function formatDelta(value) {
  if (value === null) return "new";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(value, 1)}%`;
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function markdownTable(headers, rows) {
  if (!rows.length) return "No data returned.";
  const heading = `| ${headers.map((header) => escapeCell(header.label)).join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${headers.map((header) => escapeCell(header.value(row))).join(" | ")} |`).join("\n");
  return `${heading}\n${divider}\n${body}`;
}

function buildObservations(report) {
  const observations = [];
  const gsc = report.searchConsole;
  if (gsc?.current) {
    const change = percentageChange(gsc.current.impressions, gsc.previous.impressions);
    observations.push(`Google Search impressions changed ${formatDelta(change)} versus the previous 28 days.`);
    if (gsc.current.impressions > 0 && gsc.current.clicks === 0) {
      observations.push("Google recorded impressions but no clicks in the current period; snippets and query intent need review.");
    }
    const opportunities = gsc.pages.filter((row) => row.impressions >= 5 && row.position <= 20 && row.ctr < 0.02).slice(0, 5);
    if (opportunities.length) {
      observations.push(`Low-CTR ranking opportunities: ${opportunities.map((row) => row.page).join(", ")}.`);
    }
  }
  const ga4 = report.ga4;
  if (ga4?.current) {
    const sessionChange = percentageChange(ga4.current.sessions, ga4.previous.sessions);
    observations.push(`GA4 sessions changed ${formatDelta(sessionChange)} versus the previous 28 days.`);
  }
  if (!observations.length) observations.push("No automated observations were available because one or more data sources returned no data.");
  return observations;
}

function buildMarkdown(report) {
  const lines = [
    "# Mini-Tools.uk analytics report",
    "",
    `Generated: ${report.generatedAt}`,
    `Current period: ${report.period.current.startDate} to ${report.period.current.endDate}`,
    `Previous period: ${report.period.previous.startDate} to ${report.period.previous.endDate}`,
    "",
    "## Automated observations",
    "",
    ...report.observations.map((item) => `- ${item}`),
    "",
    "## Google Search Console",
    "",
  ];

  if (report.errors.searchConsole) {
    lines.push(`Unavailable: ${report.errors.searchConsole}`, "");
  } else {
    const current = report.searchConsole.current;
    const previous = report.searchConsole.previous;
    lines.push(
      `- Clicks: ${formatNumber(current.clicks)} (${formatDelta(percentageChange(current.clicks, previous.clicks))})`,
      `- Impressions: ${formatNumber(current.impressions)} (${formatDelta(percentageChange(current.impressions, previous.impressions))})`,
      `- CTR: ${formatPercent(current.ctr)}`,
      `- Average position: ${formatNumber(current.position, 2)}`,
      "",
      "### Top pages",
      "",
      markdownTable(
        [
          { label: "Page", value: (row) => row.page },
          { label: "Clicks", value: (row) => row.clicks },
          { label: "Impressions", value: (row) => row.impressions },
          { label: "CTR", value: (row) => formatPercent(row.ctr) },
          { label: "Position", value: (row) => formatNumber(row.position, 2) },
        ],
        report.searchConsole.pages.slice(0, 20),
      ),
      "",
      "### Top queries",
      "",
      markdownTable(
        [
          { label: "Query", value: (row) => row.query },
          { label: "Clicks", value: (row) => row.clicks },
          { label: "Impressions", value: (row) => row.impressions },
          { label: "CTR", value: (row) => formatPercent(row.ctr) },
          { label: "Position", value: (row) => formatNumber(row.position, 2) },
        ],
        report.searchConsole.queries.slice(0, 20),
      ),
      "",
    );
  }

  lines.push("## Google Analytics 4", "");
  if (report.errors.ga4) {
    lines.push(`Unavailable: ${report.errors.ga4}`, "");
  } else {
    const current = report.ga4.current;
    const previous = report.ga4.previous;
    lines.push(
      `- Active users: ${formatNumber(current.activeUsers)} (${formatDelta(percentageChange(current.activeUsers, previous.activeUsers))})`,
      `- Sessions: ${formatNumber(current.sessions)} (${formatDelta(percentageChange(current.sessions, previous.sessions))})`,
      `- Page views: ${formatNumber(current.screenPageViews)} (${formatDelta(percentageChange(current.screenPageViews, previous.screenPageViews))})`,
      `- Engagement rate: ${formatPercent(current.engagementRate)}`,
      `- Average session duration: ${formatNumber(current.averageSessionDuration, 1)} seconds`,
      "",
      "### Top landing pages",
      "",
      markdownTable(
        [
          { label: "Landing page", value: (row) => row.landingPagePlusQueryString },
          { label: "Users", value: (row) => row.activeUsers },
          { label: "Sessions", value: (row) => row.sessions },
          { label: "Views", value: (row) => row.screenPageViews },
          { label: "Engagement", value: (row) => formatPercent(row.engagementRate) },
        ],
        report.ga4.landingPages.slice(0, 20),
      ),
      "",
      "### Traffic channels",
      "",
      markdownTable(
        [
          { label: "Channel", value: (row) => row.sessionDefaultChannelGroup },
          { label: "Users", value: (row) => row.activeUsers },
          { label: "Sessions", value: (row) => row.sessions },
          { label: "Engagement", value: (row) => formatPercent(row.engagementRate) },
        ],
        report.ga4.channels,
      ),
      "",
      `Realtime active users: ${formatNumber(report.ga4.realtime.reduce((sum, row) => sum + row.activeUsers, 0))}`,
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

async function collectSearchConsole(accessToken, property, period) {
  const sites = await googleJson("https://www.googleapis.com/webmasters/v3/sites", accessToken);
  const entry = (sites.siteEntry || []).find((site) => site.siteUrl === property);
  if (!entry) throw new Error(`The service account cannot access Search Console property ${property}`);
  const base = { startDate: period.current.startDate, endDate: period.current.endDate };
  const previousBase = { startDate: period.previous.startDate, endDate: period.previous.endDate };
  const [current, previous, daily, pages, queries, countries, devices] = await Promise.all([
    querySearchConsole(accessToken, property, base),
    querySearchConsole(accessToken, property, previousBase),
    querySearchConsole(accessToken, property, { ...base, dimensions: ["date"], rowLimit: 100 }),
    querySearchConsole(accessToken, property, { ...base, dimensions: ["page"], rowLimit: 250 }),
    querySearchConsole(accessToken, property, { ...base, dimensions: ["query"], rowLimit: 250 }),
    querySearchConsole(accessToken, property, { ...base, dimensions: ["country"], rowLimit: 250 }),
    querySearchConsole(accessToken, property, { ...base, dimensions: ["device"], rowLimit: 10 }),
  ]);
  return {
    permissionLevel: entry.permissionLevel,
    current: gscTotal(current),
    previous: gscTotal(previous),
    daily: gscRows(daily, ["date"]),
    pages: gscRows(pages, ["page"]),
    queries: gscRows(queries, ["query"]),
    countries: gscRows(countries, ["country"]),
    devices: gscRows(devices, ["device"]),
  };
}

async function collectGa4(accessToken, propertyId, period) {
  const summaryBody = (dateRange) => ({
    dateRanges: [dateRange],
    metrics: ["activeUsers", "sessions", "screenPageViews", "engagementRate", "averageSessionDuration"].map((name) => ({ name })),
  });
  const currentRange = { startDate: period.current.startDate, endDate: period.current.endDate };
  const previousRange = { startDate: period.previous.startDate, endDate: period.previous.endDate };
  const [current, previous, daily, landingPages, channels, countries, devices, realtime] = await Promise.all([
    queryGa4(accessToken, propertyId, summaryBody(currentRange)),
    queryGa4(accessToken, propertyId, summaryBody(previousRange)),
    queryGa4(accessToken, propertyId, {
      dateRanges: [currentRange], dimensions: [{ name: "date" }],
      metrics: ["activeUsers", "sessions", "screenPageViews"].map((name) => ({ name })),
      orderBys: [{ dimension: { dimensionName: "date" } }], limit: "100",
    }),
    queryGa4(accessToken, propertyId, {
      dateRanges: [currentRange], dimensions: [{ name: "landingPagePlusQueryString" }],
      metrics: ["activeUsers", "sessions", "screenPageViews", "engagementRate"].map((name) => ({ name })),
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: "100",
    }),
    queryGa4(accessToken, propertyId, {
      dateRanges: [currentRange], dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: ["activeUsers", "sessions", "engagementRate"].map((name) => ({ name })),
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: "50",
    }),
    queryGa4(accessToken, propertyId, {
      dateRanges: [currentRange], dimensions: [{ name: "country" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }], limit: "100",
    }),
    queryGa4(accessToken, propertyId, {
      dateRanges: [currentRange], dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }], limit: "20",
    }),
    queryGa4(accessToken, propertyId, {
      dimensions: [{ name: "country" }, { name: "deviceCategory" }],
      metrics: [{ name: "activeUsers" }], limit: "100",
    }, true),
  ]);
  const emptySummary = { activeUsers: 0, sessions: 0, screenPageViews: 0, engagementRate: 0, averageSessionDuration: 0 };
  return {
    current: gaRows(current)[0] || emptySummary,
    previous: gaRows(previous)[0] || emptySummary,
    daily: gaRows(daily),
    landingPages: gaRows(landingPages),
    channels: gaRows(channels),
    countries: gaRows(countries),
    devices: gaRows(devices),
    realtime: gaRows(realtime),
  };
}

async function main() {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialPath) throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set");
  const property = process.env.MINITOOLS_GSC_PROPERTY || DEFAULT_GSC_PROPERTY;
  const propertyId = process.env.MINITOOLS_GA4_PROPERTY_ID || DEFAULT_GA4_PROPERTY_ID;
  const outputDirectory = cliValue("--output-dir") || join(process.env.LOCALAPPDATA || homedir(), "MiniToolsAnalytics", "reports");
  const period = {
    current: { startDate: isoDate(-28), endDate: isoDate(-1) },
    previous: { startDate: isoDate(-56), endDate: isoDate(-29) },
  };
  const report = {
    generatedAt: new Date().toISOString(), property, propertyId, period,
    searchConsole: null, ga4: null, errors: {}, observations: [],
  };

  const accessToken = await createGoogleAccessToken(credentialPath);
  try {
    report.searchConsole = await collectSearchConsole(accessToken, property, period);
  } catch (error) {
    report.errors.searchConsole = error instanceof Error ? error.message : String(error);
  }
  try {
    report.ga4 = await collectGa4(accessToken, propertyId, period);
  } catch (error) {
    report.errors.ga4 = error instanceof Error ? error.message : String(error);
  }
  report.observations = buildObservations(report);

  await mkdir(outputDirectory, { recursive: true });
  const timestamp = report.generatedAt.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  const jsonPath = join(outputDirectory, `mini-tools-analytics-${timestamp}.json`);
  const markdownPath = join(outputDirectory, `mini-tools-analytics-${timestamp}.md`);
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, buildMarkdown(report), "utf8"),
  ]);
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Markdown report: ${markdownPath}`);
  if (report.errors.searchConsole || report.errors.ga4) process.exitCode = 1;
}

const isMain = process.argv[1] && new URL(import.meta.url).pathname.replace(/^\/(.:\/)/, "$1")
  .replaceAll("/", "\\").toLowerCase() === process.argv[1].replaceAll("/", "\\").toLowerCase();
if (isMain) main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

export { buildObservations, gscRows, gaRows, percentageChange };
