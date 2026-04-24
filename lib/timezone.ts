import { format, toZonedTime } from "date-fns-tz"
import { parseISO } from "date-fns"

// Common US timezones
export const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "UTC", label: "UTC" },
] as const

export type TimezoneValue = typeof TIMEZONES[number]["value"]

const TIMEZONE_STORAGE_KEY = "app-timezone"
const DEFAULT_TIMEZONE: TimezoneValue = "America/New_York"

// Get stored timezone or default
export function getStoredTimezone(): TimezoneValue {
  if (typeof window === "undefined") return DEFAULT_TIMEZONE
  const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY)
  if (stored && TIMEZONES.some(tz => tz.value === stored)) {
    return stored as TimezoneValue
  }
  return DEFAULT_TIMEZONE
}

// Store timezone preference
export function setStoredTimezone(timezone: TimezoneValue): void {
  if (typeof window === "undefined") return
  localStorage.setItem(TIMEZONE_STORAGE_KEY, timezone)
}

// Format a date string to the configured timezone
export function formatInTimezone(
  dateString: string | Date,
  formatStr: string,
  timezone?: TimezoneValue
): string {
  const tz = timezone || getStoredTimezone()
  const date = typeof dateString === "string" ? parseISO(dateString) : dateString
  const zonedDate = toZonedTime(date, tz)
  return format(zonedDate, formatStr, { timeZone: tz })
}

// Format time only (e.g., "2:30 PM")
export function formatTime(dateString: string | Date, timezone?: TimezoneValue): string {
  return formatInTimezone(dateString, "h:mm a", timezone)
}

// Format date only (e.g., "Apr 29, 2026")
export function formatDate(dateString: string | Date, timezone?: TimezoneValue): string {
  return formatInTimezone(dateString, "MMM d, yyyy", timezone)
}

// Format date and time (e.g., "Apr 29, 2026 2:30 PM")
export function formatDateTime(dateString: string | Date, timezone?: TimezoneValue): string {
  return formatInTimezone(dateString, "MMM d, yyyy h:mm a", timezone)
}

// Format time range (e.g., "2:30 PM - 3:30 PM")
export function formatTimeRange(
  startDate: string | Date,
  endDate: string | Date,
  timezone?: TimezoneValue
): string {
  const startTime = formatTime(startDate, timezone)
  const endTime = formatTime(endDate, timezone)
  return `${startTime} - ${endTime}`
}

// Format for recent activity (shows "Yesterday" or date for older)
export function formatActivityTime(dateString: string | Date, timezone?: TimezoneValue): string {
  const tz = timezone || getStoredTimezone()
  const date = typeof dateString === "string" ? parseISO(dateString) : dateString
  const zonedDate = toZonedTime(date, tz)
  
  // Get "now" in the target timezone for proper comparison
  const nowInTz = toZonedTime(new Date(), tz)
  
  // Check if same day in the target timezone
  const isSameDay = zonedDate.getFullYear() === nowInTz.getFullYear() &&
    zonedDate.getMonth() === nowInTz.getMonth() &&
    zonedDate.getDate() === nowInTz.getDate()
  
  // Check if yesterday in the target timezone
  const yesterdayInTz = new Date(nowInTz)
  yesterdayInTz.setDate(yesterdayInTz.getDate() - 1)
  const isYesterdayInTz = zonedDate.getFullYear() === yesterdayInTz.getFullYear() &&
    zonedDate.getMonth() === yesterdayInTz.getMonth() &&
    zonedDate.getDate() === yesterdayInTz.getDate()
  
  if (isSameDay) {
    return format(zonedDate, "h:mm a", { timeZone: tz })
  } else if (isYesterdayInTz) {
    return `Yesterday ${format(zonedDate, "h:mm a", { timeZone: tz })}`
  } else {
    return format(zonedDate, "MMM d, h:mm a", { timeZone: tz })
  }
}

// Check if date is today in the configured timezone
export function isTodayInTimezone(dateString: string | Date, timezone?: TimezoneValue): boolean {
  const tz = timezone || getStoredTimezone()
  const date = typeof dateString === "string" ? parseISO(dateString) : dateString
  const zonedDate = toZonedTime(date, tz)
  const nowInTz = toZonedTime(new Date(), tz)
  
  return zonedDate.getFullYear() === nowInTz.getFullYear() &&
    zonedDate.getMonth() === nowInTz.getMonth() &&
    zonedDate.getDate() === nowInTz.getDate()
}

// Get timezone abbreviation (e.g., "EST", "EDT")
export function getTimezoneAbbreviation(timezone?: TimezoneValue): string {
  const tz = timezone || getStoredTimezone()
  const now = new Date()
  const zonedDate = toZonedTime(now, tz)
  return format(zonedDate, "zzz", { timeZone: tz })
}

// Get timezone label from value
export function getTimezoneLabel(timezone?: TimezoneValue): string {
  const tz = timezone || getStoredTimezone()
  const found = TIMEZONES.find(t => t.value === tz)
  return found?.label || tz
}
