"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CalendarCheck, CalendarX, Mail, Clock, TrendingUp, TrendingDown } from "lucide-react"
import { DualOrbitLoader } from "@/components/ui/loaders"
import type { DashboardMetrics } from "@/lib/types"

interface MetricsCardsProps {
  metrics: DashboardMetrics
  isLoading?: boolean
}

function formatProcessingTime(totalSeconds: number): string {
  // Handle decimal seconds
  const wholeSeconds = Math.floor(totalSeconds)
  const milliseconds = Math.round((totalSeconds - wholeSeconds) * 1000)
  
  if (totalSeconds < 60) {
    // Under 1 minute: show seconds with milliseconds if applicable
    if (milliseconds > 0) {
      return `${wholeSeconds}.${milliseconds.toString().padStart(3, '0').slice(0, 2)}s`
    }
    return `${wholeSeconds}s`
  }
  
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const secs = wholeSeconds % 60
  
  if (hours > 0) {
    // Over 1 hour: show HH:mm:ss
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  // Under 1 hour but over 1 minute: show mm:ss
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export function MetricsCards({ metrics, isLoading = false }: MetricsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-4 animate-pulse rounded bg-muted" />
              </div>
              <div className="mt-4 flex items-center justify-center py-2">
                <DualOrbitLoader size="md" />
              </div>
              <div className="mt-2 space-y-2">
                <div className="h-7 w-12 animate-pulse rounded bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Card className="bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarCheck className="h-4 w-4" />
              Total Bookings
            </div>
            <TrendingUp className="h-4 w-4 text-[oklch(0.72_0.19_145)]" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {metrics.totalBookingsToday}
          </p>
          <p className="text-xs text-muted-foreground">Today</p>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarCheck className="h-4 w-4 text-[oklch(0.72_0.19_145)]" />
              Accepted
            </div>
            <span className="text-xs text-[oklch(0.72_0.19_145)]">
              {metrics.totalBookingsToday > 0 
                ? Math.round((metrics.acceptedToday / metrics.totalBookingsToday) * 100) 
                : 0}%
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {metrics.acceptedToday}
          </p>
          <p className="text-xs text-muted-foreground">Rooms booked</p>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarX className="h-4 w-4 text-[oklch(0.65_0.2_25)]" />
              Declined
            </div>
            <TrendingDown className="h-4 w-4 text-[oklch(0.65_0.2_25)]" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {metrics.declinedToday}
          </p>
          <p className="text-xs text-muted-foreground">Conflicts/Policy</p>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              Notifications
            </div>
            <span className="text-xs text-primary">Sent</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {metrics.notificationsSent}
          </p>
          <p className="text-xs text-muted-foreground">Emails delivered</p>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Avg. Time
            </div>
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatProcessingTime(metrics.avgProcessingTime)}
          </p>
          <p className="text-xs text-muted-foreground">Processing time</p>
        </CardContent>
      </Card>
    </div>
  )
}
