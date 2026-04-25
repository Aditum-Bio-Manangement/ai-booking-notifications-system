"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
  Mail,
  Shield,
  Calendar,
  Loader2,
  ChevronRight,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTimezone } from "@/lib/timezone-context"
import type { BookingEvent } from "@/lib/types"

// Processing step types
type ProcessingStepStatus = "pending" | "in-progress" | "completed" | "failed" | "skipped"

interface ProcessingStep {
  id: string
  name: string
  status: ProcessingStepStatus
  startTime?: string
  endTime?: string
  duration?: number
  details?: string
  error?: string
}

interface QueueJob {
  id: string
  bookingId: string
  subject: string
  organizer: string
  organizerEmail: string
  roomName: string
  site: string
  outcome: "accepted" | "declined" | "pending"
  status: "queued" | "processing" | "completed" | "failed"
  createdAt: string
  completedAt?: string
  steps: ProcessingStep[]
  retryCount: number
  priority: "high" | "normal" | "low"
}

interface ProcessingQueueProps {
  bookings: BookingEvent[]
  isLoading?: boolean
}

// Generate job data from booking, showing REAL status based on notificationSent
function generateJobFromBooking(booking: BookingEvent): QueueJob {
  // Safely parse createdAt with fallback to current time if invalid
  const createdAtDate = booking.createdAt ? new Date(booking.createdAt) : new Date()
  const createdAtTime = isNaN(createdAtDate.getTime()) ? Date.now() : createdAtDate.getTime()
  const safeCreatedAt = booking.createdAt && !isNaN(new Date(booking.createdAt).getTime())
    ? booking.createdAt
    : new Date().toISOString()

  // Determine actual status based on real booking data
  const isPending = booking.outcome === "pending"
  const isCanceled = booking.outcome === "canceled"
  const emailWasSent = booking.notificationSent === true
  const emailShouldBeSent = !isPending && !isCanceled && (booking.outcome === "accepted" || booking.outcome === "declined-conflict" || booking.outcome === "declined-policy")

  // Determine step statuses based on actual state
  const decisionStatus: "completed" | "in-progress" | "pending" | "failed" = isPending ? "pending" : "completed"
  const templateStatus: "completed" | "in-progress" | "pending" | "failed" =
    isPending ? "pending" :
      isCanceled ? "completed" :
        emailWasSent ? "completed" : "in-progress"
  const sendStatus: "completed" | "in-progress" | "pending" | "failed" =
    isPending ? "pending" :
      isCanceled ? "completed" :
        emailWasSent ? "completed" :
          emailShouldBeSent ? "pending" : "completed"

  const baseSteps: ProcessingStep[] = [
    {
      id: "receive",
      name: "Event Received",
      status: "completed",
      startTime: safeCreatedAt,
      endTime: new Date(createdAtTime + 50).toISOString(),
      duration: 50,
      details: "Webhook received from Microsoft Graph",
    },
    {
      id: "validate",
      name: "Validate Request",
      status: isPending ? "in-progress" : "completed",
      startTime: new Date(createdAtTime + 50).toISOString(),
      endTime: isPending ? undefined : new Date(createdAtTime + 150).toISOString(),
      duration: isPending ? undefined : 100,
      details: "Validated organizer, room availability, and policy compliance",
    },
    {
      id: "policy",
      name: "Policy Check",
      status: isPending ? "pending" : "completed",
      startTime: isPending ? undefined : new Date(createdAtTime + 150).toISOString(),
      endTime: isPending ? undefined : new Date(createdAtTime + 300).toISOString(),
      duration: isPending ? undefined : 150,
      details: booking.outcome === "accepted"
        ? "All policies passed"
        : booking.outcome === "declined-conflict"
          ? "Conflict detected with existing booking"
          : booking.outcome === "canceled"
            ? "Booking was canceled"
            : "Policy violation detected",
    },
    {
      id: "decision",
      name: "Booking Decision",
      status: decisionStatus,
      startTime: isPending ? undefined : new Date(createdAtTime + 300).toISOString(),
      endTime: isPending ? undefined : new Date(createdAtTime + 350).toISOString(),
      duration: isPending ? undefined : 50,
      details: isPending
        ? "Awaiting room response"
        : isCanceled
          ? "Booking canceled by organizer"
          : `Decision: ${booking.outcome === "accepted" ? "Accept" : "Decline"} booking`,
    },
    {
      id: "template",
      name: "Generate Email",
      status: templateStatus,
      startTime: (isPending || isCanceled) ? undefined : new Date(createdAtTime + 350).toISOString(),
      endTime: (isPending || !emailWasSent) ? undefined : new Date(createdAtTime + 500).toISOString(),
      duration: emailWasSent ? 150 : undefined,
      details: isCanceled
        ? "No email needed for canceled booking"
        : emailWasSent
          ? "Email template rendered"
          : "Waiting to generate email",
    },
    {
      id: "send",
      name: "Send Notification",
      status: sendStatus,
      startTime: emailWasSent ? new Date(createdAtTime + 500).toISOString() : undefined,
      endTime: emailWasSent ? (booking.notificationTime || new Date(createdAtTime + 800).toISOString()) : undefined,
      duration: emailWasSent ? 300 : undefined,
      details: isCanceled
        ? "No notification for canceled booking"
        : emailWasSent
          ? `Email sent to ${booking.organizerEmail}`
          : `Pending: Email to ${booking.organizerEmail}`,
    },
  ]

  // Determine overall job status based on actual booking state
  let jobStatus: "processing" | "completed" | "failed" = "completed"
  if (isPending) {
    jobStatus = "processing"
  } else if (!isCanceled && emailShouldBeSent && !emailWasSent) {
    jobStatus = "processing" // Still waiting for email to be sent
  }

  return {
    id: `job-${booking.id}`,
    bookingId: booking.id,
    subject: booking.subject,
    organizer: booking.organizer,
    organizerEmail: booking.organizerEmail,
    roomName: booking.roomName,
    site: booking.site,
    outcome: booking.outcome === "accepted" ? "accepted" : booking.outcome === "pending" ? "pending" : "declined",
    status: jobStatus,
    createdAt: booking.createdAt,
    completedAt: jobStatus === "completed" ? (booking.notificationTime || booking.createdAt) : undefined,
    steps: baseSteps,
    retryCount: 0,
    priority: "normal",
  }
}

function StepStatusIcon({ status }: { status: ProcessingStepStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-success" />
    case "in-progress":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />
    case "skipped":
      return <Clock className="h-4 w-4 text-muted-foreground" />
    case "pending":
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />
  }
}

function JobStatusBadge({ status }: { status: QueueJob["status"] }) {
  const variants: Record<QueueJob["status"], { className: string; label: string }> = {
    queued: { className: "bg-muted text-muted-foreground", label: "Queued" },
    processing: { className: "bg-primary/10 text-primary", label: "Processing" },
    completed: { className: "bg-success/10 text-success", label: "Completed" },
    failed: { className: "bg-destructive/10 text-destructive", label: "Failed" },
  }
  const { className, label } = variants[status]
  return <Badge className={cn("font-medium", className)}>{label}</Badge>
}

function JobRow({ job, isExpanded, onToggle }: { job: QueueJob; isExpanded: boolean; onToggle: () => void }) {
  const { formatActivityTime } = useTimezone()
  const currentStep = job.steps.find(s => s.status === "in-progress")
  const failedStep = job.steps.find(s => s.status === "failed")
  const completedSteps = job.steps.filter(s => s.status === "completed").length
  const totalSteps = job.steps.length
  const progress = (completedSteps / totalSteps) * 100

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}

        <div className="flex flex-1 items-center gap-4">
          {/* Status indicator */}
          <div className="relative">
            {job.status === "processing" ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : job.status === "completed" ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
            ) : job.status === "failed" ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Job info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate">{job.subject}</span>
              <JobStatusBadge status={job.status} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{job.organizer}</span>
              <span>-</span>
              <span>{job.roomName}</span>
              {currentStep && (
                <>
                  <span>-</span>
                  <span className="text-primary">{currentStep.name}...</span>
                </>
              )}
              {failedStep && (
                <>
                  <span>-</span>
                  <span className="text-destructive">{failedStep.error}</span>
                </>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="hidden sm:flex w-24 flex-col gap-1">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  job.status === "failed" ? "bg-destructive" :
                    job.status === "completed" ? "bg-success" : "bg-primary"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground text-center">
              {completedSteps}/{totalSteps}
            </span>
          </div>

          {/* Time */}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatActivityTime(job.createdAt)}
          </span>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="bg-muted/30 px-4 py-4 pl-12">
          <div className="flex flex-col gap-4">
            {/* Steps timeline */}
            <div className="relative">
              {job.steps.map((step, index) => (
                <div key={step.id} className="flex items-start gap-3 pb-4 last:pb-0">
                  {/* Timeline line */}
                  {index < job.steps.length - 1 && (
                    <div className={cn(
                      "absolute left-[7px] top-5 w-0.5 h-[calc(100%-20px)]",
                      step.status === "completed" ? "bg-success/30" : "bg-border"
                    )} style={{ top: `${index * 44 + 20}px`, height: "24px" }} />
                  )}

                  {/* Step icon */}
                  <div className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center mt-0.5">
                    <StepStatusIcon status={step.status} />
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "text-sm font-medium",
                        step.status === "completed" ? "text-foreground" :
                          step.status === "in-progress" ? "text-primary" :
                            step.status === "failed" ? "text-destructive" :
                              "text-muted-foreground"
                      )}>
                        {step.name}
                      </span>
                      {step.duration !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {step.duration}ms
                        </span>
                      )}
                      {step.status === "in-progress" && (
                        <span className="text-xs text-primary animate-pulse">Running...</span>
                      )}
                    </div>
                    {step.details && (
                      <p className="text-xs text-muted-foreground mt-0.5">{step.details}</p>
                    )}
                    {step.error && (
                      <p className="text-xs text-destructive mt-0.5">{step.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions for failed jobs */}
            {job.status === "failed" && (
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </Button>
                <span className="text-xs text-muted-foreground">
                  Retry count: {job.retryCount}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function ProcessingQueue({ bookings, isLoading = false }: ProcessingQueueProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<"all" | "processing" | "completed" | "failed">("all")
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Convert bookings to queue jobs
  const jobs = bookings
    .slice(0, 20) // Limit to recent 20
    .map(generateJobFromBooking)
    .sort((a, b) => {
      // Processing first, then by time
      if (a.status === "processing" && b.status !== "processing") return -1
      if (b.status === "processing" && a.status !== "processing") return 1
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime)
    })

  const filteredJobs = jobs.filter(job => {
    if (activeFilter === "all") return true
    return job.status === activeFilter
  })

  const stats = {
    total: jobs.length,
    processing: jobs.filter(j => j.status === "processing").length,
    completed: jobs.filter(j => j.status === "completed").length,
    failed: jobs.filter(j => j.status === "failed").length,
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Processing Queue</CardTitle>
              <CardDescription>Real-time job processing status</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Processing Queue</CardTitle>
            <CardDescription>Simulated job processing status (based on bookings data)</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Stats summary */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={() => setActiveFilter("all")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
              activeFilter === "all"
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>All</span>
            <Badge variant="secondary" className="text-xs">{stats.total}</Badge>
          </button>
          <button
            onClick={() => setActiveFilter("processing")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
              activeFilter === "processing"
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Loader2 className={cn("h-3 w-3", stats.processing > 0 && "animate-spin")} />
            <span>Processing</span>
            <Badge className="bg-primary/10 text-primary text-xs">{stats.processing}</Badge>
          </button>
          <button
            onClick={() => setActiveFilter("completed")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
              activeFilter === "completed"
                ? "bg-success/10 text-success font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>Completed</span>
            <Badge className="bg-success/10 text-success text-xs">{stats.completed}</Badge>
          </button>
          <button
            onClick={() => setActiveFilter("failed")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
              activeFilter === "failed"
                ? "bg-destructive/10 text-destructive font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <AlertCircle className="h-3 w-3" />
            <span>Failed</span>
            <Badge className="bg-destructive/10 text-destructive text-xs">{stats.failed}</Badge>
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No jobs to display</p>
              <p className="text-xs text-muted-foreground">
                {activeFilter !== "all" ? "Try selecting a different filter" : "Jobs will appear here as bookings are processed"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  isExpanded={expandedJobId === job.id}
                  onToggle={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
