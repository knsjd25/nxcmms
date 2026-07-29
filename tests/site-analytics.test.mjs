import assert from "node:assert/strict";
import test from "node:test";

import { buildObservations, gaRows, gscRows, percentageChange } from "../scripts/site-analytics.mjs";

test("Search Console rows map dimensions and metrics without changing values", () => {
  assert.deepEqual(
    gscRows({ rows: [{ keys: ["/upload"], clicks: 2, impressions: 40, ctr: 0.05, position: 4.5 }] }, ["page"]),
    [{ page: "/upload", clicks: 2, impressions: 40, ctr: 0.05, position: 4.5 }],
  );
});

test("GA4 rows map dimension and metric headers", () => {
  assert.deepEqual(
    gaRows({
      dimensionHeaders: [{ name: "country" }],
      metricHeaders: [{ name: "activeUsers" }],
      rows: [{ dimensionValues: [{ value: "United Kingdom" }], metricValues: [{ value: "12" }] }],
    }),
    [{ country: "United Kingdom", activeUsers: 12 }],
  );
});

test("percentage change handles ordinary, zero and new baselines", () => {
  assert.equal(percentageChange(150, 100), 50);
  assert.equal(percentageChange(0, 0), 0);
  assert.equal(percentageChange(10, 0), null);
});

test("automated observations flag search and landing-page opportunities", () => {
  const observations = buildObservations({
    searchConsole: {
      current: { clicks: 0, impressions: 120 },
      previous: { clicks: 0, impressions: 100 },
      pages: [{ page: "https://mini-tools.uk/upload", impressions: 25, position: 4, ctr: 0 }],
    },
    ga4: {
      current: { sessions: 20 },
      previous: { sessions: 10 },
    },
  });
  assert.match(observations.join("\n"), /no clicks/i);
  assert.match(observations.join("\n"), /mini-tools\.uk\/upload/);
  assert.match(observations.join("\n"), /GA4 sessions changed \+100%/);
});
