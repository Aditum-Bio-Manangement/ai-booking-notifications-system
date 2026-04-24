"use client"

import { cn } from "@/lib/utils"

// Dual Orbit Loading Indicator
export function DualOrbitLoader({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  }

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      {/* Outer orbit */}
      <div className="absolute inset-0 animate-spin" style={{ animationDuration: "1.5s" }}>
        <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="40 20"
            className="text-primary opacity-80"
          />
        </svg>
      </div>
      {/* Inner orbit - counter-rotating */}
      <div className="absolute inset-1 animate-spin" style={{ animationDuration: "1s", animationDirection: "reverse" }}>
        <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
          <circle
            cx="12"
            cy="12"
            r="8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="25 25"
            className="text-primary/60"
          />
        </svg>
      </div>
    </div>
  )
}

// Shimmer effect wrapper
function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent",
        className
      )}
    />
  )
}

// Skeleton base component
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-muted", className)}>
      <Shimmer />
    </div>
  )
}

// Table row skeleton with shimmer
export function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <div className="relative overflow-hidden">
            {i === 0 ? (
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ) : (
              <Skeleton className="h-4 w-full max-w-[120px]" />
            )}
          </div>
        </td>
      ))}
    </tr>
  )
}

// Full table skeleton
export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border">
      {/* Header skeleton */}
      <div className="border-b border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </div>
      
      {/* Table header */}
      <div className="border-b border-border bg-muted/20">
        <div className="flex p-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="flex-1">
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Table body */}
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Metrics card skeleton with dual orbit
export function MetricsCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <div className="mt-4 flex items-center justify-center">
        <DualOrbitLoader size="md" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

// Full metrics cards skeleton
export function MetricsCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <MetricsCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Activity chart skeleton
export function ChartSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex h-[300px] items-end justify-around gap-2 pt-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <Skeleton 
              className="w-full rounded-t" 
              style={{ height: `${Math.random() * 60 + 40}%` }} 
            />
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Recent activity skeleton
export function ActivitySkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-4">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// AI Insights skeleton
export function AIInsightsSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <div className="p-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Full page loading state
export function PageLoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <MetricsCardsSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ActivitySkeleton />
      </div>
      <TableSkeleton />
    </div>
  )
}
