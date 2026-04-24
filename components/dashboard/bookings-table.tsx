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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Filter, CalendarIcon, ChevronRight, Mail, CheckCircle2, XCircle, Clock, Ban, RefreshCw } from "lucide-react"
import { Skeleton } from "@/components/ui/loaders"
import type { BookingEvent, BookingOutcome } from "@/lib/types"

interface BookingsTableProps {
  bookings: BookingEvent[]
  isLoading?: boolean
  onRefresh?: () => void
}

const outcomeConfig: Record<BookingOutcome, { label: string; icon: typeof CheckCircle2; className: string }> = {
  accepted: {
    label: "Accepted",
    icon: CheckCircle2,
    className: "bg-[oklch(0.72_0.19_145)]/20 text-[oklch(0.72_0.19_145)]",
  },
  "declined-conflict": {
    label: "Declined - Conflict",
    icon: XCircle,
    className: "bg-[oklch(0.65_0.2_25)]/20 text-[oklch(0.65_0.2_25)]",
  },
  "declined-policy": {
    label: "Declined - Policy",
    icon: Ban,
    className: "bg-[oklch(0.8_0.15_80)]/20 text-[oklch(0.8_0.15_80)]",
  },
  canceled: {
    label: "Canceled",
    icon: XCircle,
    className: "bg-muted text-muted-foreground",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-[oklch(0.7_0.15_250)]/20 text-[oklch(0.7_0.15_250)]",
  },
}

// Skeleton row for table loading
function BookingRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-28 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-12" />
      </TableCell>
      <TableCell className="text-right">
        <Skeleton className="ml-auto h-8 w-8 rounded" />
      </TableCell>
    </TableRow>
  )
}

export function BookingsTable({ bookings, isLoading = false, onRefresh }: BookingsTableProps) {
  const [search, setSearch] = useState("")
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all")
  const [siteFilter, setSiteFilter] = useState<string>("all")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { formatDate, formatTime, formatTimeRange, formatDateTime } = useTimezone()

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  // Filter out any null/undefined bookings first
  const validBookings = Array.isArray(bookings) ? bookings.filter((b): b is BookingEvent => b != null) : []

  // Sort by most recent first, then filter
  const sortedBookings = [...validBookings].sort((a, b) => {
    const timeA = a.notificationTime ? new Date(a.notificationTime).getTime() : new Date(a.createdAt).getTime()
    const timeB = b.notificationTime ? new Date(b.notificationTime).getTime() : new Date(b.createdAt).getTime()
    return timeB - timeA
  })

  const filteredBookings = sortedBookings.filter((booking) => {
    const searchLower = search.toLowerCase()
    const subject = booking.subject || ""
    const organizer = booking.organizer || ""
    const roomName = booking.roomName || ""
    const matchesSearch =
      subject.toLowerCase().includes(searchLower) ||
      organizer.toLowerCase().includes(searchLower) ||
      roomName.toLowerCase().includes(searchLower)
    const matchesOutcome = outcomeFilter === "all" || booking.outcome === outcomeFilter
    const matchesSite = siteFilter === "all" || booking.site === siteFilter
    return matchesSearch && matchesOutcome && matchesSite
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Booking Events</CardTitle>
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 w-8"
                title="Refresh bookings"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bookings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 sm:w-56"
              />
            </div>
            <div className="flex gap-2">
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="declined-conflict">Declined - Conflict</SelectItem>
                  <SelectItem value="declined-policy">Declined - Policy</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-24 sm:w-32">
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
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow>
              <TableHead>Meeting</TableHead>
              <TableHead className="hidden sm:table-cell">Room</TableHead>
              <TableHead className="hidden md:table-cell">Time</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead className="hidden lg:table-cell">Notification</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <BookingRowSkeleton key={i} />)
            ) : (
              filteredBookings.map((booking) => {
                const outcome = outcomeConfig[booking.outcome]
                const OutcomeIcon = outcome.icon
                return (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{booking.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {booking.organizer} &bull; {booking.organizerEmail}
                        </p>
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
                        <p className="text-foreground">
                          {formatDate(booking.startTime)}
                        </p>
                        <p className="text-muted-foreground">
                          {formatTimeRange(booking.startTime, booking.endTime)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={outcome.className}>
                        <OutcomeIcon className="mr-1 h-3 w-3" />
                        {outcome.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {booking.notificationSent ? (
                        <div className="flex items-center gap-1 text-[oklch(0.72_0.19_145)]">
                          <Mail className="h-3 w-3" />
                          <span className="text-xs">Sent</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="text-xs">Pending</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {booking.subject}
                              </p>
                              <p className="text-xs text-muted-foreground break-all">
                                Event ID: {booking.id.length > 30 ? `${booking.id.slice(0, 30)}...` : booking.id}
                              </p>
                            </div>
                            <div className="text-sm">
                              <p className="text-muted-foreground">Created</p>
                              <p className="text-foreground">
                                {formatDateTime(booking.createdAt)}
                              </p>
                            </div>
                            {booking.declineReason && (
                              <div className="rounded-lg bg-[oklch(0.65_0.2_25)]/10 p-2">
                                <p className="text-xs font-medium text-[oklch(0.65_0.2_25)]">
                                  Decline Reason
                                </p>
                                <p className="mt-1 text-xs text-foreground">
                                  {booking.declineReason}
                                </p>
                              </div>
                            )}
                            {booking.notificationTime && (
                              <div className="text-sm">
                                <p className="text-muted-foreground">Notification Sent</p>
                                <p className="text-foreground">
                                  {formatDateTime(booking.notificationTime)}
                                </p>
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        {filteredBookings.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            No bookings found matching your criteria.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
