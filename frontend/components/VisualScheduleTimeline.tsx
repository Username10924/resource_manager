'use client';

import { useMemo, useState } from 'react';

type ItemKind = 'booking' | 'reservation';

export type VisualScheduleItem = {
  id: string | number;
  kind: ItemKind;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  label: string;
  sublabel?: string;
  status?: string;
};

export function VisualScheduleTimeline({
  windowStart,
  windowEnd,
  selectionStart,
  selectionEnd,
  onSelectionChange,
  rowLabel,
  rowSublabel,
  items,
}: {
  windowStart: string;
  windowEnd: string;
  selectionStart: string;
  selectionEnd: string;
  onSelectionChange: (start: string, end: string) => void;
  rowLabel: string;
  rowSublabel?: string;
  items: VisualScheduleItem[];
}) {
  const CELL_WIDTH = 36;
  const LEFT_COL_WIDTH = 240;

  const [pendingStart, setPendingStart] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = parseISODate(windowStart);
    const end = parseISODate(windowEnd);
    if (!start || !end) return [] as Date[];

    const result: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      result.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [windowStart, windowEnd]);

  const dayKeys = useMemo(() => days.map((d) => formatISODate(d)), [days]);

  const selection = useMemo(() => {
    const start = parseISODate(selectionStart);
    const end = parseISODate(selectionEnd);
    if (!start || !end) return null;

    const normalizedStart = start <= end ? start : end;
    const normalizedEnd = start <= end ? end : start;

    return {
      start: formatISODate(normalizedStart),
      end: formatISODate(normalizedEnd),
    };
  }, [selectionStart, selectionEnd]);

  const laneLayout = useMemo(() => {
    const startIndexByDay = new Map(dayKeys.map((k, idx) => [k, idx]));

    const visible = items
      .map((item) => {
        const clipped = clipToWindow(item, windowStart, windowEnd);
        if (!clipped) return null;

        const startIndex = startIndexByDay.get(clipped.visibleStart) ?? 0;
        const endIndex = startIndexByDay.get(clipped.visibleEnd) ?? 0;

        return {
          item,
          startIndex,
          endIndex,
        };
      })
      .filter(Boolean) as Array<{ item: VisualScheduleItem; startIndex: number; endIndex: number }>;

    visible.sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex);

    const lanes: Array<Array<{ item: VisualScheduleItem; startIndex: number; endIndex: number }>> = [];

    for (const entry of visible) {
      let placed = false;
      for (const lane of lanes) {
        const last = lane[lane.length - 1];
        if (last.endIndex < entry.startIndex) {
          lane.push(entry);
          placed = true;
          break;
        }
      }
      if (!placed) {
        lanes.push([entry]);
      }
    }

    return lanes;
  }, [items, dayKeys, windowStart, windowEnd]);

  const laneCount = Math.max(1, laneLayout.length);
  const timelineHeight = 12 + laneCount * 26;

  const gridTemplateColumns = useMemo(
    () => `${LEFT_COL_WIDTH}px repeat(${days.length}, ${CELL_WIDTH}px)`,
    [days.length]
  );

  const handleDayClick = (dateKey: string) => {
    if (!pendingStart) {
      setPendingStart(dateKey);
      onSelectionChange(dateKey, dateKey);
      return;
    }

    const start = pendingStart;
    const end = dateKey;
    const normalized = normalizeRange(start, end);
    setPendingStart(null);
    onSelectionChange(normalized.start, normalized.end);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <div
          className="grid border-b border-gray-200 bg-gray-50"
          style={{ gridTemplateColumns }}
        >
          <div className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-sm font-semibold text-gray-900">{rowLabel}</div>
            {rowSublabel ? <div className="mt-0.5 text-xs text-gray-600">{rowSublabel}</div> : null}
            <div className="mt-2 text-[11px] text-gray-500">Click a start day, then an end day</div>
          </div>

          {days.map((d) => {
            const key = formatISODate(d);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div
                key={key}
                className={`border-r border-gray-200 px-1 py-2 text-center ${
                  isWeekend ? 'bg-gray-100/50' : ''
                }`}
              >
                <div className="text-[10px] font-medium text-gray-500">
                  {d.toLocaleDateString(undefined, { weekday: 'short' })}
                </div>
                <div className="text-xs font-semibold text-gray-700">{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        <div className="grid" style={{ gridTemplateColumns }}>
          <div
            className="sticky left-0 z-10 border-r border-gray-200 bg-white px-4 py-3"
            style={{ minHeight: timelineHeight }}
          />

          <div
            className="relative"
            style={{ width: days.length * CELL_WIDTH, minHeight: timelineHeight }}
          >
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${days.length}, ${CELL_WIDTH}px)` }}>
              {days.map((d) => {
                const key = formatISODate(d);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isSelected =
                  selection &&
                  compareISODate(key, selection.start) >= 0 &&
                  compareISODate(key, selection.end) <= 0;

                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => handleDayClick(key)}
                    className={`h-full border-r border-gray-200 transition-colors ${
                      isWeekend ? 'bg-gray-50' : 'bg-white'
                    } ${isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'} ${
                      pendingStart === key ? 'ring-2 ring-gray-400 ring-inset' : ''
                    }`}
                    aria-label={`Select ${key}`}
                  />
                );
              })}
            </div>

            {/* Bars */}
            {laneLayout.map((lane, laneIndex) =>
              lane.map(({ item, startIndex, endIndex }) => {
                const left = startIndex * CELL_WIDTH + 2;
                const width = (endIndex - startIndex + 1) * CELL_WIDTH - 4;
                const top = 10 + laneIndex * 26;

                const classes = getBarClasses(item);

                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className={`absolute overflow-hidden whitespace-nowrap text-ellipsis rounded-md border px-2 py-1 text-[11px] ${classes}`}
                    style={{ left, top, width }}
                    title={`${item.label} (${item.start_date} → ${item.end_date})`}
                  >
                    <span className="font-semibold">{item.label}</span>
                    {item.sublabel ? <span className="ml-1 opacity-80">• {item.sublabel}</span> : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border border-orange-200 bg-orange-100" />
          <span>Booking</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border border-purple-200 bg-purple-100" />
          <span>Reservation</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border border-gray-200 bg-gray-100" />
          <span>Selected range</span>
        </div>
      </div>
    </div>
  );
}

function getBarClasses(item: VisualScheduleItem) {
  const status = (item.status || '').toLowerCase();
  if (status === 'cancelled' || status === 'canceled') {
    return 'bg-gray-100 border-gray-200 text-gray-600';
  }

  if (item.kind === 'booking') {
    return 'bg-orange-100 border-orange-200 text-orange-900';
  }

  return 'bg-purple-100 border-purple-200 text-purple-900';
}

function parseISODate(value: string): Date | null {
  if (!value || typeof value !== 'string') return null;
  const [y, m, d] = value.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function compareISODate(a: string, b: string) {
  // Lexicographic compare works for YYYY-MM-DD
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function normalizeRange(a: string, b: string) {
  return compareISODate(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a };
}

function clipToWindow(item: VisualScheduleItem, windowStart: string, windowEnd: string) {
  const start = item.start_date;
  const end = item.end_date;
  if (!start || !end) return null;

  const normalized = normalizeRange(start, end);
  const visibleStart = compareISODate(normalized.start, windowStart) < 0 ? windowStart : normalized.start;
  const visibleEnd = compareISODate(normalized.end, windowEnd) > 0 ? windowEnd : normalized.end;

  if (compareISODate(visibleStart, visibleEnd) > 0) return null;

  return { visibleStart, visibleEnd };
}
