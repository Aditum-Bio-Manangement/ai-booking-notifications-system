"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Bell, Settings, CheckCircle2, XCircle, Clock, BellOff, CheckCheck, ExternalLink, User, LogOut, Shield, Camera, Menu } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ThemeToggle } from "@/components/theme-toggle"

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

interface DashboardHeaderProps {
  onSettingsClick?: (section: string) => void
  onMenuToggle?: () => void
  bookings?: BookingEvent[]
}

export function DashboardHeader({ onSettingsClick, onMenuToggle, bookings = [] }: DashboardHeaderProps) {
  const { user, logout } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set())

  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U"

  // Generate notifications from real bookings
  useEffect(() => {
    try {
      // Load read notification IDs
      const savedReadIds = localStorage.getItem("read-notification-ids")
      if (savedReadIds) {
        setReadNotificationIds(new Set(JSON.parse(savedReadIds)))
      }

      const enabledSaved = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY)
      if (enabledSaved !== null) {
        setNotificationsEnabled(JSON.parse(enabledSaved))
      }
    } catch (e) {
      console.error("Failed to load notification settings:", e)
    }
  }, [])

  // Convert bookings to notifications
  useEffect(() => {
    if (bookings.length > 0) {
      const bookingNotifications: AppNotification[] = bookings
        .slice(0, 10) // Show last 10 bookings
        .map((booking) => ({
          id: booking.id,
          type: booking.outcome === "accepted" ? "accepted" : "declined" as AppNotification["type"],
          title: booking.outcome === "accepted" ? "Booking Confirmed" : "Booking Declined",
          message: booking.outcome === "accepted"
            ? `${booking.subject} confirmed for ${booking.roomName}`
            : `${booking.subject} declined for ${booking.roomName}`,
          timestamp: booking.createdAt,
          read: readNotificationIds.has(booking.id),
          roomName: booking.roomName,
        }))
      setNotifications(bookingNotifications)
    }
  }, [bookings, readNotificationIds])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id))
    setReadNotificationIds(allIds)
    localStorage.setItem("read-notification-ids", JSON.stringify([...allIds]))
    setNotifications(notifications.map((n) => ({ ...n, read: true })))
  }

  const markAsRead = (id: string) => {
    const newReadIds = new Set(readNotificationIds)
    newReadIds.add(id)
    setReadNotificationIds(newReadIds)
    localStorage.setItem("read-notification-ids", JSON.stringify([...newReadIds]))
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const toggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled)
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, JSON.stringify(enabled))
  }

  const getNotificationIcon = (type: AppNotification["type"]) => {
    switch (type) {
      case "accepted":
        return <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.19_145)]" />
      case "declined":
        return <XCircle className="h-4 w-4 text-destructive" />
      case "subscription":
        return <Clock className="h-4 w-4 text-warning" />
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />
    }
  }

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "Unknown"
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return "Unknown"

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-3 md:px-6">
      <div className="flex items-center gap-2 md:gap-3">
        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Image
          src="/images/aditum-logo-horizontal.png"
          alt="Aditum Bio"
          width={140}
          height={40}
          className="object-contain"
          style={{ height: 'auto', width: 'auto', maxHeight: '32px' }}
          priority
        />
        <span className="hidden rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary sm:inline">
          Enterprise
        </span>
        <span className="hidden text-muted-foreground md:inline">/</span>
        <span className="hidden text-sm text-foreground md:inline">Booking Notifications Admin</span>
      </div>
      <div className="flex items-center gap-1 md:gap-2">
        {/* Notifications Dropdown */}
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && notificationsEnabled && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 sm:w-96 max-h-[80vh] overflow-hidden flex flex-col">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-normal text-muted-foreground">
                  {notificationsEnabled ? "On" : "Off"}
                </span>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={toggleNotifications}
                  className="scale-75"
                />
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {!notificationsEnabled ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BellOff className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">Notifications are disabled</p>
                <p className="text-xs text-muted-foreground">Enable to receive booking alerts</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No notifications</p>
                <p className="text-xs text-muted-foreground">You&apos;re all caught up!</p>
              </div>
            ) : (
              <>
                <ScrollArea className="max-h-[50vh] flex-1">
                  <div className="flex flex-col">
                    {notifications.slice(0, 5).map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className={`flex cursor-pointer items-start gap-3 p-3 ${!notification.read ? "bg-primary/5" : ""
                          }`}
                        onClick={() => markAsRead(notification.id)}
                      >
                        <div className="mt-0.5 shrink-0">{getNotificationIcon(notification.type)}</div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium leading-none">{notification.title}</p>
                            {!notification.read && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {formatTimestamp(notification.timestamp)}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </div>
                </ScrollArea>
                <DropdownMenuSeparator />
                <div className="flex items-center justify-between p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={(e) => {
                      e.preventDefault()
                      markAllAsRead()
                    }}
                    disabled={unreadCount === 0}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all as read
                  </Button>
                  <Link href="/notifications" onClick={() => setIsOpen(false)}>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                      View all
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSettingsClick?.("subscriptions")}>
              Graph Subscriptions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSettingsClick?.("templates")}>
              Email Templates
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSettingsClick?.("policies")}>
              Room Policies
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSettingsClick?.("settings")}>
              System Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-2 h-8 w-8 rounded-full p-0">
              <Avatar className="h-8 w-8">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="flex items-center gap-3 p-3">
              <Avatar className="h-10 w-10">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user?.name || ""} />}
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{user?.name || "User"}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email || ""}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                View Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/profile?tab=photo" className="flex items-center gap-2 cursor-pointer">
                <Camera className="h-4 w-4" />
                Update Photo
              </Link>
            </DropdownMenuItem>
            {user?.role === "admin" && (
              <DropdownMenuItem onClick={() => onSettingsClick?.("settings")} className="gap-2">
                <Shield className="h-4 w-4" />
                Admin Settings
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async (e) => {
                e.preventDefault()
                await logout()
              }}
              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
