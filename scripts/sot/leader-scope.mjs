export function applyLeaderFilterInTransaction(db, scope, keptKeys) {
  const deactivate = db.prepare("UPDATE sot_projects SET is_active = 0 WHERE fy = ?");
  for (const fy of scope) deactivate.run(fy);

  const activate = db.prepare("UPDATE sot_projects SET is_active = 1 WHERE external_key = ? AND fy = ?");
  for (const key of keptKeys) {
    for (const fy of scope) activate.run(key, fy);
  }

  const placeholders = scope.map(() => "?").join(",");
  const kept = Number(
    db
      .prepare(`SELECT COUNT(*) AS n FROM sot_projects WHERE is_active = 1 AND fy IN (${placeholders})`)
      .get(...scope).n
  );
  const deactivated = Number(
    db
      .prepare(`SELECT COUNT(*) AS n FROM sot_projects WHERE is_active = 0 AND fy IN (${placeholders})`)
      .get(...scope).n
  );
  return { kept, deactivated };
}
