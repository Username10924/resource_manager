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

// Helper function to calculate working days between two dates (excluding weekends)
export function calculateWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

// Calculate hours allocated to a specific month from a booking
export function calculateMonthlyBookingHours(
  bookingStartDate: string,
  bookingEndDate: string, 
  totalBookedHours: number,
  targetMonth: number,
  targetYear: number
): number {
  const bookingStart = new Date(bookingStartDate);
  const bookingEnd = new Date(bookingEndDate);
  
  // Calculate total working days in booking period
  const totalWorkingDays = calculateWorkingDays(bookingStart, bookingEnd);
  
  if (totalWorkingDays === 0) return 0;
  
  // Calculate hours per day
  const hoursPerDay = totalBookedHours / totalWorkingDays;
  
  // Determine overlap period for target month
  const monthStart = new Date(targetYear, targetMonth - 1, 1);
  const monthEnd = new Date(targetYear, targetMonth, 0); // Last day of month
  
  const overlapStart = bookingStart > monthStart ? bookingStart : monthStart;
  const overlapEnd = bookingEnd < monthEnd ? bookingEnd : monthEnd;
  
  // If no overlap, return 0
  if (overlapStart > overlapEnd) return 0;
  
  // Calculate working days in overlap period
  const overlapWorkingDays = calculateWorkingDays(overlapStart, overlapEnd);
  
  // Return hours allocated to this month
  return hoursPerDay * overlapWorkingDays;
}

// Process employee schedule data to recalculate monthly hours from bookings
export function processEmployeeScheduleWithBookings(
  employee: any,
  allBookings: any[]
): any {
  if (!employee.schedule || !Array.isArray(employee.schedule)) {
    return employee;
  }
  
  // Get bookings for this employee
  const employeeBookings = allBookings.filter(
    (b: any) => b.employee_id === employee.id
  );
  
  // Process each month's schedule
  const processedSchedule = employee.schedule.map((sched: any) => {
    const month = sched.month;
    const year = sched.year;
    
    // Calculate actual project booked hours for this month
    let actualProjectBooked = 0;
    employeeBookings.forEach((booking: any) => {
      const monthlyHours = calculateMonthlyBookingHours(
        booking.start_date,
        booking.end_date,
        booking.booked_hours,
        month,
        year
      );
      actualProjectBooked += monthlyHours;
    });
    
    // Reserved hours stay the same (already monthly)
    const reservedHours = sched.reserved_hours || 0;
    
    // Recalculate total booked hours
    const totalBooked = actualProjectBooked + reservedHours;
    
    return {
      ...sched,
      project_booked_hours: actualProjectBooked,
      reserved_hours: reservedHours,
      booked_hours: totalBooked,
    };
  });
  
  return {
    ...employee,
    schedule: processedSchedule,
  };
}
