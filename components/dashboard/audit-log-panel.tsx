"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    Search,
    Filter,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Download,
    Calendar,
    User,
    FileText,
    Settings,
    Shield,
    Mail,
    Bell,
    Database,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import { formatInTimeZone } from "date-fns-tz"

interface AuditLogEntry {
    id: string
    user_id: string | null
    user_email: string | null
    action: string
    resource_type: string | null
    resource_id: string | null
    details: Record<string, unknown> | null
    created_at: string
}

const ACTION_CATEGORIES = {
    settings: ["settings.updated", "settings.created", "settings.deleted", "settings.notifications_updated", "settings.smtp_updated", "settings.sso_updated", "settings.general_updated"],
    subscription: ["subscription.created", "subscription.renewed", "subscription.deleted", "subscription.expired", "room.subscribed", "room.unsubscribed", "room.auto_renew_changed"],
    notification: ["notification.sent", "notification.failed", "notification.created", "notification.resent", "notification.deleted", "test.notification.sent"],
    email: ["email.sent", "email.failed", "email.template.updated", "email.template.reset", "email.test_sent"],
    room: ["room.policy.updated", "room.settings.updated", "room.settings_updated", "rooms.notifications.suppressed", "rooms.notifications.enabled", "room.notifications.updated", "room.notifications.bulk_updated", "room.gal_visibility_changed", "room.delegate_changed"],
    auth: ["user.login", "user.logout", "user.login_failed", "user.created", "user.updated", "user.deleted", "user.role_changed"],
    users: ["users.synced"],
    queue: ["queue.item_deleted", "queue.cleared"],
    calendar: ["calendar.event_processed", "calendar.event_accepted", "calendar.event_declined"],
    booking: ["booking.deleted", "booking.marked_failed"],
}

const RESOURCE_TYPES = [
    "settings",
    "subscription",
    "notification",
    "email_template",
    "email",
    "room_policy",
    "room",
    "room_settings",
    "user",
    "users",
    "auth",
    "queue",
    "calendar",
    "booking",
]

export function AuditLogPanel() {
    const [entries, setEntries] = useState<AuditLogEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(0)
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

    // Filters
    const [searchQuery, setSearchQuery] = useState("")
    const [actionFilter, setActionFilter] = useState<string>("all")
    const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("all")
    const [dateRange, setDateRange] = useState<string>("7days")

    const ITEMS_PER_PAGE = 25

    const fetchAuditLog = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const params = new URLSearchParams({
                limit: ITEMS_PER_PAGE.toString(),
                offset: (page * ITEMS_PER_PAGE).toString(),
            })

            if (actionFilter !== "all") {
                params.set("action", actionFilter)
            }
            if (resourceTypeFilter !== "all") {
                params.set("resourceType", resourceTypeFilter)
            }
            if (searchQuery) {
                params.set("userEmail", searchQuery)
            }

            // Calculate date range
            const now = new Date()
            let startDate: Date | null = null
            switch (dateRange) {
                case "24hours":
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                    break
                case "7days":
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                    break
                case "30days":
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                    break
                case "90days":
                    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
                    break
            }

            if (startDate) {
                params.set("startDate", startDate.toISOString())
            }

            const response = await fetch(`/api/audit-log?${params.toString()}`)
            if (!response.ok) {
                throw new Error("Failed to fetch audit log")
            }

            const data = await response.json()
            setEntries(data.entries || [])
            setTotal(data.total || 0)
        } catch (e) {
            console.error("Failed to fetch audit log:", e)
            setError("Failed to load audit log")
        } finally {
            setIsLoading(false)
        }
    }, [page, actionFilter, resourceTypeFilter, searchQuery, dateRange])

    useEffect(() => {
        fetchAuditLog()
    }, [fetchAuditLog])

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const getActionIcon = (action: string) => {
        if (action.includes("settings")) return <Settings className="h-4 w-4" />
        if (action.includes("subscribed") || action.includes("subscription")) return <Bell className="h-4 w-4" />
        if (action.includes("notification")) return <Bell className="h-4 w-4" />
        if (action.includes("email") || action.includes("template")) return <Mail className="h-4 w-4" />
        if (action.includes("room")) return <Database className="h-4 w-4" />
        if (action.includes("booking") || action.includes("calendar")) return <Calendar className="h-4 w-4" />
        if (action.includes("queue")) return <Database className="h-4 w-4" />
        if (action.includes("user") || action.includes("login") || action.includes("logout")) return <User className="h-4 w-4" />
        if (action.includes("auth")) return <Shield className="h-4 w-4" />
        if (action.includes("sync")) return <User className="h-4 w-4" />
        return <FileText className="h-4 w-4" />
    }

    const getActionBadgeVariant = (action: string): "default" | "secondary" | "destructive" | "outline" => {
        if (action.includes("created") || action.includes("sent") || action.includes("login") || action.includes("synced")) {
            return "default"
        }
        if (action.includes("deleted") || action.includes("failed") || action.includes("expired") || action.includes("logout")) {
            return "destructive"
        }
        if (action.includes("updated") || action.includes("renewed") || action.includes("subscribed") || action.includes("changed")) {
            return "secondary"
        }
        return "outline"
    }

    const getStatusIcon = (action: string) => {
        if (action.includes("created") || action.includes("sent") || action.includes("login") || action.includes("renewed") || action.includes("subscribed") || action.includes("synced") || action.includes("accepted")) {
            return <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.19_145)]" />
        }
        if (action.includes("deleted") || action.includes("failed") || action.includes("expired") || action.includes("unsubscribed") || action.includes("declined") || action.includes("logout")) {
            return <XCircle className="h-4 w-4 text-destructive" />
        }
        if (action.includes("updated") || action.includes("changed") || action.includes("reset")) {
            return <Clock className="h-4 w-4 text-warning" />
        }
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />
    }

    const formatTimestamp = (timestamp: string) => {
        try {
            return formatInTimeZone(new Date(timestamp), "UTC", "MMM d, yyyy HH:mm:ss")
        } catch {
            return "Unknown"
        }
    }

    const formatAction = (action: string) => {
        return action
            .split(".")
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" - ")
    }

    const exportToCSV = () => {
        const headers = ["Date", "User", "Action", "Resource Type", "Resource ID", "Details"]
        const rows = entries.map(entry => [
            formatTimestamp(entry.created_at),
            entry.user_email || "System",
            entry.action,
            entry.resource_type || "-",
            entry.resource_id || "-",
            entry.details ? JSON.stringify(entry.details) : "-",
        ])

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-semibold text-foreground">Audit Log</h2>
                <p className="text-muted-foreground">
                    View a detailed record of all activities and changes in the system
                </p>
            </div>

            {/* Filters Card */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base">Filter Activity</CardTitle>
                            <CardDescription>
                                Narrow down the audit log by user, action, or date range
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchAuditLog}
                                disabled={isLoading}
                            >
                                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={exportToCSV}
                                disabled={entries.length === 0}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Export
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search by user email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {/* Date Range */}
                        <Select value={dateRange} onValueChange={setDateRange}>
                            <SelectTrigger className="w-40">
                                <Calendar className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Date range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="24hours">Last 24 hours</SelectItem>
                                <SelectItem value="7days">Last 7 days</SelectItem>
                                <SelectItem value="30days">Last 30 days</SelectItem>
                                <SelectItem value="90days">Last 90 days</SelectItem>
                                <SelectItem value="all">All time</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Resource Type Filter */}
                        <Select value={resourceTypeFilter} onValueChange={setResourceTypeFilter}>
                            <SelectTrigger className="w-40">
                                <Filter className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Resource type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All types</SelectItem>
                                {RESOURCE_TYPES.map(type => (
                                    <SelectItem key={type} value={type}>
                                        {type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Results Card */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base">Activity Log</CardTitle>
                            <CardDescription>
                                {isLoading ? "Loading..." : `${total} total entries`}
                            </CardDescription>
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>Page {page + 1} of {totalPages}</span>
                                <div className="flex gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        disabled={page === 0 || isLoading}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={page >= totalPages - 1 || isLoading}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="mt-4 text-sm text-muted-foreground">Loading audit log...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <AlertCircle className="h-12 w-12 text-destructive/50" />
                            <p className="mt-4 text-lg font-medium text-muted-foreground">{error}</p>
                            <Button variant="outline" className="mt-4" onClick={fetchAuditLog}>
                                Try Again
                            </Button>
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <FileText className="h-12 w-12 text-muted-foreground/30" />
                            <p className="mt-4 text-lg font-medium text-muted-foreground">No Activity Found</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Try adjusting your filters or date range
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10"></TableHead>
                                        <TableHead className="w-[180px]">Date</TableHead>
                                        <TableHead className="w-[200px]">User</TableHead>
                                        <TableHead className="w-[200px]">Activity</TableHead>
                                        <TableHead>Resource</TableHead>
                                        <TableHead className="w-[80px] text-center">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {entries.map((entry) => {
                                        const isExpanded = expandedRows.has(entry.id)
                                        // Extract resource name from details - prioritize resourceName, then roomName, roomEmail, templateType, sections
                                        const resourceName = entry.details?.resourceName ||
                                            entry.details?.roomName ||
                                            entry.details?.roomEmail ||
                                            entry.details?.templateType ||
                                            (entry.details?.sections ? `${(entry.details.sections as string[]).join(", ")}` : null) ||
                                            entry.resource_id

                                        return (
                                            <React.Fragment key={entry.id}>
                                                <TableRow
                                                    className="cursor-pointer hover:bg-muted/50"
                                                    onClick={() => toggleRow(entry.id)}
                                                >
                                                    <TableCell>
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                            {isExpanded ? (
                                                                <ChevronDown className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronRight className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">
                                                        {formatTimestamp(entry.created_at)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <User className="h-4 w-4 text-muted-foreground" />
                                                            <span className="text-sm">
                                                                {entry.user_email || "System"}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            {getActionIcon(entry.action)}
                                                            <Badge variant={getActionBadgeVariant(entry.action)}>
                                                                {formatAction(entry.action)}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {entry.resource_type && (
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline">
                                                                    {entry.resource_type}
                                                                </Badge>
                                                                {resourceName && (
                                                                    <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={String(resourceName)}>
                                                                        {String(resourceName)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {getStatusIcon(entry.action)}
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                    <TableRow key={`${entry.id}-details`} className="bg-muted/30">
                                                        <TableCell colSpan={6} className="p-4">
                                                            <div className="space-y-2">
                                                                <h4 className="text-sm font-medium">Details</h4>
                                                                {entry.details ? (
                                                                    <pre className="text-xs bg-background p-3 rounded-md overflow-auto max-h-48">
                                                                        {JSON.stringify(entry.details, null, 2)}
                                                                    </pre>
                                                                ) : (
                                                                    <p className="text-sm text-muted-foreground">
                                                                        No additional details available
                                                                    </p>
                                                                )}
                                                                <div className="flex gap-4 text-xs text-muted-foreground">
                                                                    <span>ID: {entry.id}</span>
                                                                    {entry.user_id && <span>User ID: {entry.user_id}</span>}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
