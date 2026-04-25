"use client"

import { useState } from "react"
import { useTimezone } from "@/lib/timezone-context"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Mail, CheckCircle2, XCircle, RefreshCw, Clock, Send } from "lucide-react"
import { Skeleton } from "@/components/ui/loaders"
import type { BookingEvent } from "@/lib/types"

interface SendHistoryTableProps {
  bookings: BookingEvent[]
  isLoading?: boolean
  onRefresh?: () => void
}

function SendHistoryRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-20 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
    </TableRow>
  )
}

export function SendHistoryTable({ bookings, isLoading = false, onRefresh }: SendHistoryTableProps) {
  const [search, setSearch] = useState("")
  const [siteFilter, setSiteFilter] = useState<string>("all")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { formatDate, formatTime, formatDateTime } = useTimezone()

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  // Helper to safely parse date
  const safeGetTime = (dateStr: string | undefined | null): number => {
    if (!dateStr) return 0
    const time = new Date(dateStr).getTime()
    return isNaN(time) ? 0 : time
  }

  // Only show bookings with notifications sent, sorted by notification time
  const sentBookings = bookings
    .filter((b): b is BookingEvent => b != null && b.notificationSent)
    .sort((a, b) => {
      const timeA = safeGetTime(a.notificationTime)
      const timeB = safeGetTime(b.notificationTime)
      return timeB - timeA // Newest first
    })

  const filteredBookings = sentBookings.filter((booking) => {
    const searchLower = search.toLowerCase()
    const matchesSearch =
      (booking.subject || "").toLowerCase().includes(searchLower) ||
      (booking.organizer || "").toLowerCase().includes(searchLower) ||
      (booking.organizerEmail || "").toLowerCase().includes(searchLower) ||
      (booking.roomName || "").toLowerCase().includes(searchLower)
    const matchesSite = siteFilter === "all" || booking.site === siteFilter
    return matchesSearch && matchesSite
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Notification Send History</CardTitle>
            {onRefresh && (
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
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 sm:w-56"
              />
            </div>
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                <SelectItem value="Cambridge">Cambridge</SelectItem>
                <SelectItem value="Oakland">Oakland</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Meeting</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Sent At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SendHistoryRowSkeleton key={i} />)
            ) : (
              filteredBookings.map((booking) => {
                const isAccepted = booking.outcome === "accepted"
                return (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{booking.organizer}</p>
                        <p className="text-xs text-muted-foreground">{booking.organizerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-foreground">{booking.roomName}</p>
                        <Badge
                          variant="secondary"
                          className={
                            booking.site === "Cambridge"
                              ? "mt-1 bg-[oklch(0.7_0.15_250)]/20 text-[oklch(0.7_0.15_250)]"
                              : "mt-1 bg-[oklch(0.75_0.15_80)]/20 text-[oklch(0.75_0.15_80)]"
                          }
                        >
                          {booking.site}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="text-foreground truncate max-w-[200px]" title={booking.subject}>
                          {booking.subject}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(booking.startTime)} at {formatTime(booking.startTime)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          isAccepted
                            ? "bg-[oklch(0.72_0.19_145)]/20 text-[oklch(0.72_0.19_145)]"
                            : "bg-[oklch(0.65_0.2_25)]/20 text-[oklch(0.65_0.2_25)]"
                        }
                      >
                        {isAccepted ? (
                          <>
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Accepted
                          </>
                        ) : (
                          <>
                            <XCircle className="mr-1 h-3 w-3" />
                            Declined
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-foreground">
                        <Mail className="h-3 w-3 text-[oklch(0.72_0.19_145)]" />
                        {booking.notificationTime ? (
                          <span>{formatDateTime(booking.notificationTime)}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        {!isLoading && filteredBookings.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            No notifications have been sent yet.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
