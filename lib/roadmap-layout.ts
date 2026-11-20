import { addDaysISO, diffDaysISO, parseISODate } from "./dates.ts";

export const ROW_HEIGHT = 34;
export const LANE_HEIGHT = 26;
export const MIN_EVENT_WIDTH = 22;

export interface LayoutMilestone {
  id: number;
  start: string;
  end: string;
}

export interface MonthSegment {
  startIso: string;
  label: string;
  count: number;
}

export interface LayoutItem {
  id: number;
  lane: number;
  offsetDays: number;
  spanDays: number;
  clippedLeft: boolean;
  clippedRight: boolean;
}

export interface RowLayout {
  items: LayoutItem[];
  laneCount: number;
  rowHeight: number;
}

export function getMonthSegments(startIso: string, dayCount: number): MonthSegment[] {
  const segments: MonthSegment[] = [];
  let date = parseISODate(startIso);

  for (let index = 0; index < dayCount; index += 1) {
    const iso = addDaysISO(startIso, index);
    const label = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(date);
    const previous = segments[segments.length - 1];

    if (previous?.label === label) {
      previous.count += 1;
    } else {
      segments.push({ startIso: iso, label, count: 1 });
    }

    date = parseISODate(addDaysISO(iso, 1));
  }
  return segments;
}

export function layoutRow(
  milestones: readonly LayoutMilestone[],
  viewStartIso: string,
  dayCount: number
): RowLayout {
  const viewEndIso = addDaysISO(viewStartIso, dayCount - 1);
  const sorted = milestones
    .map((milestone, index) => ({ milestone, index }))
    .sort(
      (a, b) =>
        a.milestone.start.localeCompare(b.milestone.start) ||
        a.milestone.end.localeCompare(b.milestone.end) ||
        a.index - b.index
    );
  const laneEnds: string[] = [];
  const items: LayoutItem[] = [];

  for (const { milestone } of sorted) {
    let lane = laneEnds.findIndex((end) => milestone.start > end);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = milestone.end;

    if (milestone.end < viewStartIso || milestone.start > viewEndIso) continue;

    const clippedStart = milestone.start < viewStartIso ? viewStartIso : milestone.start;
    const clippedEnd = milestone.end > viewEndIso ? viewEndIso : milestone.end;
    items.push({
      id: milestone.id,
      lane,
      offsetDays: diffDaysISO(viewStartIso, clippedStart),
      spanDays: diffDaysISO(clippedStart, clippedEnd) + 1,
      clippedLeft: milestone.start < viewStartIso,
      clippedRight: milestone.end > viewEndIso,
    });
  }

  const laneCount = Math.max(1, laneEnds.length);
  return {
    items,
    laneCount,
    rowHeight: laneCount === 1 ? ROW_HEIGHT : laneCount * LANE_HEIGHT + 8,
  };
}

export function dueStatus(endIso: string, todayIso: string): string {
  const daysUntilDue = diffDaysISO(todayIso, endIso);
  if (daysUntilDue > 0) return `Jatuh tempo ${daysUntilDue} hari lagi`;
  if (daysUntilDue === 0) return "Jatuh tempo hari ini";
  return `Terlambat ${Math.abs(daysUntilDue)} hari`;
}
