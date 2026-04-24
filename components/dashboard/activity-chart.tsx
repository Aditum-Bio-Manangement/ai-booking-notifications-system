"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw } from "lucide-react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { format, subDays, isSameDay, parseISO } from "date-fns"
import { toZonedTime } from "date-fns-tz"
import { useTimezone } from "@/lib/timezone-context"
import { formatInTimezone, getStoredTimezone } from "@/lib/timezone"
import type { BookingEvent } from "@/lib/types"

interface ActivityChartProps {
  onRefresh?: () => void
  bookings?: BookingEvent[]
  isLoading?: boolean
}

export function ActivityChart({ onRefresh, bookings = [], isLoading = false }: ActivityChartProps) {
  const [selectedDate, setSelectedDate] = useState("today")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { timezone, getTimezoneAbbreviation } = useTimezone()

  const getDateFromSelection = () => {
    switch (selectedDate) {
      case "today":
        return new Date()
      case "yesterday":
        return subDays(new Date(), 1)
      case "2days":
        return subDays(new Date(), 2)
      case "3days":
        return subDays(new Date(), 3)
      default:
        return new Date()
    }
  }

  // Generate chart data from real bookings
  const chartData = useMemo(() => {
    const selectedDateObj = getDateFromSelection()
    const tz = timezone || "America/New_York"
    
    // Initialize hourly buckets (6 AM to 11 PM)
    const hourlyData: Record<number, { accepted: number; declined: number }> = {}
    for (let hour = 6; hour <= 23; hour++) {
      hourlyData[hour] = { accepted: 0, declined: 0 }
    }
    
    // Count bookings by hour for the selected date (based on when booking was created)
    bookings.forEach((booking) => {
      try {
        // Use createdAt to show booking activity (when bookings were made)
        const bookingCreatedDate = toZonedTime(parseISO(booking.createdAt), tz)
        const compareDate = toZonedTime(selectedDateObj, tz)
        
        if (isSameDay(bookingCreatedDate, compareDate)) {
          const hour = bookingCreatedDate.getHours()
          if (hour >= 6 && hour <= 23) {
            if (booking.outcome === "accepted") {
              hourlyData[hour].accepted++
            } else if (booking.outcome === "declined-conflict" || booking.outcome === "declined-policy") {
              hourlyData[hour].declined++
            }
          }
        }
      } catch {
        // Skip invalid dates
      }
    })
    
    // Convert to chart format
    return Object.entries(hourlyData).map(([hour, data]) => {
      const hourNum = parseInt(hour)
      const timeLabel = hourNum === 12 ? "12 PM" : hourNum > 12 ? `${hourNum - 12} PM` : `${hourNum} AM`
      return {
        time: timeLabel,
        accepted: data.accepted,
        declined: data.declined,
      }
    })
  }, [bookings, selectedDate, timezone])
  
  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      onRefresh?.()
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  const getDateLabel = () => {
    const date = getDateFromSelection()
    const tz = getStoredTimezone()
    if (selectedDate === "today") {
      return `Today, ${formatInTimezone(date, "MMM d, yyyy", tz)} (${getTimezoneAbbreviation()})`
    }
    return `${formatInTimezone(date, "EEEE, MMM d, yyyy", tz)} (${getTimezoneAbbreviation()})`
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">Booking Activity</CardTitle>
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-[140px]" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-[200px] w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">Booking Activity</CardTitle>
            <p className="text-xs text-muted-foreground">{getDateLabel()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="2days">{formatInTimezone(subDays(new Date(), 2), "MMM d", timezone)}</SelectItem>
                <SelectItem value="3days">{formatInTimezone(subDays(new Date(), 3), "MMM d", timezone)}</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 w-8"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            <div className="hidden items-center gap-4 text-sm sm:flex">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Accepted</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[oklch(0.65_0.2_25)]" />
                <span className="text-muted-foreground">Declined</span>
              </div>
            </div>
          </div>
        </div>
        {/* Mobile legend */}
        <div className="flex items-center gap-4 text-sm sm:hidden">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Accepted</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[oklch(0.65_0.2_25)]" />
            <span className="text-muted-foreground">Declined</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="acceptedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.75 0.18 165)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.75 0.18 165)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="declinedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.2 25)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.65 0.2 25)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.005 260)" />
              <XAxis
                dataKey="time"
                stroke="oklch(0.65 0 0)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="oklch(0.65 0 0)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.16 0.005 260)",
                  border: "1px solid oklch(0.25 0.005 260)",
                  borderRadius: "8px",
                  color: "oklch(0.95 0 0)",
                }}
              />
              <Area
                type="monotone"
                dataKey="accepted"
                stroke="oklch(0.75 0.18 165)"
                strokeWidth={2}
                fill="url(#acceptedGradient)"
              />
              <Area
                type="monotone"
                dataKey="declined"
                stroke="oklch(0.65 0.2 25)"
                strokeWidth={2}
                fill="url(#declinedGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
