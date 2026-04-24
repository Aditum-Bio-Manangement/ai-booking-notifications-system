"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Bell, CheckCircle2, XCircle, Clock, Trash2, CheckCheck, BellOff, Filter } from "lucide-react"
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

interface AppNotification {
  id: string
  type: "accepted" | "declined" | "subscription" | "system"
  title: string
  message: string
  timestamp: string
  read: boolean
  roomName?: string
}

const NOTIFICATIONS_STORAGE_KEY = "app-notifications"
const NOTIFICATIONS_ENABLED_KEY = "app-notifications-enabled"

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [filter, setFilter] = useState<string>("all")

  // Load notifications from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
      if (saved) {
        setNotifications(JSON.parse(saved))
      } else {
        // Set default notifications for demo
        const defaultNotifications: AppNotification[] = [
          {
            id: "1",
            type: "accepted",
            title: "Booking Confirmed",
            message: "Q1 Planning Meeting confirmed for Cambridge Conference Room A",
            timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            read: false,
            roomName: "Cambridge Conference Room A",
          },
          {
            id: "2",
            type: "declined",
            title: "Booking Declined",
            message: "Product Review declined for Oakland Boardroom - room already booked",
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            read: false,
            roomName: "Oakland Boardroom",
          },
          {
            id: "3",
            type: "subscription",
            title: "Subscription Expiring",
            message: "Graph subscription for room@aditumbio.com expires in 2 hours",
            timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
            read: false,
          },
          {
            id: "4",
            type: "accepted",
            title: "Booking Confirmed",
            message: "Weekly Standup confirmed for Cambridge Huddle Space 1",
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
            read: true,
            roomName: "Cambridge Huddle Space 1",
          },
          {
            id: "5",
            type: "system",
            title: "System Update",
            message: "Webhook subscriptions renewed successfully for all rooms",
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
            read: true,
          },
          {
            id: "6",
            type: "declined",
            title: "Booking Declined",
            message: "Team Lunch declined for Oakland Conference Room B - conflicts with existing booking",
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
            read: true,
            roomName: "Oakland Conference Room B",
          },
        ]
        setNotifications(defaultNotifications)
        localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(defaultNotifications))
      }

      const enabledSaved = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY)
      if (enabledSaved !== null) {
        setNotificationsEnabled(JSON.parse(enabledSaved))
      }
    } catch (e) {
      console.error("Failed to load notifications:", e)
    }
  }, [])

  const saveNotifications = (updated: AppNotification[]) => {
    setNotifications(updated)
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated))
  }

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }))
    saveNotifications(updated)
  }

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    saveNotifications(updated)
  }

  const deleteNotification = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id)
    saveNotifications(updated)
  }

  const clearAll = () => {
    saveNotifications([])
  }

  const toggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled)
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, JSON.stringify(enabled))
  }

  const getNotificationIcon = (type: AppNotification["type"]) => {
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

  const getNotificationBadge = (type: AppNotification["type"]) => {
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

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatInTimeZone(new Date(timestamp), "UTC", "MMM d, yyyy h:mm a")
    } catch {
      return "Unknown"
    }
  }

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "all") return true
    if (filter === "unread") return !n.read
    return n.type === filter
  })

  const unreadCount = notifications.filter((n) => !n.read).length

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
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`flex items-start gap-4 py-4 ${
                        !notification.read ? "bg-primary/5 -mx-6 px-6" : ""
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{notification.title}</p>
                          {!notification.read && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {notification.message}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          {getNotificationBadge(notification.type)}
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(notification.timestamp)}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!notification.read && (
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
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
