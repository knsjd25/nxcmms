/**
 * D1 history cleanup for api.mini-tools.uk upload Worker.
 *
 * Wire into the main worker:
 *
 * 1) Add to adminActions Set:
 *    "cleanup_d1_history"
 *
 * 2) Add route before upload POST:
 *    if (request.method === "POST" && action === "cleanup_d1_history") {
 *      return await handleCleanupD1History(request, env, url);
 *    }
 *
 * 3) Extend scheduled():
 *    await cleanupD1History(env, { event_retention_days: 90, purge_deleted_images: true });
 *
 * Or copy the functions below directly into the main worker file.
 */

function clampRetentionDays(value) {
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

  const eventRetentionDays = clampRetentionDays(options.event_retention_days);
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
    await env.DB.prepare(`VACUUM`).run();
    vacuumed = true;
  } catch (error) {
    vacuumed = false;
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
  if (request.method === "POST") {
    try {
      body = await request.json();
    } catch (error) {
      body = {};
    }
  }

  const eventRetentionDays = clampRetentionDays(
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
