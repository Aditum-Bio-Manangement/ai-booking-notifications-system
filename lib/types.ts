export type Site = "Cambridge" | "Oakland"

export type BookingOutcome = "accepted" | "declined-conflict" | "declined-policy" | "canceled" | "pending"

export interface Room {
  id: string
  roomUpn: string
  site: Site
  displayName: string
  capacity: number
  avProfile: string
  accessNotes: string
  floor: string
  building: string
  isActive: boolean
}

export interface BookingEvent {
  id: string
  roomId: string
  roomName: string
  site: Site
  organizer: string
  organizerEmail: string
  subject: string
  startTime: string
  endTime: string
  outcome: BookingOutcome
  declineReason?: string
  notificationSent: boolean
  notificationTime?: string
  createdAt: string
}

export interface Subscription {
  id: string
  roomUpn: string
  roomName: string
  expirationDateTime: string
  status: "active" | "expiring" | "expired"
  lastNotification?: string
}

export interface SystemHealth {
  webhookStatus: "healthy" | "degraded" | "down"
  queueDepth: number
  deadLetterCount: number
  subscriptionHealth: number
  lastProcessedTime: string
  notificationSuccessRate: number
}

export interface DashboardMetrics {
  totalBookingsToday: number
  acceptedToday: number
  declinedToday: number
  notificationsSent: number
  avgProcessingTime: number
}

export interface AIInsight {
  id: string
  type: "alternative" | "anomaly" | "recommendation"
  title: string
  description: string
  timestamp: string
  roomId?: string
  severity: "info" | "warning" | "critical"
}
