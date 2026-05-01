"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/loaders"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import {
    Users,
    Monitor,
    MapPin,
    Mail,
    Calendar,
    Eye,
    Copy,
    Check,
    Terminal,
    Bell,
    UserPlus,
    Clock,
    Building2,
    Loader2,
    ChevronDown,
    ChevronUp,
    GripVertical,
    AlertTriangle,
} from "lucide-react"
import type { Room } from "@/lib/types"

interface RoomDetailSheetProps {
    room: Room | null
    open: boolean
    onOpenChange: (open: boolean) => void
    subscription?: {
        id: string
        expiresAt: string
        status: "active" | "expired"
    }
    autoRenew?: boolean
    onSubscribe?: () => Promise<void>
    onUnsubscribe?: () => Promise<void>
    onAutoRenewChange?: (enabled: boolean) => Promise<void>
}

interface RoomDetails {
    emailAddress: string
    displayName: string
    capacity: number
    building: string
    floorNumber: number
    isHiddenFromGal: boolean
    audioDeviceName?: string
    videoDeviceName?: string
    displayDeviceName?: string
    isWheelChairAccessible?: boolean
    tags?: string[]
    bookingType?: string
}

interface CalendarProcessing {
    automaticRepliesEnabled: boolean
    autoAcceptEnabled: boolean
    allowConflicts: boolean
    bookingWindowInDays: number
    maximumDurationInMinutes: number
    minimumDurationInMinutes: number
    allowRecurringMeetings: boolean
    enforcedCapacity: boolean
}

interface Delegate {
    id: string
    displayName: string
    email: string
    type: "user" | "group"
}

export function RoomDetailSheet({
    room,
    open,
    onOpenChange,
    subscription,
    autoRenew,
    onSubscribe,
    onUnsubscribe,
    onAutoRenewChange,
}: RoomDetailSheetProps) {
    const [activeTab, setActiveTab] = useState("details")
    const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null)
    const [calendarProcessing, setCalendarProcessing] = useState<CalendarProcessing | null>(null)
    const [delegates, setDelegates] = useState<Delegate[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
    const [isUpdating, setIsUpdating] = useState(false)
    const [selectedCommands, setSelectedCommands] = useState<Set<string>>(new Set())
    const [scriptExpanded, setScriptExpanded] = useState(true)
    const [sheetWidth, setSheetWidth] = useState(800)
    const [isResizing, setIsResizing] = useState(false)
    const sheetRef = useRef<HTMLDivElement>(null)
    const { toast } = useToast()
    const { user } = useAuth()

    // Resize handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizing(true)
    }, [])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing) return
        const newWidth = window.innerWidth - e.clientX
        setSheetWidth(Math.min(Math.max(newWidth, 500), window.innerWidth - 100))
    }, [isResizing])

    const handleMouseUp = useCallback(() => {
        setIsResizing(false)
    }, [])

    useEffect(() => {
        if (isResizing) {
            document.addEventListener("mousemove", handleMouseMove)
            document.addEventListener("mouseup", handleMouseUp)
            document.body.style.cursor = "ew-resize"
            document.body.style.userSelect = "none"
        } else {
            document.body.style.cursor = ""
            document.body.style.userSelect = ""
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("mouseup", handleMouseUp)
            document.body.style.cursor = ""
            document.body.style.userSelect = ""
        }
    }, [isResizing, handleMouseMove, handleMouseUp])

    // Helper to log audit events with user info
    const logAuditEvent = async (action: string, resourceType: string, resourceId: string, details?: Record<string, unknown>) => {
        try {
            await fetch("/api/audit-log", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    resource_type: resourceType,
                    resource_id: resourceId,
                    user_id: user?.id || null,
                    user_email: user?.email || null,
                    details,
                }),
            })
        } catch (e) {
            console.error("Failed to log audit event:", e)
        }
    }

    useEffect(() => {
        if (room && open) {
            fetchRoomDetails()
        }
    }, [room, open])

    const fetchRoomDetails = async () => {
        if (!room?.roomUpn) return
        setIsLoading(true)
        try {
            const response = await fetch(`/api/rooms/details?email=${encodeURIComponent(room.roomUpn)}`)
            const data = await response.json()
            if (response.ok) {
                setRoomDetails(data.room)
                setCalendarProcessing(data.calendarProcessing)
                setDelegates(data.delegates || [])
            }
        } catch (e) {
            console.error("Failed to fetch room details:", e)
        } finally {
            setIsLoading(false)
        }
    }

    const copyToClipboard = (text: string, commandId: string) => {
        navigator.clipboard.writeText(text)
        setCopiedCommand(commandId)
        setTimeout(() => setCopiedCommand(null), 2000)
    }

    const handleGalVisibilityChange = async (hidden: boolean) => {
        if (!room) return
        setIsUpdating(true)
        try {
            const response = await fetch("/api/rooms/update", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roomEmail: room.roomUpn,
                    isHiddenFromGal: hidden,
                }),
            })
            if (response.ok) {
                setRoomDetails(prev => {
                    if (!prev) return null
                    return { ...prev, isHiddenFromGal: hidden }
                })
                toast({ title: "Updated", description: `Room is now ${hidden ? "hidden from" : "visible in"} Global Address List` })
                await logAuditEvent("room.gal_visibility_changed", "room", room.id, {
                    roomEmail: room.roomUpn,
                    isHiddenFromGal: hidden
                })
            } else {
                toast({ title: "Error", description: "Failed to update GAL visibility", variant: "destructive" })
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to update room", variant: "destructive" })
        } finally {
            setIsUpdating(false)
        }
    }

    if (!room) return null

    const getTimeRemaining = (expiresAt: string): string => {
        const now = new Date()
        const expires = new Date(expiresAt)
        const diffMs = expires.getTime() - now.getTime()
        if (diffMs <= 0) return "Expired"
        const hours = Math.floor(diffMs / (1000 * 60 * 60))
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
        if (hours > 24) {
            const days = Math.floor(hours / 24)
            return `${days}d ${hours % 24}h`
        }
        return `${hours}h ${minutes}m`
    }

    // PowerShell commands for Exchange management
    const powershellCommands: Record<string, { label: string; command: string; category: string }> = {
        connect: { label: "Connect to Exchange Online", command: `Connect-ExchangeOnline`, category: "connection" },
        getMailbox: { label: "Get Mailbox Info", command: `Get-Mailbox -Identity "${room.roomUpn}" | Format-List`, category: "mailbox" },
        hideFromGal: { label: "Hide from GAL", command: `Set-Mailbox -Identity "${room.roomUpn}" -HiddenFromAddressListsEnabled $true`, category: "mailbox" },
        showInGal: { label: "Show in GAL", command: `Set-Mailbox -Identity "${room.roomUpn}" -HiddenFromAddressListsEnabled $false`, category: "mailbox" },
        getCalendarProcessing: { label: "Get Calendar Processing", command: `Get-CalendarProcessing -Identity "${room.roomUpn}" | Format-List`, category: "calendar" },
        setAutoAccept: { label: "Enable Auto-Accept", command: `Set-CalendarProcessing -Identity "${room.roomUpn}" -AutomateProcessing AutoAccept`, category: "calendar" },
        setAutoDecline: { label: "Enable Auto-Decline", command: `Set-CalendarProcessing -Identity "${room.roomUpn}" -AutomateProcessing AutoDecline`, category: "calendar" },
        allowConflicts: { label: "Allow Conflicts", command: `Set-CalendarProcessing -Identity "${room.roomUpn}" -AllowConflicts $true`, category: "calendar" },
        disallowConflicts: { label: "Disallow Conflicts", command: `Set-CalendarProcessing -Identity "${room.roomUpn}" -AllowConflicts $false`, category: "calendar" },
        setBookingWindow: { label: "Set Booking Window (180 days)", command: `Set-CalendarProcessing -Identity "${room.roomUpn}" -BookingWindowInDays 180`, category: "calendar" },
        setMaxDuration: { label: "Set Max Duration (8 hours)", command: `Set-CalendarProcessing -Identity "${room.roomUpn}" -MaximumDurationInMinutes 480`, category: "calendar" },
        getResourceDelegates: { label: "Get Delegates", command: `Get-CalendarProcessing -Identity "${room.roomUpn}" | Select ResourceDelegates`, category: "delegates" },
        addDelegate: { label: "Add Delegate", command: `Set-CalendarProcessing -Identity "${room.roomUpn}" -ResourceDelegates "user@domain.com"`, category: "delegates" },
        removeDelegate: { label: "Remove All Delegates", command: `Set-CalendarProcessing -Identity "${room.roomUpn}" -ResourceDelegates $null`, category: "delegates" },
        setCapacity: { label: "Set Capacity", command: `Set-Place -Identity "${room.roomUpn}" -Capacity ${room.capacity}`, category: "properties" },
        updateDisplayName: { label: "Update Display Name", command: `Set-Mailbox -Identity "${room.roomUpn}" -DisplayName "New Display Name"`, category: "properties" },
    }

    const toggleCommandSelection = (commandId: string) => {
        setSelectedCommands(prev => {
            const newSet = new Set(prev)
            if (newSet.has(commandId)) {
                newSet.delete(commandId)
            } else {
                newSet.add(commandId)
            }
            return newSet
        })
    }

    const getSelectedScript = (): string => {
        const commands = ["Connect-ExchangeOnline", ""]
        for (const id of selectedCommands) {
            if (id !== "connect" && powershellCommands[id]) {
                commands.push(powershellCommands[id].command)
            }
        }
        return commands.join("\n")
    }

    const copyScript = () => {
        const script = getSelectedScript()
        navigator.clipboard.writeText(script)
        setCopiedCommand("script")
        toast({ title: "Copied", description: "Script copied to clipboard" })
        setTimeout(() => setCopiedCommand(null), 2000)
    }

    const clearSelection = () => {
        setSelectedCommands(new Set())
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                ref={sheetRef}
                style={{ width: sheetWidth }}
                className="flex flex-col h-full max-w-[calc(100vw-100px)] p-0"
            >
                {/* Resize Handle */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-primary/30 active:bg-primary/50 group z-50 flex items-center justify-center transition-colors"
                    onMouseDown={handleMouseDown}
                >
                    <div className="absolute -left-1 w-6 h-full flex items-center justify-center">
                        <div className="h-12 w-1 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50 transition-colors" />
                    </div>
                </div>

                <div className="flex-1 flex flex-col h-full px-6 py-6 overflow-hidden">
                    <SheetHeader className="pb-4 flex-shrink-0">
                        <SheetTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            {room.displayName}
                        </SheetTitle>
                        <SheetDescription className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            {room.roomUpn}
                        </SheetDescription>
                    </SheetHeader>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                        <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
                            <TabsTrigger value="details">Details</TabsTrigger>
                            <TabsTrigger value="processing">Calendar</TabsTrigger>
                            <TabsTrigger value="delegates">Delegates</TabsTrigger>
                            <TabsTrigger value="powershell">PowerShell</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto mt-4 pr-2">
                            {/* Details Tab */}
                            <TabsContent value="details" className="mt-0 space-y-4">
                                {/* Subscription Status Card */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Bell className="h-4 w-4" />
                                            Notification Subscription
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {subscription?.status === "active" ? (
                                            <>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Status</span>
                                                    <Badge className="bg-green-100 text-green-700">Active</Badge>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Time Remaining</span>
                                                    <span className="text-sm font-medium flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {getTimeRemaining(subscription.expiresAt)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Auto-Renew</span>
                                                    <Switch
                                                        checked={autoRenew}
                                                        onCheckedChange={onAutoRenewChange}
                                                    />
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full"
                                                    onClick={onUnsubscribe}
                                                >
                                                    Unsubscribe
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-sm text-muted-foreground">
                                                    This room is not currently subscribed to notifications.
                                                </p>
                                                <Button
                                                    size="sm"
                                                    className="w-full"
                                                    onClick={onSubscribe}
                                                >
                                                    <Bell className="h-4 w-4 mr-2" />
                                                    Subscribe to Notifications
                                                </Button>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Room Information */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm">Room Information</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {isLoading ? (
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-full" />
                                                <Skeleton className="h-4 w-3/4" />
                                                <Skeleton className="h-4 w-1/2" />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                        <MapPin className="h-3 w-3" />
                                                        Location
                                                    </span>
                                                    <span className="text-sm">{room.building}, {room.floor}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                        <Users className="h-3 w-3" />
                                                        Capacity
                                                    </span>
                                                    <span className="text-sm">{room.capacity} people</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                        <Monitor className="h-3 w-3" />
                                                        AV Profile
                                                    </span>
                                                    <span className="text-sm">{room.avProfile || "Standard"}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                        <Eye className="h-3 w-3" />
                                                        GAL Visibility
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm">
                                                            {roomDetails?.isHiddenFromGal ? "Hidden" : "Visible"}
                                                        </span>
                                                        <Switch
                                                            checked={!roomDetails?.isHiddenFromGal}
                                                            onCheckedChange={(checked) => handleGalVisibilityChange(!checked)}
                                                            disabled={isUpdating}
                                                        />
                                                    </div>
                                                </div>
                                                <Separator />
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Site</span>
                                                    <Badge variant="secondary">{room.site}</Badge>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Status</span>
                                                    <Badge className={room.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                                                        {room.isActive ? "Active" : "Inactive"}
                                                    </Badge>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Access Notes */}
                                {room.accessNotes && (
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-sm">Access Notes</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground">{room.accessNotes}</p>
                                        </CardContent>
                                    </Card>
                                )}
                            </TabsContent>

                            {/* Calendar Processing Tab */}
                            <TabsContent value="processing" className="mt-0 space-y-4">
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            Calendar Processing Settings
                                        </CardTitle>
                                        <CardDescription>
                                            These settings control how the room handles booking requests
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {isLoading ? (
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-full" />
                                                <Skeleton className="h-4 w-3/4" />
                                                <Skeleton className="h-4 w-1/2" />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Auto-Accept Meetings</span>
                                                    <Badge variant={calendarProcessing?.autoAcceptEnabled ? "default" : "secondary"}>
                                                        {calendarProcessing?.autoAcceptEnabled ? "Enabled" : "Disabled"}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Allow Conflicts</span>
                                                    <Badge variant={calendarProcessing?.allowConflicts ? "destructive" : "secondary"}>
                                                        {calendarProcessing?.allowConflicts ? "Yes" : "No"}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Booking Window</span>
                                                    <span className="text-sm">{calendarProcessing?.bookingWindowInDays || 180} days</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Max Duration</span>
                                                    <span className="text-sm">{calendarProcessing?.maximumDurationInMinutes || 1440} min</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Allow Recurring</span>
                                                    <Badge variant={calendarProcessing?.allowRecurringMeetings !== false ? "default" : "secondary"}>
                                                        {calendarProcessing?.allowRecurringMeetings !== false ? "Yes" : "No"}
                                                    </Badge>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="border-zinc-700 bg-zinc-900/50">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Terminal className="h-4 w-4" />
                                            Modify via PowerShell
                                        </CardTitle>
                                        <CardDescription>
                                            Calendar processing requires Exchange PowerShell
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <CommandBlock
                                            label="View Current Settings"
                                            command={powershellCommands.getCalendarProcessing.command}
                                            onCopy={copyToClipboard}
                                            copied={copiedCommand === "getCalendarProcessing"}
                                            commandId="getCalendarProcessing"
                                        />
                                        <CommandBlock
                                            label="Enable Auto-Accept"
                                            command={powershellCommands.setAutoAccept.command}
                                            onCopy={copyToClipboard}
                                            copied={copiedCommand === "setAutoAccept"}
                                            commandId="setAutoAccept"
                                        />
                                        <CommandBlock
                                            label="Set Booking Window (180 days)"
                                            command={powershellCommands.setBookingWindow.command}
                                            onCopy={copyToClipboard}
                                            copied={copiedCommand === "setBookingWindow"}
                                            commandId="setBookingWindow"
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Delegates Tab */}
                            <TabsContent value="delegates" className="mt-0 space-y-4">
                                {/* Info Banner */}
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-amber-200">Exchange PowerShell Required</p>
                                            <p className="text-xs text-amber-300/80">
                                                Resource delegates cannot be retrieved or managed through Microsoft Graph API.
                                                Use the PowerShell commands below to view and configure delegates via Exchange Online.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <Card className="border-zinc-700 bg-zinc-900/50">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Terminal className="h-4 w-4" />
                                            Manage Delegates via PowerShell
                                        </CardTitle>
                                        <CardDescription>
                                            Run these commands in Exchange Online PowerShell to manage resource delegates
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <CommandBlock
                                            label="View Current Delegates"
                                            command={powershellCommands.getResourceDelegates.command}
                                            onCopy={copyToClipboard}
                                            copied={copiedCommand === "getResourceDelegates"}
                                            commandId="getResourceDelegates"
                                        />
                                        <CommandBlock
                                            label="Add Delegate"
                                            command={powershellCommands.addDelegate.command}
                                            onCopy={copyToClipboard}
                                            copied={copiedCommand === "addDelegate"}
                                            commandId="addDelegate"
                                        />
                                        <CommandBlock
                                            label="Remove All Delegates"
                                            command={powershellCommands.removeDelegate.command}
                                            onCopy={copyToClipboard}
                                            copied={copiedCommand === "removeDelegate"}
                                            commandId="removeDelegate"
                                        />
                                        <p className="text-xs text-muted-foreground pt-2">
                                            Tip: First connect using <code className="bg-muted px-1 rounded">Connect-ExchangeOnline</code>
                                        </p>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* PowerShell Tab */}
                            <TabsContent value="powershell" className="mt-0 space-y-4 pr-2">
                                {/* Connection Command - Always at top */}
                                <div className="rounded-lg overflow-hidden border border-zinc-700">
                                    <div className="flex items-center justify-between px-3 py-2 bg-zinc-800">
                                        <div className="flex items-center gap-2">
                                            <Terminal className="h-4 w-4 text-zinc-400" />
                                            <span className="text-xs font-medium text-zinc-300">PowerShell</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-zinc-400 hover:text-white hover:bg-zinc-700"
                                            onClick={() => copyToClipboard(powershellCommands.connect.command, "connect")}
                                        >
                                            {copiedCommand === "connect" ? (
                                                <Check className="h-3.5 w-3.5 text-green-500" />
                                            ) : (
                                                <Copy className="h-3.5 w-3.5" />
                                            )}
                                        </Button>
                                    </div>
                                    <div className="bg-zinc-900 p-3 overflow-x-auto">
                                        <code className="text-sm font-mono whitespace-nowrap">
                                            <span className="text-green-400">Connect-ExchangeOnline</span>
                                        </code>
                                    </div>
                                </div>

                                {/* Command Selection */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Terminal className="h-4 w-4" />
                                            Select Commands to Build Script
                                        </CardTitle>
                                        <CardDescription>
                                            Check commands to add them to your script
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {/* Mailbox Commands */}
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-2">MAILBOX SETTINGS</p>
                                            <div className="space-y-2">
                                                {Object.entries(powershellCommands)
                                                    .filter(([, cmd]) => cmd.category === "mailbox")
                                                    .map(([id, cmd]) => (
                                                        <PowerShellCommandRow
                                                            key={id}
                                                            id={id}
                                                            label={cmd.label}
                                                            command={cmd.command}
                                                            isSelected={selectedCommands.has(id)}
                                                            onToggle={toggleCommandSelection}
                                                            onCopy={copyToClipboard}
                                                            copied={copiedCommand === id}
                                                        />
                                                    ))}
                                            </div>
                                        </div>

                                        {/* Calendar Commands */}
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-2">CALENDAR PROCESSING</p>
                                            <div className="space-y-2">
                                                {Object.entries(powershellCommands)
                                                    .filter(([, cmd]) => cmd.category === "calendar")
                                                    .map(([id, cmd]) => (
                                                        <PowerShellCommandRow
                                                            key={id}
                                                            id={id}
                                                            label={cmd.label}
                                                            command={cmd.command}
                                                            isSelected={selectedCommands.has(id)}
                                                            onToggle={toggleCommandSelection}
                                                            onCopy={copyToClipboard}
                                                            copied={copiedCommand === id}
                                                        />
                                                    ))}
                                            </div>
                                        </div>

                                        {/* Delegates Commands */}
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-2">DELEGATES</p>
                                            <div className="space-y-2">
                                                {Object.entries(powershellCommands)
                                                    .filter(([, cmd]) => cmd.category === "delegates")
                                                    .map(([id, cmd]) => (
                                                        <PowerShellCommandRow
                                                            key={id}
                                                            id={id}
                                                            label={cmd.label}
                                                            command={cmd.command}
                                                            isSelected={selectedCommands.has(id)}
                                                            onToggle={toggleCommandSelection}
                                                            onCopy={copyToClipboard}
                                                            copied={copiedCommand === id}
                                                        />
                                                    ))}
                                            </div>
                                        </div>

                                        {/* Properties Commands */}
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-2">ROOM PROPERTIES</p>
                                            <div className="space-y-2">
                                                {Object.entries(powershellCommands)
                                                    .filter(([, cmd]) => cmd.category === "properties")
                                                    .map(([id, cmd]) => (
                                                        <PowerShellCommandRow
                                                            key={id}
                                                            id={id}
                                                            label={cmd.label}
                                                            command={cmd.command}
                                                            isSelected={selectedCommands.has(id)}
                                                            onToggle={toggleCommandSelection}
                                                            onCopy={copyToClipboard}
                                                            copied={copiedCommand === id}
                                                        />
                                                    ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Combined Script Builder */}
                                {selectedCommands.size > 0 && (
                                    <div className="rounded-lg overflow-hidden border border-zinc-700">
                                        <div
                                            className="flex items-center justify-between px-3 py-2 bg-zinc-800 cursor-pointer"
                                            onClick={() => setScriptExpanded(!scriptExpanded)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Terminal className="h-4 w-4 text-zinc-400" />
                                                <span className="text-xs font-medium text-zinc-300">
                                                    Combined Script ({selectedCommands.size} commands)
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 px-2 text-zinc-400 hover:text-white hover:bg-zinc-700"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        clearSelection()
                                                    }}
                                                >
                                                    Clear
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 px-2 text-zinc-400 hover:text-white hover:bg-zinc-700"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        copyScript()
                                                    }}
                                                >
                                                    {copiedCommand === "script" ? (
                                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                                    ) : (
                                                        <Copy className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                                {scriptExpanded ? (
                                                    <ChevronUp className="h-4 w-4 text-zinc-400" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4 text-zinc-400" />
                                                )}
                                            </div>
                                        </div>
                                        {scriptExpanded && (
                                            <ScrollArea className="bg-zinc-900 max-h-64">
                                                <pre className="p-3 text-sm font-mono">
                                                    <code>
                                                        <span className="text-green-400">Connect-ExchangeOnline</span>
                                                        {"\n"}
                                                        {Array.from(selectedCommands).map(id => {
                                                            if (id === "connect" || !powershellCommands[id]) return null
                                                            const cmd = powershellCommands[id].command
                                                            return (
                                                                <span key={id}>
                                                                    {"\n"}
                                                                    <PowerShellSyntax command={cmd} />
                                                                </span>
                                                            )
                                                        })}
                                                    </code>
                                                </pre>
                                            </ScrollArea>
                                        )}
                                    </div>
                                )}
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </SheetContent>
        </Sheet>
    )
}

// PowerShell command row with checkbox for selection
function PowerShellCommandRow({
    id,
    label,
    command,
    isSelected,
    onToggle,
    onCopy,
    copied,
}: {
    id: string
    label: string
    command: string
    isSelected: boolean
    onToggle: (id: string) => void
    onCopy: (text: string, id: string) => void
    copied: boolean
}) {
    return (
        <div className="rounded-lg overflow-hidden border border-zinc-700">
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800">
                <Checkbox
                    id={id}
                    checked={isSelected}
                    onCheckedChange={() => onToggle(id)}
                    className="border-zinc-500 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <label
                    htmlFor={id}
                    className="flex-1 text-xs font-medium text-zinc-300 cursor-pointer"
                >
                    {label}
                </label>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-zinc-400 hover:text-white hover:bg-zinc-700"
                    onClick={() => onCopy(command, id)}
                >
                    {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                        <Copy className="h-3.5 w-3.5" />
                    )}
                </Button>
            </div>
            <div className="bg-zinc-900 p-2 overflow-x-auto scrollbar-thin">
                <pre className="text-xs font-mono whitespace-pre m-0">
                    <code><PowerShellSyntax command={command} /></code>
                </pre>
            </div>
        </div>
    )
}

// Syntax highlighting component for PowerShell commands
function PowerShellSyntax({ command }: { command: string }) {
    // Parse and highlight PowerShell syntax
    const highlightCommand = (cmd: string) => {
        const parts: React.ReactNode[] = []
        let remaining = cmd
        let key = 0

        // Cmdlets (green) - e.g., Get-Mailbox, Set-CalendarProcessing
        const cmdletPattern = /^([A-Z][a-z]+-[A-Za-z]+)/
        // Parameters (red/coral) - e.g., -Identity, -HiddenFromAddressListsEnabled
        const paramPattern = /^(-[A-Za-z]+)/
        // Variables/booleans (blue) - e.g., $true, $false, $null
        const varPattern = /^(\$[a-zA-Z]+)/
        // Strings (yellow/gold) - quoted strings
        const stringPattern = /^("[^"]*")/
        // Pipe operator
        const pipePattern = /^(\s*\|\s*)/
        // Numbers
        const numberPattern = /^(\d+)/
        // Whitespace
        const spacePattern = /^(\s+)/

        while (remaining.length > 0) {
            let match

            if ((match = remaining.match(cmdletPattern))) {
                parts.push(<span key={key++} className="text-green-400">{match[1]}</span>)
                remaining = remaining.slice(match[1].length)
            } else if ((match = remaining.match(paramPattern))) {
                parts.push(<span key={key++} className="text-rose-400">{match[1]}</span>)
                remaining = remaining.slice(match[1].length)
            } else if ((match = remaining.match(varPattern))) {
                parts.push(<span key={key++} className="text-sky-400">{match[1]}</span>)
                remaining = remaining.slice(match[1].length)
            } else if ((match = remaining.match(stringPattern))) {
                parts.push(<span key={key++} className="text-amber-300">{match[1]}</span>)
                remaining = remaining.slice(match[1].length)
            } else if ((match = remaining.match(pipePattern))) {
                parts.push(<span key={key++} className="text-zinc-400">{match[1]}</span>)
                remaining = remaining.slice(match[1].length)
            } else if ((match = remaining.match(numberPattern))) {
                parts.push(<span key={key++} className="text-purple-400">{match[1]}</span>)
                remaining = remaining.slice(match[1].length)
            } else if ((match = remaining.match(spacePattern))) {
                parts.push(<span key={key++}>{match[1]}</span>)
                remaining = remaining.slice(match[1].length)
            } else {
                // Default - just add the character
                parts.push(<span key={key++} className="text-zinc-300">{remaining[0]}</span>)
                remaining = remaining.slice(1)
            }
        }

        return <>{parts}</>
    }

    return highlightCommand(command)
}

// Command block component for PowerShell commands (simple version used in other tabs)
function CommandBlock({
    label,
    command,
    onCopy,
    copied,
    commandId,
}: {
    label: string
    command: string
    onCopy: (text: string, id: string) => void
    copied: boolean
    commandId: string
}) {
    return (
        <div className="rounded-lg overflow-hidden border border-zinc-700">
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-800">
                <span className="text-xs font-medium text-zinc-300">{label}</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-zinc-400 hover:text-white hover:bg-zinc-700"
                    onClick={() => onCopy(command, commandId)}
                >
                    {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                        <Copy className="h-3.5 w-3.5" />
                    )}
                </Button>
            </div>
            <div className="bg-zinc-900 p-2 overflow-x-auto scrollbar-thin">
                <pre className="text-xs font-mono whitespace-pre m-0">
                    <code><PowerShellSyntax command={command} /></code>
                </pre>
            </div>
        </div>
    )
}

