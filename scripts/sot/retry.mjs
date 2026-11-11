export function readIntEnv(value, { def, min, max }) {
  if (value === undefined || value === null || String(value).trim() === "") return def;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : def;
}

export function isRetryable(result) {
  if (!result || result.status === "error") return true;
  return result.status === "http" && (result.code === 429 || result.code >= 500);
}

export function backoffMs(attempt, base = 5000) {
  return base * 3 ** (attempt - 1);
}

export async function readAllWithRetry({
  fys,
  readOne,
  retries,
  sleep,
  onProgress,
  onWarn,
  maxConsecutiveFailures = 3,
  interReadDelayMs = 0,
}) {
  const results = [];
  let consecutiveFailures = 0;

  for (let index = 0; index < fys.length; index += 1) {
    const fy = fys[index];
    let result;
    let attempts = 0;

    for (let retry = 0; retry <= retries; retry += 1) {
      attempts += 1;
      result = await readOne(fy);
      if (!isRetryable(result) || retry === retries) break;

      const delay = backoffMs(retry + 1);
      onWarn?.(
        `${fy.label ?? fy.fy ?? fy} gagal (${result.message ?? result.status}), coba lagi ${retry + 1}/${retries} dalam ${delay / 1000} dtk`
      );
      await sleep(delay);
    }

    const finalResult = { ...result, attempts };
    results.push({ fy: fy.label ?? fy.fy ?? fy, ...finalResult });
    onProgress?.(results.length, fys.length, finalResult);

    if (finalResult.status === "ok") {
      consecutiveFailures = 0;
    } else {
      consecutiveFailures += 1;
      if (consecutiveFailures >= maxConsecutiveFailures && index < fys.length - 1) {
        const reason = `${maxConsecutiveFailures} FY berturut-turut gagal`;
        for (const skipped of fys.slice(index + 1)) {
          const skippedResult = {
            fy: skipped.label ?? skipped.fy ?? skipped,
            status: "skipped",
            message: `dilewati karena ${reason}`,
            attempts: 0,
          };
          results.push(skippedResult);
          onProgress?.(results.length, fys.length, skippedResult);
        }
        break;
      }
    }

    if (index < fys.length - 1 && results.length === index + 1 && interReadDelayMs > 0) {
      await sleep(interReadDelayMs);
    }
  }

  return results;
}
