"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { 
  type TimezoneValue, 
  getStoredTimezone, 
  setStoredTimezone,
  formatTime as formatTimeUtil,
  formatDate as formatDateUtil,
  formatDateTime as formatDateTimeUtil,
  formatTimeRange as formatTimeRangeUtil,
  formatActivityTime as formatActivityTimeUtil,
  getTimezoneAbbreviation as getTimezoneAbbreviationUtil,
  TIMEZONES
} from "./timezone"

interface TimezoneContextType {
  timezone: TimezoneValue
  setTimezone: (tz: TimezoneValue) => void
  formatTime: (dateString: string | Date) => string
  formatDate: (dateString: string | Date) => string
  formatDateTime: (dateString: string | Date) => string
  formatTimeRange: (startDate: string | Date, endDate: string | Date) => string
  formatActivityTime: (dateString: string | Date) => string
  getTimezoneAbbreviation: () => string
  timezones: typeof TIMEZONES
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined)

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState<TimezoneValue>("America/New_York")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTimezoneState(getStoredTimezone())
    setMounted(true)
  }, [])

  const setTimezone = useCallback((tz: TimezoneValue) => {
    setTimezoneState(tz)
    setStoredTimezone(tz)
  }, [])

  const formatTime = useCallback((dateString: string | Date) => {
    if (!mounted) return "..."
    return formatTimeUtil(dateString, timezone)
  }, [timezone, mounted])

  const formatDate = useCallback((dateString: string | Date) => {
    if (!mounted) return "..."
    return formatDateUtil(dateString, timezone)
  }, [timezone, mounted])

  const formatDateTime = useCallback((dateString: string | Date) => {
    if (!mounted) return "..."
    return formatDateTimeUtil(dateString, timezone)
  }, [timezone, mounted])

  const formatTimeRange = useCallback((startDate: string | Date, endDate: string | Date) => {
    if (!mounted) return "..."
    return formatTimeRangeUtil(startDate, endDate, timezone)
  }, [timezone, mounted])

  const formatActivityTime = useCallback((dateString: string | Date) => {
    if (!mounted) return "..."
    return formatActivityTimeUtil(dateString, timezone)
  }, [timezone, mounted])

  const getTimezoneAbbreviation = useCallback(() => {
    if (!mounted) return "..."
    return getTimezoneAbbreviationUtil(timezone)
  }, [timezone, mounted])

  return (
    <TimezoneContext.Provider 
      value={{ 
        timezone, 
        setTimezone, 
        formatTime, 
        formatDate, 
        formatDateTime, 
        formatTimeRange, 
        formatActivityTime,
        getTimezoneAbbreviation,
        timezones: TIMEZONES
      }}
    >
      {children}
    </TimezoneContext.Provider>
  )
}

export function useTimezone() {
  const context = useContext(TimezoneContext)
  if (context === undefined) {
    throw new Error("useTimezone must be used within a TimezoneProvider")
  }
  return context
}
