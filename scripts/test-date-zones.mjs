import { spawnSync } from "node:child_process";
import process from "node:process";

for (const zone of ["Asia/Jakarta", "UTC", "America/New_York"]) {
  const result = spawnSync(process.execPath, ["--test", "scripts/test-date.mjs"], {
    env: { ...process.env, TZ: zone },
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
