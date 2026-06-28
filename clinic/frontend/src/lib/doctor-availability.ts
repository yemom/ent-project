export interface DoctorScheduleSlot {
  doctorId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isAvailable?: boolean;
}

const DAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

export function getDayOfWeekFromDate(dateValue: string) {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return DAY_NAMES[date.getDay()];
}

function timeToMinutes(timeValue: string) {
  const [hours = '0', minutes = '0'] = timeValue.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function isDoctorAvailableAtTime(
  doctorId: string,
  schedules: DoctorScheduleSlot[],
  dateValue: string,
  timeValue: string,
) {
  const doctorSchedules = schedules.filter(
    (slot) => slot.doctorId === doctorId && slot.isAvailable !== false,
  );

  // No custom schedule means the doctor is available by default.
  if (doctorSchedules.length === 0) {
    return true;
  }

  if (!dateValue || !timeValue) {
    return true;
  }

  const dayOfWeek = getDayOfWeekFromDate(dateValue);
  const daySchedules = doctorSchedules.filter((slot) => slot.dayOfWeek === dayOfWeek);

  if (daySchedules.length === 0) {
    return false;
  }

  const appointmentMinutes = timeToMinutes(timeValue);

  return daySchedules.some((slot) => {
    const startMinutes = timeToMinutes(slot.startTime);
    const endMinutes = timeToMinutes(slot.endTime);
    return appointmentMinutes >= startMinutes && appointmentMinutes < endMinutes;
  });
}

export function getDoctorAvailabilityLabel(
  doctorId: string,
  schedules: DoctorScheduleSlot[],
  dateValue: string,
  timeValue: string,
) {
  const doctorSchedules = schedules.filter((slot) => slot.doctorId === doctorId);

  if (doctorSchedules.length === 0) {
    return 'Available (default hours)';
  }

  if (!dateValue || !timeValue) {
    return 'Custom schedule set';
  }

  return isDoctorAvailableAtTime(doctorId, schedules, dateValue, timeValue)
    ? 'Available at selected time'
    : 'Not available at selected time';
}
