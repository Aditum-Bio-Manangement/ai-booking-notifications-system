"use client"

import { useState } from "react"
import useSWR from "swr"
import { DashboardHeader } from "@/components/dashboard/header"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { MetricsCards } from "@/components/dashboard/metrics-cards"
import { RoomsTable } from "@/components/dashboard/rooms-table"
import { BookingsTable } from "@/components/dashboard/bookings-table"
import { SystemHealthPanel } from "@/components/dashboard/system-health"
import { ProcessingQueue } from "@/components/dashboard/processing-queue"
import { AIInsightsPanel } from "@/components/dashboard/ai-insights"
import { ActivityChart } from "@/components/dashboard/activity-chart"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { EmailTemplateEditor } from "@/components/dashboard/email-template-editor"
import { SendHistoryTable } from "@/components/dashboard/send-history-table"
import { SettingsPanel } from "@/components/dashboard/settings-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, RefreshCw } from "lucide-react"
import {
  aiInsights,
} from "@/lib/mock-data"
import type { Room, BookingEvent, DashboardMetrics } from "@/lib/types"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch real data from Microsoft Graph API
  const { data: roomsData, error: roomsError, isLoading: roomsLoading, mutate: mutateRooms } = useSWR<{
    rooms: Room[];
    configured: boolean
  }>("/api/rooms", fetcher, {
    refreshInterval: 60000, // Refresh every minute
  })

  const { data: eventsData, error: eventsError, isLoading: eventsLoading, mutate: mutateEvents } = useSWR<{
    bookings: BookingEvent[];
    configured: boolean;
  }>("/api/events", fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
  })

  const { data: subsData, mutate: mutateSubscriptions } = useSWR<{
    subscriptions: Array<{
      id: string;
      roomEmail?: string;
      roomUpn?: string;
      roomName?: string;
      expiresAt?: string;
      expirationDateTime?: string;
      status?: string;
      lastNotification?: string;
    }>;
    configured: boolean;
  }>("/api/subscriptions", fetcher, {
    refreshInterval: 60000,
  })

  // Use real data - no mock data fallback during loading
  const isConfigured = roomsData?.configured === true && eventsData?.configured === true
  const rooms = Array.isArray(roomsData?.rooms) ? roomsData.rooms : []
  const bookingEvents = Array.isArray(eventsData?.bookings) ? eventsData.bookings : []
  const subscriptions = Array.isArray(subsData?.subscriptions) ? subsData.subscriptions : []
  const isLoading = roomsLoading || eventsLoading

  // Filter bookings created today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayBookings = bookingEvents.filter((b) => {
    const createdDate = new Date(b.createdAt)
    return createdDate >= today
  })

  // Calculate processing time only for bookings with actual notification times
  const processedBookings = bookingEvents.filter((b) => b.notificationSent && b.notificationTime)
  const avgProcessingTimeSeconds = processedBookings.length > 0
    ? processedBookings.reduce((acc, b) => {
      const created = new Date(b.createdAt).getTime()
      const notified = new Date(b.notificationTime!).getTime()
      const diffSeconds = Math.abs(notified - created) / 1000
      // Cap at 1 hour - anything longer is likely bad data
      return acc + Math.min(diffSeconds, 3600)
    }, 0) / processedBookings.length
    : 0

  // Calculate real-time metrics from booking data
  const dashboardMetrics: DashboardMetrics = {
    totalBookingsToday: todayBookings.length,
    acceptedToday: todayBookings.filter((b) => b.outcome === "accepted").length,
    declinedToday: todayBookings.filter((b) =>
      b.outcome === "declined-conflict" || b.outcome === "declined-policy"
    ).length,
    notificationsSent: bookingEvents.filter((b) => b.notificationSent).length,
    avgProcessingTime: Math.round(avgProcessingTimeSeconds),
  }

  // Handle delete booking from queue
  const handleDeleteBooking = async (bookingId: string) => {
    try {
      const response = await fetch("/api/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      })
      if (response.ok) {
        await mutateEvents()
      } else {
        console.error("Failed to delete booking")
      }
    } catch (error) {
      console.error("Error deleting booking:", error)
    }
  }

  // Handle end booking with error
  const handleEndWithError = async (bookingId: string) => {
    try {
      const response = await fetch("/api/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, action: "end-with-error" }),
      })
      if (response.ok) {
        await mutateEvents()
      } else {
        console.error("Failed to end booking with error")
      }
    } catch (error) {
      console.error("Error ending booking:", error)
    }
  }

  // Handle settings navigation from header
  const handleSettingsClick = (section: string) => {
    if (section === "templates") {
      setActiveTab("notifications")
    } else if (section === "subscriptions" || section === "settings") {
      setActiveTab("settings")
    } else if (section === "policies") {
      setActiveTab("rooms")
    }
  }

  const ConnectionStatus = () => {
    if (isLoading) {
      return (
        <Card className="border-muted/50 bg-muted/5">
          <CardContent className="flex items-center gap-3 py-1">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <div>
              <p className="text-sm font-medium text-foreground">Connecting to Microsoft Graph</p>
              <p className="text-xs text-muted-foreground">
                Loading data from your Microsoft 365 tenant...
              </p>
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card className="border-success/50 bg-success/5">
        <CardContent className="flex items-center gap-3 py-1">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div>
            <p className="text-sm font-medium text-foreground">Connected to Microsoft Graph</p>
            <p className="text-xs text-muted-foreground">
              Live data from your Microsoft 365 tenant
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Dashboard Overview</h1>
                <p className="text-sm text-muted-foreground">
                  Monitor room bookings, notifications, and system health across Cambridge and
                  Oakland offices
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isRefreshing}
                onClick={async () => {
                  setIsRefreshing(true)
                  await Promise.all([mutateRooms(), mutateEvents()])
                  setIsRefreshing(false)
                }}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
            <ConnectionStatus />
            <MetricsCards metrics={dashboardMetrics} isLoading={roomsLoading || eventsLoading} />
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ActivityChart onRefresh={() => mutateEvents()} bookings={bookingEvents} isLoading={isLoading} />
              </div>
              <RecentActivity bookings={bookingEvents} isLoading={isLoading} />
            </div>
            <BookingsTable bookings={bookingEvents.slice(0, 5)} />
          </div>
        )
      case "rooms":
        return (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Room Management</h1>
              <p className="text-sm text-muted-foreground">
                View and manage room metadata, AV profiles, and access policies for all
                conference rooms
              </p>
            </div>
            <RoomsTable rooms={rooms} isLoading={roomsLoading} onRefresh={() => mutateRooms()} />
          </div>
        )
      case "bookings":
        return (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Booking Events</h1>
              <p className="text-sm text-muted-foreground">
                Track all booking requests, outcomes, and notification status
              </p>
            </div>
            <BookingsTable bookings={bookingEvents} isLoading={eventsLoading} onRefresh={() => mutateEvents()} />
          </div>
        )
      case "notifications":
        return (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Notification Center</h1>
              <p className="text-sm text-muted-foreground">
                Configure and preview branded email notifications for booking outcomes
              </p>
            </div>
            <Tabs defaultValue="templates" className="w-full">
              <TabsList>
                <TabsTrigger value="templates">Email Templates</TabsTrigger>
                <TabsTrigger value="history">Send History</TabsTrigger>
              </TabsList>
              <TabsContent value="templates" className="mt-4">
                <EmailTemplateEditor />
              </TabsContent>
              <TabsContent value="history" className="mt-4">
                <SendHistoryTable
                  bookings={bookingEvents}
                  isLoading={eventsLoading}
                  onRefresh={() => mutateEvents()}
                />
              </TabsContent>
            </Tabs>
          </div>
        )
      case "monitoring":
        // Calculate real system health from booking data
        const sentNotifications = bookingEvents.filter(b => b.notificationSent).length
        const totalWithOutcome = bookingEvents.filter(b => b.outcome !== "pending").length
        const successRate = totalWithOutcome > 0
          ? Math.round((sentNotifications / totalWithOutcome) * 100 * 10) / 10
          : 100

        // Find the most recent notification time
        const notificationTimes = bookingEvents
          .filter(b => b.notificationTime)
          .map(b => new Date(b.notificationTime!).getTime())
          .filter(t => !isNaN(t))
        const lastProcessedTime = notificationTimes.length > 0
          ? new Date(Math.max(...notificationTimes)).toISOString()
          : new Date().toISOString()

        // Calculate queue depth: pending items + items that should have notification sent but haven't
        const queueDepth = bookingEvents.filter(b => {
          if (b.outcome === "pending") return true
          // Items that should have notification but don't yet
          if (b.outcome !== "canceled" && !b.notificationSent &&
            (b.outcome === "accepted" || b.outcome === "declined-conflict" || b.outcome === "declined-policy")) {
            return true
          }
          return false
        }).length

        // Dead letter: items that failed to send notification (outcome set but no notification and old enough)
        const deadLetterCount = bookingEvents.filter(b => {
          if (b.outcome === "pending" || b.outcome === "canceled") return false
          if (b.notificationSent) return false
          // Consider it dead letter if created more than 5 minutes ago without notification
          const createdTime = new Date(b.createdAt).getTime()
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
          return createdTime < fiveMinutesAgo
        }).length

        const realSystemHealth = {
          webhookStatus: "healthy" as const,
          queueDepth,
          deadLetterCount,
          subscriptionHealth: subscriptions.length > 0 ? 100 : 0,
          lastProcessedTime,
          notificationSuccessRate: successRate,
        }

        // Transform subscriptions to match expected type
        const transformedSubscriptions = subscriptions.map(sub => {
          const expiresAt = (sub as { expiresAt?: string }).expiresAt
          const expirationDateTime = (sub as { expirationDateTime?: string }).expirationDateTime
          const expiry = expiresAt || expirationDateTime || ""
          const expiryTime = expiry ? new Date(expiry).getTime() : 0
          const now = Date.now()
          const hoursUntilExpiry = expiryTime ? (expiryTime - now) / (1000 * 60 * 60) : 0

          let status: "active" | "expiring" | "expired" = "active"
          if (!expiryTime || expiryTime < now) {
            status = "expired"
          } else if (hoursUntilExpiry < 24) {
            status = "expiring"
          }

          return {
            id: sub.id,
            roomUpn: (sub as { roomEmail?: string }).roomEmail || sub.roomUpn || "",
            roomName: (sub as { roomEmail?: string }).roomEmail?.split("@")[0] || sub.roomName || "Unknown",
            expirationDateTime: expiry,
            status,
            lastNotification: sub.lastNotification,
          }
        })

        return (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">System Monitoring</h1>
              <p className="text-sm text-muted-foreground">
                Monitor webhook health, queue status, Graph subscriptions, and operational
                metrics
              </p>
            </div>
            <ProcessingQueue
              bookings={bookingEvents}
              isLoading={isLoading}
              onRefresh={() => mutateEvents()}
              onDeleteBooking={handleDeleteBooking}
              onEndWithError={handleEndWithError}
            />
            <SystemHealthPanel
              health={realSystemHealth}
              subscriptions={transformedSubscriptions}
              processingCount={queueDepth}
              onRefresh={() => mutateSubscriptions()}
            />
          </div>
        )
      case "ai-insights":
        return (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">AI Insights</h1>
              <p className="text-sm text-muted-foreground">
                AI-powered recommendations for room alternatives, anomaly detection, and
                operational optimization
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <AIInsightsPanel insights={aiInsights} bookings={bookingEvents} rooms={rooms} />
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="font-medium text-foreground">AI Feature Roadmap</h3>
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-2 w-2 rounded-full bg-success" />
                      <span className="text-sm text-foreground">
                        Suggested Alternatives for Declined Bookings
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-2 w-2 rounded-full bg-success" />
                      <span className="text-sm text-foreground">
                        Organizer-Facing Summary Generation
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-2 w-2 rounded-full bg-warning" />
                      <span className="text-sm text-foreground">
                        AV Guidance Rewrite Based on Meeting Type
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-2 w-2 rounded-full bg-warning" />
                      <span className="text-sm text-foreground">
                        Operational Anomaly Detection
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-2 w-2 rounded-full bg-muted-foreground" />
                      <span className="text-sm text-foreground">
                        Executive Assistant Briefing Notes
                      </span>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="font-medium text-foreground">AI Guardrails</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    AI recommendations only; no autonomous booking changes. Template-anchored
                    phrasing with content filtering and confidence thresholds.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      case "settings":
        return <SettingsPanel />
      case "docs":
        return (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Documentation</h1>
              <p className="text-sm text-muted-foreground">
                Technical documentation and implementation guides
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Microsoft Graph Subscriptions",
                  desc: "Setup and manage webhook subscriptions for room calendar events",
                },
                {
                  title: "Exchange Online Configuration",
                  desc: "Room mailbox settings and Set-CalendarProcessing baseline",
                },
                {
                  title: "Notification Templates",
                  desc: "HTML email template structure and customization guide",
                },
                {
                  title: "Security & Permissions",
                  desc: "RBAC for Applications, managed identity, and Key Vault setup",
                },
                {
                  title: "Monitoring & Alerting",
                  desc: "Application Insights setup and operational runbooks",
                },
                {
                  title: "AI Integration Guide",
                  desc: "Azure OpenAI enrichment service configuration",
                },
              ].map((doc, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4">
                  <h3 className="font-medium text-foreground">{doc.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{doc.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )
      case "help":
        return (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Help & Support</h1>
              <p className="text-sm text-muted-foreground">
                Get assistance with the Room Booking Notification System
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="font-medium text-foreground">Contact Support</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                For technical issues, contact the IT Service Desk or reach out to the
                Facilities team for room-specific questions.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-sm text-foreground">
                  IT Service Desk: servicedesk@aditumbio.com
                </p>
                <p className="text-sm text-foreground">
                  Facilities: facilities@aditumbio.com
                </p>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <DashboardHeader onSettingsClick={handleSettingsClick} onMenuToggle={() => setSidebarOpen(true)} bookings={bookingEvents} />
      <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{renderContent()}</main>
      </div>
    </div>
  )
}
