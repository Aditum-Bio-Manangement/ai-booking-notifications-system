"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  Webhook,
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
} from "lucide-react"
import { format } from "date-fns"
import type { SystemHealth, Subscription } from "@/lib/types"

interface SystemHealthProps {
  health: SystemHealth
  subscriptions: Subscription[]
  processingCount?: number
  onRefresh?: () => void
}

export function SystemHealthPanel({ health, subscriptions, processingCount = 0, onRefresh }: SystemHealthProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }
  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-[oklch(0.72_0.19_145)]/20 text-[oklch(0.72_0.19_145)]"
      case "degraded":
        return "bg-[oklch(0.8_0.15_80)]/20 text-[oklch(0.8_0.15_80)]"
      case "down":
        return "bg-[oklch(0.65_0.2_25)]/20 text-[oklch(0.65_0.2_25)]"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const activeSubscriptions = subscriptions.filter((s) => s.status === "active").length
  const expiringSubscriptions = subscriptions.filter((s) => s.status === "expiring").length
  const expiredSubscriptions = subscriptions.filter((s) => s.status === "expired").length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-primary" />
              System Health
            </CardTitle>
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
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Webhook className="h-4 w-4" />
                  Webhook Status
                </div>
                <Badge className={getStatusColor(health.webhookStatus)}>
                  {health.webhookStatus === "healthy" && (
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                  )}
                  {health.webhookStatus === "degraded" && (
                    <AlertTriangle className="mr-1 h-3 w-3" />
                  )}
                  {health.webhookStatus}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Last processed: {format(new Date(health.lastProcessedTime), "h:mm:ss a")}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Database className="h-4 w-4" />
                  Queue Depth
                </div>
                <span className="text-lg font-semibold text-foreground">
                  {processingCount}
                </span>
              </div>
              <Progress value={Math.min(processingCount * 10, 100)} className="h-1.5" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  Dead Letter
                </div>
                <span
                  className={`text-lg font-semibold ${
                    health.deadLetterCount > 0
                      ? "text-[oklch(0.65_0.2_25)]"
                      : "text-foreground"
                  }`}
                >
                  {health.deadLetterCount}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {health.deadLetterCount === 0 ? "No failed messages" : "Requires attention"}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  Success Rate
                </div>
                <span className="text-lg font-semibold text-[oklch(0.72_0.19_145)]">
                  {health.notificationSuccessRate}%
                </span>
              </div>
              <Progress value={health.notificationSuccessRate} className="h-1.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5 text-primary" />
            Graph Subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[oklch(0.72_0.19_145)]" />
              <span className="text-sm text-muted-foreground">
                Active: {activeSubscriptions}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[oklch(0.8_0.15_80)]" />
              <span className="text-sm text-muted-foreground">
                Expiring: {expiringSubscriptions}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[oklch(0.65_0.2_25)]" />
              <span className="text-sm text-muted-foreground">
                Expired: {expiredSubscriptions}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{sub.roomName}</p>
                  <p className="text-xs text-muted-foreground">{sub.roomUpn}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Expires</p>
                    <p className="text-sm text-foreground">
                      {format(new Date(sub.expirationDateTime), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <Badge
                    className={
                      sub.status === "active"
                        ? "bg-[oklch(0.72_0.19_145)]/20 text-[oklch(0.72_0.19_145)]"
                        : sub.status === "expiring"
                          ? "bg-[oklch(0.8_0.15_80)]/20 text-[oklch(0.8_0.15_80)]"
                          : "bg-[oklch(0.65_0.2_25)]/20 text-[oklch(0.65_0.2_25)]"
                    }
                  >
                    {sub.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
