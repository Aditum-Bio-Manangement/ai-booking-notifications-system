"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, XCircle, Clock, Mail } from "lucide-react"
import { useTimezone } from "@/lib/timezone-context"
import type { BookingEvent } from "@/lib/types"

interface RecentActivityProps {
  bookings: BookingEvent[]
  isLoading?: boolean
}

export function RecentActivity({ bookings, isLoading = false }: RecentActivityProps) {
  const { formatActivityTime } = useTimezone()

  // Sort by most recent activity - use notificationTime if available, otherwise createdAt
  const sortedBookings = [...bookings]
    .sort((a, b) => {
      const timeA = a.notificationTime ? new Date(a.notificationTime).getTime() : new Date(a.createdAt).getTime()
      const timeB = b.notificationTime ? new Date(b.notificationTime).getTime() : new Date(b.createdAt).getTime()
      return timeB - timeA
    })
    .slice(0, 6)

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case "accepted":
        return <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.19_145)]" />
      case "declined-conflict":
      case "declined-policy":
        return <XCircle className="h-4 w-4 text-[oklch(0.65_0.2_25)]" />
      case "pending":
        return <Clock className="h-4 w-4 text-[oklch(0.7_0.15_250)]" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-4 w-4 rounded-full mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (sortedBookings.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No recent activity
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {sortedBookings.map((booking) => (
              <div key={booking.id} className="flex items-start gap-3">
                <div className="mt-0.5">{getOutcomeIcon(booking.outcome)}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      {booking.subject}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatActivityTime(booking.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {booking.organizer} &bull; {booking.roomName}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={
                        booking.site === "Cambridge"
                          ? "bg-[oklch(0.7_0.15_250)]/20 text-[oklch(0.7_0.15_250)]"
                          : "bg-[oklch(0.75_0.15_80)]/20 text-[oklch(0.75_0.15_80)]"
                      }
                    >
                      {booking.site}
                    </Badge>
                    {booking.notificationSent && (
                      <div className="flex items-center gap-1 text-xs text-[oklch(0.72_0.19_145)]">
                        <Mail className="h-3 w-3" />
                        Sent
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
