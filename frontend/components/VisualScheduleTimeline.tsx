'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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

export type VisualScheduleContextMenuItem = {
  id: string;
  label: string;
  disabled?: boolean;
  onSelect: () => void;
};

export function VisualScheduleTimeline({
  windowStart,
  windowEnd,
  selectionStart,
  selectionEnd,
  onSelectionChange,
  onSelectionPreview,
  commitSelectionOnMouseUp,
  rowLabel,
  rowSublabel,
  items,
  cellWidth,
  leftColumnWidth,
  minBodyHeight,
  contextMenuItems,
  stickyScrollbar,
  wheelToHorizontal,
}: {
  windowStart: string;
  windowEnd: string;
  selectionStart: string;
  selectionEnd: string;
  onSelectionChange: (start: string, end: string) => void;
  onSelectionPreview?: (start: string, end: string) => void;
  commitSelectionOnMouseUp?: boolean;
  rowLabel: string;
  rowSublabel?: string;
  items: VisualScheduleItem[];
  cellWidth?: number;
  leftColumnWidth?: number;
  minBodyHeight?: number;
  contextMenuItems?: VisualScheduleContextMenuItem[];
  stickyScrollbar?: boolean;
  wheelToHorizontal?: boolean;
}) {
  const CELL_WIDTH = cellWidth ?? 32;
  const LEFT_COL_WIDTH = leftColumnWidth ?? 200;
  const MIN_BODY_HEIGHT = minBodyHeight ?? 0;
  const COMMIT_ON_MOUSE_UP = commitSelectionOnMouseUp ?? false;
  const BAR_HEIGHT = 28;
  const BAR_GAP = 4;
  const BAR_TOP_OFFSET = 6;

  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragMovedRef = useRef(false);
  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number }>(
    { open: false, x: 0, y: 0 }
  );

  const rootRef = useRef<HTMLDivElement | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const barScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);

  const dragStartKeyRef = useRef<string | null>(null);
  const lastClientXRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const days = useMemo(() => {
    const start = parseISODate(toDateKey(windowStart) ?? windowStart);
    const end = parseISODate(toDateKey(windowEnd) ?? windowEnd);
    if (!start || !end) return [] as Date[];

    const result: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      result.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [windowStart, windowEnd]);

  const monthSegments = useMemo(() => {
    if (days.length === 0) return [] as Array<{ key: string; label: string; count: number }>;

    const startYear = days[0].getFullYear();
    const endYear = days[days.length - 1].getFullYear();
    const includeYear = startYear !== endYear;

    const segs: Array<{ key: string; label: string; count: number }> = [];
    let currentKey = `${days[0].getFullYear()}-${days[0].getMonth()}`;
    let currentCount = 0;

    for (const d of days) {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key !== currentKey) {
        const [yStr, mStr] = currentKey.split('-');
        const y = Number(yStr);
        const m = Number(mStr);
        const labelDate = new Date(y, m, 1);
        segs.push({
          key: currentKey,
          label: labelDate.toLocaleDateString(undefined, {
            month: 'short',
            ...(includeYear ? { year: 'numeric' } : null),
          } as Intl.DateTimeFormatOptions),
          count: currentCount,
        });
        currentKey = key;
        currentCount = 0;
      }
      currentCount += 1;
    }

    const [yStr, mStr] = currentKey.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const labelDate = new Date(y, m, 1);
    segs.push({
      key: currentKey,
      label: labelDate.toLocaleDateString(undefined, {
        month: 'short',
        ...(includeYear ? { year: 'numeric' } : null),
      } as Intl.DateTimeFormatOptions),
      count: currentCount,
    });

    return segs;
  }, [days]);

  const dayKeys = useMemo(() => days.map((d) => formatISODate(d)), [days]);

  const todayKey = useMemo(() => formatISODate(new Date()), []);

  const selection = useMemo(() => {
    const start = parseISODate(toDateKey(selectionStart) ?? selectionStart);
    const end = parseISODate(toDateKey(selectionEnd) ?? selectionEnd);
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

  const selectionOverlay = useMemo(() => {
    if (!selection) return null;
    const startIndexByDay = new Map(dayKeys.map((k, idx) => [k, idx]));
    const startIdx = startIndexByDay.get(selection.start);
    const endIdx = startIndexByDay.get(selection.end);
    if (startIdx === undefined || endIdx === undefined) return null;

    const normalizedStartIdx = Math.min(startIdx, endIdx);
    const normalizedEndIdx = Math.max(startIdx, endIdx);

    return {
      left: normalizedStartIdx * CELL_WIDTH,
      width: (normalizedEndIdx - normalizedStartIdx + 1) * CELL_WIDTH,
    };
  }, [selection, dayKeys, CELL_WIDTH]);

  const todayIndex = useMemo(() => {
    const idx = dayKeys.indexOf(todayKey);
    return idx >= 0 ? idx : null;
  }, [dayKeys, todayKey]);

  const laneCount = Math.max(1, laneLayout.length);
  const timelineHeight = BAR_TOP_OFFSET + laneCount * (BAR_HEIGHT + BAR_GAP) + BAR_GAP;
  const bodyHeight = Math.max(timelineHeight, MIN_BODY_HEIGHT);

  const timelineWidth = days.length * CELL_WIDTH;

  const gridTemplateColumns = useMemo(
    () => `${LEFT_COL_WIDTH}px repeat(${days.length}, ${CELL_WIDTH}px)`,
    [days.length, LEFT_COL_WIDTH, CELL_WIDTH]
  );

  const syncScroll = (source: HTMLDivElement | null, target: HTMLDivElement | null) => {
    if (!source || !target) return;
    if (syncingScrollRef.current) return;
    syncingScrollRef.current = true;
    target.scrollLeft = source.scrollLeft;
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  };

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (!wheelToHorizontal) return;
    const el = mainScrollRef.current;
    if (!el) return;

    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    if (e.deltaY !== 0) {
      el.scrollLeft += e.deltaY;
      syncScroll(el, barScrollRef.current);
      e.preventDefault();
    }
  };

  const handleDragStart = (dateKey: string) => {
    setIsDragging(true);
    dragMovedRef.current = false;
    setPendingStart(dateKey);
    dragStartKeyRef.current = dateKey;
    if (COMMIT_ON_MOUSE_UP) {
      onSelectionPreview?.(dateKey, dateKey);
    } else {
      onSelectionChange(dateKey, dateKey);
    }
  };

  const handleDragOver = (dateKey: string) => {
    if (!isDragging || !pendingStart) return;
    if (dateKey !== pendingStart) dragMovedRef.current = true;
    const normalized = normalizeRange(pendingStart, dateKey);
    if (COMMIT_ON_MOUSE_UP) {
      onSelectionPreview?.(normalized.start, normalized.end);
    } else {
      onSelectionChange(normalized.start, normalized.end);
    }
  };

  const handleDragEnd = (dateKey?: string) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (!pendingStart) return;

    const effectiveEndKey =
      dateKey ?? (lastClientXRef.current !== null ? getDateKeyFromClientX(lastClientXRef.current) : null);
    if (effectiveEndKey) {
      const normalized = normalizeRange(pendingStart, effectiveEndKey);
      onSelectionChange(normalized.start, normalized.end);
    }
    setPendingStart(null);
    dragStartKeyRef.current = null;
    lastClientXRef.current = null;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };

  const getDateKeyFromClientX = (clientX: number): string | null => {
    const scroller = mainScrollRef.current;
    if (!scroller) return null;

    const rect = scroller.getBoundingClientRect();
    const xInViewport = clientX - rect.left;
    const xInContent = scroller.scrollLeft + xInViewport;
    const xInDays = xInContent - LEFT_COL_WIDTH;
    const index = Math.floor(xInDays / CELL_WIDTH);
    if (Number.isNaN(index)) return null;
    const clamped = Math.max(0, Math.min(dayKeys.length - 1, index));
    return dayKeys[clamped] ?? null;
  };

  const updateDragSelectionAndAutoScroll = () => {
    rafIdRef.current = null;
    if (!isDragging) return;
    const scroller = mainScrollRef.current;
    const startKey = dragStartKeyRef.current;
    const clientX = lastClientXRef.current;
    if (!scroller || !startKey || clientX === null) return;

    const rect = scroller.getBoundingClientRect();
    const edgeThreshold = 48;
    const maxStep = 28;
    let delta = 0;

    if (clientX > rect.right - edgeThreshold) {
      const t = Math.min(1, (clientX - (rect.right - edgeThreshold)) / edgeThreshold);
      delta = Math.ceil(4 + t * maxStep);
    } else if (clientX < rect.left + edgeThreshold) {
      const t = Math.min(1, ((rect.left + edgeThreshold) - clientX) / edgeThreshold);
      delta = -Math.ceil(4 + t * maxStep);
    }

    if (delta !== 0) {
      scroller.scrollLeft += delta;
      syncScroll(scroller, barScrollRef.current);
    }

    const currentKey = getDateKeyFromClientX(clientX);
    if (currentKey) {
      const normalized = normalizeRange(startKey, currentKey);
      onSelectionChange(normalized.start, normalized.end);
    }

    rafIdRef.current = requestAnimationFrame(updateDragSelectionAndAutoScroll);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      lastClientXRef.current = e.clientX;
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(updateDragSelectionAndAutoScroll);
      }
    };

    const onMouseUp = () => {
      handleDragEnd();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  useEffect(() => {
    if (!contextMenu.open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu((c) => ({ ...c, open: false }));
    };
    const onMouseDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setContextMenu((c) => ({ ...c, open: false }));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [contextMenu.open]);

  const closeContextMenu = () => setContextMenu((c) => ({ ...c, open: false }));

  const openContextMenu = (x: number, y: number) => {
    setContextMenu({ open: true, x, y });
  };

  return (
    <div ref={rootRef} className="rounded-lg border border-gray-200 bg-white flex flex-col overflow-hidden shadow-sm">
      <div
        ref={mainScrollRef}
        className="overflow-x-auto"
        onMouseDownCapture={(e) => {
          if (!contextMenu.open) return;
          if (e.button === 0) closeContextMenu();
        }}
        onScroll={() => syncScroll(mainScrollRef.current, barScrollRef.current)}
        onWheel={handleWheel}
      >
        {/* Header: month row + day number row */}
        <div
          className="grid bg-white border-b border-gray-200"
          style={{ gridTemplateColumns }}
        >
          {/* Left column header - spans both header rows */}
          <div
            className="sticky left-0 z-10 border-r border-gray-100 bg-white flex items-center px-3"
            style={{ gridRow: 'span 2' }}
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{rowLabel}</div>
              {rowSublabel ? <div className="text-[11px] text-gray-500 truncate">{rowSublabel}</div> : null}
            </div>
          </div>

          {/* Month labels row */}
          <div
            className="grid border-b border-gray-100"
            style={{
              gridColumn: '2 / -1',
              gridTemplateColumns: `repeat(${days.length}, ${CELL_WIDTH}px)`,
            }}
          >
            {monthSegments.map((seg) => (
              <div
                key={seg.key}
                className="px-2 py-1.5 text-[11px] font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-100 bg-gray-50/50"
                style={{ gridColumn: `span ${seg.count}` }}
                title={seg.label}
              >
                {seg.label}
              </div>
            ))}
          </div>

          {/* Day numbers row - compact single row with day number only */}
          <div
            className="grid"
            style={{
              gridColumn: '2 / -1',
              gridTemplateColumns: `repeat(${days.length}, ${CELL_WIDTH}px)`,
            }}
          >
            {days.map((d) => {
              const key = formatISODate(d);
              const isWeekend = d.getDay() === 5 || d.getDay() === 6;
              const isToday = key === todayKey;
              const isMonday = d.getDay() === 0; // Sunday (week start in many locales)
              const isFirstOfMonth = d.getDate() === 1;

              return (
                <div
                  key={key}
                  className={`flex flex-col items-center justify-center py-1 text-center
                    ${isWeekend ? 'bg-gray-50/80' : 'bg-white'}
                    ${isFirstOfMonth ? 'border-l border-gray-200' : 'border-l border-gray-100/50'}
                  `}
                >
                  <div className={`text-[9px] leading-none uppercase ${isWeekend ? 'text-gray-400' : 'text-gray-400'}`}>
                    {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </div>
                  <div
                    className={`mt-0.5 text-[11px] leading-none font-medium
                      ${isToday ? 'bg-blue-600 text-white rounded-full w-[18px] h-[18px] flex items-center justify-center' : ''}
                      ${!isToday && isWeekend ? 'text-gray-400' : !isToday ? 'text-gray-600' : ''}
                    `}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Body: timeline area */}
        <div className="grid" style={{ gridTemplateColumns }}>
          {/* Left column body - empty spacer to keep alignment */}
          <div
            className="sticky left-0 z-10 border-r border-gray-100 bg-white"
            style={{ minHeight: bodyHeight }}
          />

          {/* Timeline grid and bars */}
          <div
            className="relative"
            style={{ width: timelineWidth, minHeight: bodyHeight }}
          >
            {/* Background grid cells */}
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${days.length}, ${CELL_WIDTH}px)` }}>
              {days.map((d) => {
                const key = formatISODate(d);
                const isWeekend = d.getDay() === 5 || d.getDay() === 6;
                const isFirstOfMonth = d.getDate() === 1;
                const isSelected =
                  selection &&
                  compareISODate(key, selection.start) >= 0 &&
                  compareISODate(key, selection.end) <= 0;

                return (
                  <div
                    key={key}
                    onMouseDown={(e) => {
                      if (e.button === 2) return;
                      if (contextMenu.open) closeContextMenu();
                      lastClientXRef.current = e.clientX;
                      handleDragStart(key);
                    }}
                    onMouseEnter={() => {
                      if (!isDragging) return;
                      handleDragOver(key);
                    }}
                    onMouseUp={() => handleDragEnd(key)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!selection) return;
                      openContextMenu(e.clientX, e.clientY);
                    }}
                    className={`h-full transition-colors cursor-crosshair select-none
                      ${isWeekend ? 'bg-gray-50/60' : 'bg-white'}
                      ${isFirstOfMonth ? 'border-l border-gray-200' : 'border-l border-gray-100/30'}
                      ${isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50/50'}
                    `}
                    role="button"
                    aria-label={`Select ${key}`}
                  />
                );
              })}
            </div>

            {/* Today marker */}
            {todayIndex !== null ? (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-[5] pointer-events-none"
                style={{ left: todayIndex * CELL_WIDTH + CELL_WIDTH / 2 }}
              />
            ) : null}

            {/* Selection overlay */}
            {selectionOverlay ? (
              <div
                className="absolute inset-y-0 pointer-events-none bg-blue-500/8 border-l-2 border-r-2 border-blue-500/25"
                style={{ left: selectionOverlay.left, width: selectionOverlay.width }}
              />
            ) : null}

            {/* Booking / Reservation bars */}
            {laneLayout.map((lane, laneIndex) =>
              lane.map(({ item, startIndex, endIndex }) => {
                const left = startIndex * CELL_WIDTH + 1;
                const width = (endIndex - startIndex + 1) * CELL_WIDTH - 2;
                const top = BAR_TOP_OFFSET + laneIndex * (BAR_HEIGHT + BAR_GAP);

                const barStyle = getBarStyle(item);

                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className={`absolute overflow-hidden whitespace-nowrap text-ellipsis rounded-[5px] px-2 flex items-center text-[11px] font-medium shadow-sm transition-shadow hover:shadow-md ${barStyle.classes}`}
                    style={{ left, top, width, height: BAR_HEIGHT, ...barStyle.style }}
                    title={`${item.label} (${toDateKey(item.start_date) ?? item.start_date} → ${toDateKey(item.end_date) ?? item.end_date})`}
                  >
                    <span className="font-semibold truncate">{item.label}</span>
                    {item.sublabel ? <span className="ml-1 opacity-70 truncate">· {item.sublabel}</span> : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Sticky bottom scrollbar */}
      {stickyScrollbar ? (
        <div className="sticky bottom-0 border-t border-gray-100 bg-white">
          <div
            ref={barScrollRef}
            className="overflow-x-auto"
            onScroll={() => syncScroll(barScrollRef.current, mainScrollRef.current)}
          >
            <div style={{ width: LEFT_COL_WIDTH + timelineWidth, height: 12 }} />
          </div>
        </div>
      ) : null}

      {/* Context menu */}
      {contextMenu.open && selection && (contextMenuItems?.length || 0) > 0 ? (
        <div
          className="fixed z-50 min-w-52 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <div className="text-[11px] font-medium text-gray-500">
              {selection.start} → {selection.end}
            </div>
          </div>
          <div className="py-1">
            {contextMenuItems!.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  closeContextMenu();
                  item.onSelect();
                }}
                className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                  item.disabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Compact inline legend */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-t border-gray-100 bg-gray-50/50 text-[10px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm" style={{ background: '#3b82f6' }} />
          <span>Booking</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm" style={{ background: '#8b5cf6' }} />
          <span>Reservation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm bg-blue-100 border border-blue-200" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-0.5 bg-blue-500" />
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}

function getBarStyle(item: VisualScheduleItem): { classes: string; style: React.CSSProperties } {
  const status = (item.status || '').toLowerCase();
  if (status === 'cancelled' || status === 'canceled') {
    return {
      classes: 'text-gray-500 line-through opacity-60',
      style: { background: '#e5e7eb', borderLeft: '3px solid #9ca3af' },
    };
  }

  if (item.kind === 'booking') {
    return {
      classes: 'text-white',
      style: { background: '#3b82f6', borderLeft: '3px solid #2563eb' },
    };
  }

  // reservation
  return {
    classes: 'text-white',
    style: { background: '#8b5cf6', borderLeft: '3px solid #7c3aed' },
  };
}

function parseISODate(value: string): Date | null {
  if (!value || typeof value !== 'string') return null;
  const [y, m, d] = value.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function toDateKey(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return formatISODate(value);
  if (typeof value !== 'string') return null;

  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function compareISODate(a: string, b: string) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function normalizeRange(a: string, b: string) {
  return compareISODate(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a };
}

function clipToWindow(item: VisualScheduleItem, windowStart: string, windowEnd: string) {
  const start = toDateKey(item.start_date);
  const end = toDateKey(item.end_date);
  const wStart = toDateKey(windowStart) ?? windowStart;
  const wEnd = toDateKey(windowEnd) ?? windowEnd;
  if (!start || !end) return null;

  const normalized = normalizeRange(start, end);
  const visibleStart = compareISODate(normalized.start, wStart) < 0 ? wStart : normalized.start;
  const visibleEnd = compareISODate(normalized.end, wEnd) > 0 ? wEnd : normalized.end;

  if (compareISODate(visibleStart, visibleEnd) > 0) return null;

  return { visibleStart, visibleEnd };
}
