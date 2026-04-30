"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Bell, CheckCircle2, XCircle, Trash2, CheckCheck, Filter, RefreshCw, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldGroup, Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { formatInTimeZone } from "date-fns-tz"

interface BookingEvent {
  id: string
  subject: string
  organizer: string
  organizerEmail: string
  roomId: string
  roomName: string
  site: string
  outcome: string
  notificationStatus?: string
  notificationSent?: boolean
  createdAt: string
}

interface Notification {
  id: string
  type: "accepted" | "declined"
  title: string
  message: string
  roomName: string
  organizer: string
  timestamp: string
  read: boolean
}

const NOTIFICATIONS_ENABLED_KEY = "app-notifications-enabled"
const READ_NOTIFICATIONS_KEY = "read-notification-ids"

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [filter, setFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  // Load read notification IDs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(READ_NOTIFICATIONS_KEY)
      if (saved) {
        setReadIds(new Set(JSON.parse(saved)))
      }
      const enabledSaved = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY)
      if (enabledSaved !== null) {
        setNotificationsEnabled(JSON.parse(enabledSaved))
      }
    } catch (e) {
      console.error("Failed to load read notifications:", e)
    }
  }, [])

  // Fetch notifications from events API (same source as header dropdown)
  const fetchNotifications = useCallback(async (currentReadIds: Set<string>) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/events")
      const data = await response.json()

      if (!response.ok) {
        if (data.configured === false) {
          setError("Microsoft Graph not configured")
          setNotifications([])
          return
        }
        throw new Error("Failed to fetch events")
      }

      // Convert booking events to notifications (exactly like header does)
      // API returns { bookings: [...] } not { events: [...] }
      const bookingNotifications: Notification[] = (data.bookings || [])
        .map((booking: BookingEvent) => ({
          id: booking.id,
          type: booking.outcome === "accepted" ? "accepted" as const : "declined" as const,
          title: booking.subject || "Meeting",
          message: booking.outcome === "accepted"
            ? `${booking.organizer} - ${booking.roomName} confirmed`
            : `${booking.organizer} - ${booking.roomName} declined`,
          roomName: booking.roomName,
          organizer: booking.organizer,
          timestamp: booking.createdAt,
          read: currentReadIds.has(booking.id),
        }))

      setNotifications(bookingNotifications)
    } catch (e) {
      console.error("Failed to load notifications:", e)
      setError("Failed to load notifications")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch once on mount, readIds will be applied from localStorage in the fetch
  useEffect(() => {
    // Get current readIds from localStorage for initial fetch
    let currentReadIds = new Set<string>()
    try {
      const saved = localStorage.getItem(READ_NOTIFICATIONS_KEY)
      if (saved) {
        currentReadIds = new Set(JSON.parse(saved))
      }
    } catch (e) {
      console.error("Failed to load read IDs:", e)
    }
    fetchNotifications(currentReadIds)
  }, [fetchNotifications])

  const saveReadIds = (ids: Set<string>) => {
    setReadIds(ids)
    localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(Array.from(ids)))
  }

  const markAllAsRead = () => {
    const allIds = new Set([...readIds, ...notifications.map(n => n.id)])
    saveReadIds(allIds)
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const markAsRead = (id: string) => {
    const newReadIds = new Set([...readIds, id])
    saveReadIds(newReadIds)
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const clearNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  const toggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled)
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, JSON.stringify(enabled))
  }

  const filteredNotifications = notifications.filter(n => {
    if (filter === "all") return true
    if (filter === "unread") return !n.read
    if (filter === "accepted") return n.type === "accepted"
    if (filter === "declined") return n.type === "declined"
    return true
  })

  const unreadCount = notifications.filter(n => !n.read).length

  const getIcon = (type: string) => {
    switch (type) {
      case "accepted":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "declined":
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case "accepted":
        return "default"
      case "declined":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return "Unknown"
    try {
      return formatInTimeZone(new Date(timestamp), "UTC", "MMM d, yyyy h:mm a")
    } catch {
      return "Unknown"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
              <p className="text-sm text-muted-foreground">View and manage your room booking notifications</p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm">
            {unreadCount} unread
          </Badge>
        </div>

        {/* Notification Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Notification Settings</CardTitle>
            <CardDescription>Configure how you receive in-app notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <div className="flex items-center justify-between">
                  <div>
                    <FieldLabel>Enable App Notifications</FieldLabel>
                    <FieldDescription>Receive in-app alerts for booking confirmations and declines</FieldDescription>
                  </div>
                  <Switch
                    checked={notificationsEnabled}
                    onCheckedChange={toggleNotifications}
                  />
                </div>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* All Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">All Notifications</CardTitle>
                <CardDescription>{filteredNotifications.length} notifications</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => fetchNotifications(readIds)} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="unread">Unread</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
                  <CheckCheck className="mr-2 h-4 w-4" />
                  Mark all read
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll} className="text-destructive hover:text-destructive" disabled={notifications.length === 0}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear all
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Loading notifications...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-destructive/50" />
                <p className="mt-4 text-lg font-medium text-foreground">{error}</p>
                <p className="text-sm text-muted-foreground">
                  {error.includes("not configured")
                    ? "Please configure Microsoft Graph credentials"
                    : "Please try again later"}
                </p>
                <Button variant="outline" className="mt-4" onClick={() => fetchNotifications(readIds)}>
                  Try Again
                </Button>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-lg font-medium text-foreground">No Notifications</p>
                <p className="text-sm text-muted-foreground">
                  {filter !== "all" ? "Try adjusting your filter" : "You're all caught up!"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex items-start justify-between rounded-lg border p-4 transition-colors ${notification.read ? "bg-background" : "bg-muted/30"
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      {getIcon(notification.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {notification.type === "accepted" ? "Booking Confirmed" : "Booking Declined"}
                          </p>
                          {!notification.read && (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant={getBadgeVariant(notification.type)} className="text-xs">
                            {notification.type === "accepted" ? "Accepted" : "Declined"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(notification.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markAsRead(notification.id)}
                          title="Mark as read"
                        >
                          <CheckCheck className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => clearNotification(notification.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
