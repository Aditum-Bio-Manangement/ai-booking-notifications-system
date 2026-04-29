"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Bell, CheckCircle2, XCircle, Clock, Trash2, CheckCheck, BellOff, Filter, RefreshCw, AlertCircle, Loader2 } from "lucide-react"
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

interface Notification {
  id: string
  type?: string
  status: string
  recipient_email: string | null
  recipient_name: string | null
  subject: string
  body: string | null
  created_at?: string | null // May not exist in all schemas
  sent_at?: string | null
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

  // Fetch notifications from database
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/notifications?limit=100")
      if (!response.ok) {
        throw new Error("Failed to fetch notifications")
      }
      const data = await response.json()
      setNotifications(data.notifications || [])
    } catch (e) {
      console.error("Failed to load notifications:", e)
      setError("Failed to load notifications from database")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const saveReadIds = (ids: Set<string>) => {
    setReadIds(ids)
    localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(Array.from(ids)))
  }

  const markAllAsRead = () => {
    const allIds = new Set([...readIds, ...notifications.map(n => n.id)])
    saveReadIds(allIds)
  }

  const markAsRead = (id: string) => {
    const newReadIds = new Set([...readIds, id])
    saveReadIds(newReadIds)
  }

  const deleteNotification = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications?id=${id}`, {
        method: "DELETE",
      })
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id))
      }
    } catch (e) {
      console.error("Failed to delete notification:", e)
    }
  }

  const clearAll = async () => {
    try {
      const response = await fetch("/api/notifications?clearAll=true", {
        method: "DELETE",
      })
      if (response.ok) {
        setNotifications([])
        saveReadIds(new Set())
      }
    } catch (e) {
      console.error("Failed to clear notifications:", e)
    }
  }

  const toggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled)
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, JSON.stringify(enabled))
  }

  const getNotificationType = (notification: Notification): "accepted" | "declined" | "subscription" | "system" => {
    // Determine type from status or subject
    if (notification.type) {
      if (notification.type === "accepted" || notification.type === "declined" || notification.type === "subscription" || notification.type === "system") {
        return notification.type
      }
    }

    const subject = notification.subject.toLowerCase()
    if (subject.includes("confirmed") || subject.includes("accepted") || notification.status === "sent") {
      return "accepted"
    }
    if (subject.includes("declined") || subject.includes("rejected")) {
      return "declined"
    }
    if (subject.includes("subscription") || subject.includes("expir")) {
      return "subscription"
    }
    return "system"
  }

  const getNotificationIcon = (type: "accepted" | "declined" | "subscription" | "system") => {
    switch (type) {
      case "accepted":
        return <CheckCircle2 className="h-5 w-5 text-[oklch(0.72_0.19_145)]" />
      case "declined":
        return <XCircle className="h-5 w-5 text-destructive" />
      case "subscription":
        return <Clock className="h-5 w-5 text-warning" />
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getNotificationBadge = (type: "accepted" | "declined" | "subscription" | "system") => {
    switch (type) {
      case "accepted":
        return <Badge variant="outline" className="border-[oklch(0.72_0.19_145)] text-[oklch(0.72_0.19_145)]">Accepted</Badge>
      case "declined":
        return <Badge variant="destructive">Declined</Badge>
      case "subscription":
        return <Badge variant="outline" className="border-warning text-warning">Subscription</Badge>
      default:
        return <Badge variant="secondary">System</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="outline" className="border-[oklch(0.72_0.19_145)] text-[oklch(0.72_0.19_145)]">Sent</Badge>
      case "pending":
        return <Badge variant="outline" className="border-warning text-warning">Pending</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
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

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "all") return true
    if (filter === "unread") return !readIds.has(n.id)

    const type = getNotificationType(n)
    return type === filter
  })

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              View and manage your room booking notifications
            </p>
          </div>
          <Badge variant="outline">
            {unreadCount} unread
          </Badge>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="flex flex-col gap-6">
          {/* Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Settings</CardTitle>
              <CardDescription>
                Configure how you receive in-app notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <FieldLabel>Enable App Notifications</FieldLabel>
                    <FieldDescription>
                      Receive in-app alerts for booking confirmations and declines
                    </FieldDescription>
                  </div>
                  <div className="shrink-0">
                    <Switch
                      checked={notificationsEnabled}
                      onCheckedChange={toggleNotifications}
                    />
                  </div>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {/* Notifications List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">All Notifications</CardTitle>
                  <CardDescription>
                    {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? "s" : ""}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchNotifications}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  </Button>
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-36">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="unread">Unread</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                      <SelectItem value="subscription">Subscription</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={markAllAsRead}
                    disabled={unreadCount === 0}
                  >
                    <CheckCheck className="h-4 w-4" />
                    Mark all read
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={clearAll}
                    disabled={notifications.length === 0}
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear all
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!notificationsEnabled ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BellOff className="h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-lg font-medium text-muted-foreground">Notifications Disabled</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enable notifications above to receive booking alerts
                  </p>
                </div>
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">Loading notifications...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-destructive/50" />
                  <p className="mt-4 text-lg font-medium text-muted-foreground">{error}</p>
                  <Button variant="outline" className="mt-4" onClick={fetchNotifications}>
                    Try Again
                  </Button>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-lg font-medium text-muted-foreground">No Notifications</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {filter !== "all" ? "Try changing your filter" : "You're all caught up!"}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {filteredNotifications.map((notification) => {
                    const type = getNotificationType(notification)
                    const isRead = readIds.has(notification.id)

                    return (
                      <div
                        key={notification.id}
                        className={`flex items-start gap-4 py-4 ${!isRead ? "bg-primary/5 -mx-6 px-6" : ""
                          }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {getNotificationIcon(type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{notification.subject}</p>
                            {!isRead && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                            )}
                          </div>
                          {notification.body && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                              {notification.body}
                            </p>
                          )}
                          {notification.recipient_email && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              To: {notification.recipient_name || notification.recipient_email}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            {getNotificationBadge(type)}
                            {getStatusBadge(notification.status)}
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(notification.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {!isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <CheckCheck className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
