'use client';

import Button from '@/components/Button';
import { formatRangeDuration } from '@/lib/utils';

type QuickRangePreset = 'year' | '1w' | '2w' | '1m';

export default function TimelineDateRangePicker({
  startDate,
  endDate,
  viewYear,
  onChange,
}: {
  startDate: string;
  endDate: string;
  viewYear: number;
  onChange: (start: string, end: string) => void;
}) {
  const handlePreset = (preset: QuickRangePreset) => {
    const yearStart = parseISODateLocal(`${viewYear}-01-01`);
    const yearEnd = parseISODateLocal(`${viewYear}-12-31`);
    if (!yearStart || !yearEnd) return;

    let anchor = parseISODateLocal(startDate);
    if (!anchor) {
      anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
    }
    const clampedAnchor = clampDate(anchor, yearStart, yearEnd);

    const nextEnd = new Date(clampedAnchor);
    if (preset === 'year') {
      nextEnd.setFullYear(nextEnd.getFullYear() + 1);
      nextEnd.setDate(nextEnd.getDate() - 1);
    } else if (preset === '1m') {
      nextEnd.setMonth(nextEnd.getMonth() + 1);
      nextEnd.setDate(nextEnd.getDate() - 1);
    } else {
      const days = preset === '1w' ? 6 : 13;
      nextEnd.setDate(nextEnd.getDate() + days);
    }
    const clampedEnd = clampDate(nextEnd, yearStart, yearEnd);

    onChange(formatISODateLocal(clampedAnchor), formatISODateLocal(clampedEnd));
  };

  const start = parseISODateLocal(startDate);
  const end = parseISODateLocal(endDate);
  const normalized = normalizeRange(start, end);
  const rangeDuration = formatRangeDuration(normalized.start, normalized.end);

  return (
    <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-600">Timeline Range</div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => handlePreset('year')}>
          Whole Year
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => handlePreset('1w')}>
          1 Week
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => handlePreset('2w')}>
          2 Weeks
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => handlePreset('1m')}>
          1 Month
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Start Date</label>
          <input
            type="date"
            value={normalized.start}
            min={`${viewYear}-01-01`}
            max={`${viewYear}-12-31`}
            onChange={(e) => onChange(e.target.value, normalized.end)}
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">End Date</label>
          <input
            type="date"
            value={normalized.end}
            min={`${viewYear}-01-01`}
            max={`${viewYear}-12-31`}
            onChange={(e) => onChange(normalized.start, e.target.value)}
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-2 text-xs text-zinc-500">
        Duration: <span className="font-medium text-zinc-600">{rangeDuration}</span>
      </div>
    </div>
  );
}

function clampDate(date: Date, minDate: Date, maxDate: Date): Date {
  if (date < minDate) return new Date(minDate);
  if (date > maxDate) return new Date(maxDate);
  return date;
}

function normalizeRange(start: Date | null, end: Date | null): { start: string; end: string } {
  const fallback = formatISODateLocal(new Date());
  if (!start || !end) return { start: fallback, end: fallback };
  if (start <= end) return { start: formatISODateLocal(start), end: formatISODateLocal(end) };
  return { start: formatISODateLocal(end), end: formatISODateLocal(start) };
}

function parseISODateLocal(value: string): Date | null {
  if (!value || typeof value !== 'string') return null;
  const [y, m, d] = value.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatISODateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
