"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sparkles,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  DoorOpen,
  RefreshCw,
  Monitor,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react"
import type { AIInsight, BookingEvent, Room } from "@/lib/types"
import type { RoomSuggestion, AnomalyAnalysis } from "@/lib/ai-service"

interface AIInsightsPanelProps {
  insights: AIInsight[]
  bookings: BookingEvent[]
  rooms: Room[]
}

interface AIStatus {
  connected: boolean
  lastCheck: Date | null
}

export function AIInsightsPanel({ insights, bookings, rooms }: AIInsightsPanelProps) {
  const [activeTab, setActiveTab] = useState("suggestions")
  const [isLoading, setIsLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState<AIStatus>({ connected: false, lastCheck: null })
  const [suggestions, setSuggestions] = useState<RoomSuggestion | null>(null)
  const [anomalies, setAnomalies] = useState<AnomalyAnalysis | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const declinedBookings = bookings.filter(b => b.outcome.startsWith("declined"))
  const latestDeclined = declinedBookings[0]

  const fetchSuggestions = async () => {
    if (!latestDeclined) return
    
    setIsLoading(true)
    try {
      const response = await fetch("/api/ai/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking: latestDeclined,
          availableRooms: rooms.filter(r => r.isActive && r.site === latestDeclined.site),
          allRooms: rooms,
        }),
      })
      const data = await response.json()
      setSuggestions(data.suggestions)
      setAiStatus({ connected: data.aiAvailable, lastCheck: new Date() })
    } catch (error) {
      console.error("Failed to fetch suggestions:", error)
      setAiStatus({ connected: false, lastCheck: new Date() })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAnomalies = async () => {
    setIsLoading(true)
    try {
      const siteStats = [
        { 
          site: "Cambridge" as const, 
          declines: bookings.filter(b => b.site === "Cambridge" && b.outcome.startsWith("declined")).length,
          total: bookings.filter(b => b.site === "Cambridge").length
        },
        { 
          site: "Oakland" as const, 
          declines: bookings.filter(b => b.site === "Oakland" && b.outcome.startsWith("declined")).length,
          total: bookings.filter(b => b.site === "Oakland").length
        },
      ]
      
      const response = await fetch("/api/ai/anomalies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recentBookings: bookings.slice(0, 50),
          historicalDeclineRate: 0.15,
          webhookFailures: 0,
          siteStats,
        }),
      })
      const data = await response.json()
      setAnomalies(data.analysis)
      setAiStatus({ connected: data.aiAvailable, lastCheck: new Date() })
    } catch (error) {
      console.error("Failed to fetch anomalies:", error)
      setAiStatus({ connected: false, lastCheck: new Date() })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    if (activeTab === "suggestions") {
      fetchSuggestions()
    } else if (activeTab === "anomalies") {
      fetchAnomalies()
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Assistant
          </CardTitle>
          <div className="flex items-center gap-2">
            {aiStatus.lastCheck && (
              <Badge 
                variant="outline" 
                className={aiStatus.connected ? "border-success text-success" : "border-destructive text-destructive"}
              >
                {aiStatus.connected ? (
                  <><Wifi className="mr-1 h-3 w-3" /> AI Connected</>
                ) : (
                  <><WifiOff className="mr-1 h-3 w-3" /> Fallback Mode</>
                )}
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          AI-powered recommendations with human-reviewed guardrails
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="suggestions" className="text-xs">
              <DoorOpen className="mr-1 h-3 w-3" />
              Alternatives
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="text-xs">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Anomalies
            </TabsTrigger>
            <TabsTrigger value="av" className="text-xs">
              <Monitor className="mr-1 h-3 w-3" />
              AV Guide
            </TabsTrigger>
            <TabsTrigger value="ea" className="text-xs">
              <FileText className="mr-1 h-3 w-3" />
              EA Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="mt-4 space-y-4">
            {!mounted ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : suggestions ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{suggestions.summary}</p>
                {suggestions.suggestions.map((suggestion, idx) => (
                  <div
                    key={suggestion.roomId || idx}
                    className="rounded-lg border border-border bg-secondary/30 p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-foreground">{suggestion.roomName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{suggestion.reason}</p>
                        {suggestion.availableSlots && suggestion.availableSlots.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {suggestion.availableSlots.map((slot, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {slot}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button variant="outline" size="sm">
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : latestDeclined ? (
              <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-6 text-center">
                <DoorOpen className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground">
                  Get Alternative Room Suggestions
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  AI will analyze &quot;{latestDeclined.roomName}&quot; decline and suggest alternatives
                </p>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="mt-4"
                  onClick={fetchSuggestions}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Analyzing...</>
                  ) : (
                    <><Sparkles className="mr-2 h-3 w-3" /> Generate Suggestions</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-6 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
                <p className="mt-2 text-sm font-medium text-foreground">
                  No Declined Bookings
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  All recent bookings have been accepted
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="anomalies" className="mt-4 space-y-4">
            {!mounted ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : anomalies ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      anomalies.overallHealth === "healthy"
                        ? "border-success text-success"
                        : anomalies.overallHealth === "attention_needed"
                        ? "border-warning text-warning"
                        : "border-destructive text-destructive"
                    }
                  >
                    {anomalies.overallHealth === "healthy" ? "System Healthy" : 
                     anomalies.overallHealth === "attention_needed" ? "Attention Needed" : "Critical Issues"}
                  </Badge>
                </div>
                {anomalies.anomalies.length === 0 ? (
                  <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-center">
                    <CheckCircle2 className="mx-auto h-6 w-6 text-success" />
                    <p className="mt-2 text-sm text-foreground">No anomalies detected</p>
                  </div>
                ) : (
                  anomalies.anomalies.map((anomaly, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border-l-2 bg-secondary/30 p-3 ${
                        anomaly.severity === "critical"
                          ? "border-l-destructive"
                          : anomaly.severity === "warning"
                          ? "border-l-warning"
                          : "border-l-muted-foreground"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          className={`mt-0.5 h-4 w-4 ${
                            anomaly.severity === "critical"
                              ? "text-destructive"
                              : anomaly.severity === "warning"
                              ? "text-warning"
                              : "text-muted-foreground"
                          }`}
                        />
                        <div>
                          <p className="font-medium text-foreground">{anomaly.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{anomaly.description}</p>
                          <p className="mt-2 text-xs text-primary">{anomaly.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-6 text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground">
                  Operational Anomaly Detection
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  AI monitors decline rates, webhook health, and site-level drift
                </p>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="mt-4"
                  onClick={fetchAnomalies}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Analyzing...</>
                  ) : (
                    <><Sparkles className="mr-2 h-3 w-3" /> Run Analysis</>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="av" className="mt-4">
            <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-6 text-center">
              <Monitor className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-foreground">
                AV Guidance Generation
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                AI generates customized AV setup instructions based on room profile and meeting type.
                Select a booking to generate guidance.
              </p>
              <Badge variant="secondary" className="mt-4">
                Guardrail: Uses approved snippets only
              </Badge>
            </div>
          </TabsContent>

          <TabsContent value="ea" className="mt-4">
            <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-6 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-foreground">
                Executive Assistant Notes
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                AI generates concise internal notes with room state and next-best options for EA workflows.
              </p>
              <Badge variant="secondary" className="mt-4">
                Guardrail: Internal recipients only
              </Badge>
            </div>
          </TabsContent>
        </Tabs>

        {/* Guardrails Info */}
        <div className="mt-4 rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">AI Guardrails Active</p>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-success" />
              Recommendations only - no auto-rebooking
            </li>
            <li className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-success" />
              Template-anchored phrasing for external messages
            </li>
            <li className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-success" />
              Fallback to deterministic text if AI unavailable
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
