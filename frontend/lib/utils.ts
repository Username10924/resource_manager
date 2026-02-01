export function calculateAvailableHours(
  operationsHours: number,
  developmentHours: number,
  otherHours: number
): number {
  const TOTAL_HOURS_PER_DAY = 6;
  const WORK_DAYS_PER_MONTH = 20;
  
  const usedHours = operationsHours + developmentHours + otherHours;
  const availableHoursPerDay = Math.max(0, TOTAL_HOURS_PER_DAY - usedHours);
  
  return availableHoursPerDay * WORK_DAYS_PER_MONTH;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getMonthsList(): string[] {
  const months = [];
  const currentDate = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    months.push(date.toISOString().slice(0, 7)); // YYYY-MM format
  }
  
  return months;
}

export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
