"use client"

import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Search, Filter, Eye, Users, Monitor, RefreshCw, Bell, BellOff, Clock, Loader2, CheckSquare, X } from "lucide-react"
import { Skeleton } from "@/components/ui/loaders"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { RoomDetailSheet } from "./room-detail-sheet"
import type { Room } from "@/lib/types"

interface Subscription {
  id: string
  roomEmail: string
  resource: string
  expiresAt: string
  status: "active" | "expired"
  autoRenew?: boolean
}

interface RoomsTableProps {
  rooms: Room[]
  isLoading?: boolean
  onRefresh?: () => void
}



// Helper to calculate time remaining
function getTimeRemaining(expiresAt: string): string {
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

// Skeleton row for table loading
function RoomRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-4" />
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-12" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-8 w-24 rounded" />
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <Skeleton className="h-5 w-10 rounded-full" />
      </TableCell>
      <TableCell className="text-right">
        <Skeleton className="ml-auto h-8 w-8 rounded" />
      </TableCell>
    </TableRow>
  )
}

export function RoomsTable({ rooms, isLoading = false, onRefresh }: RoomsTableProps) {
  const [search, setSearch] = useState("")
  const [siteFilter, setSiteFilter] = useState<string>("all")
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true)
  const [subscribingRoom, setSubscribingRoom] = useState<string | null>(null)
  const [autoRenewSettings, setAutoRenewSettings] = useState<Record<string, boolean>>({})
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()

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

  // Fetch subscriptions on mount
  useEffect(() => {
    fetchSubscriptions()
  }, [])

  const fetchSubscriptions = async () => {
    try {
      const response = await fetch("/api/subscriptions")
      const data = await response.json()
      setSubscriptions(data.subscriptions || [])
      // Initialize auto-renew settings from localStorage
      const savedAutoRenew = localStorage.getItem("roomAutoRenew")
      if (savedAutoRenew) {
        setAutoRenewSettings(JSON.parse(savedAutoRenew))
      }
    } catch (e) {
      console.error("Failed to fetch subscriptions:", e)
    } finally {
      setLoadingSubscriptions(false)
    }
  }

  const getSubscriptionForRoom = (roomEmail: string): Subscription | undefined => {
    return subscriptions.find(sub => sub.roomEmail === roomEmail)
  }

  const handleSubscribe = async (room: Room) => {
    if (!room.roomUpn) return
    setSubscribingRoom(room.roomUpn)
    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomEmail: room.roomUpn, durationHours: 72 }),
      })
      const data = await response.json()
      if (response.ok) {
        toast({ title: "Subscribed", description: `${room.displayName} is now subscribed to notifications` })
        await logAuditEvent("room.subscribed", "room", room.id, { roomName: room.displayName, roomEmail: room.roomUpn })
        fetchSubscriptions()
      } else {
        toast({ title: "Error", description: data.error || "Failed to subscribe", variant: "destructive" })
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to subscribe room", variant: "destructive" })
    } finally {
      setSubscribingRoom(null)
    }
  }

  const handleUnsubscribe = async (room: Room, subscriptionId: string) => {
    if (!room.roomUpn) return
    setSubscribingRoom(room.roomUpn)
    try {
      const response = await fetch("/api/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId }),
      })
      if (response.ok) {
        toast({ title: "Unsubscribed", description: `${room.displayName} notifications disabled` })
        await logAuditEvent("room.unsubscribed", "room", room.id, { roomName: room.displayName, roomEmail: room.roomUpn })
        fetchSubscriptions()
      } else {
        const data = await response.json()
        toast({ title: "Error", description: data.error || "Failed to unsubscribe", variant: "destructive" })
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to unsubscribe room", variant: "destructive" })
    } finally {
      setSubscribingRoom(null)
    }
  }

  const handleAutoRenewToggle = async (roomEmail: string, enabled: boolean) => {
    const newSettings = { ...autoRenewSettings, [roomEmail]: enabled }
    setAutoRenewSettings(newSettings)
    localStorage.setItem("roomAutoRenew", JSON.stringify(newSettings))
    await logAuditEvent("room.auto_renew_changed", "room", roomEmail, { autoRenew: enabled })
    toast({
      title: enabled ? "Auto-Renew Enabled" : "Auto-Renew Disabled",
      description: `Subscription will ${enabled ? "automatically renew" : "expire without renewal"}`
    })
  }

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      // Add a small delay to show the animation
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  // Filter out any null/undefined rooms first, then apply search and site filters
  const validRooms = Array.isArray(rooms)
    ? rooms.filter((room): room is Room => {
      return room != null &&
        typeof room === 'object' &&
        'id' in room &&
        typeof room.displayName !== 'object' // Ensure displayName is not an object
    })
    : []

  const filteredRooms = validRooms.filter((room) => {
    try {
      const searchLower = search.toLowerCase()
      const displayName = String(room.displayName || "")
      const roomUpn = String(room.roomUpn || "")
      const matchesSearch =
        displayName.toLowerCase().includes(searchLower) ||
        roomUpn.toLowerCase().includes(searchLower)
      const matchesSite = siteFilter === "all" || room.site === siteFilter
      return matchesSearch && matchesSite
    } catch {
      return false
    }
  })

  // Selection handlers
  const toggleRoomSelection = (roomId: string) => {
    setSelectedRoomIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(roomId)) {
        newSet.delete(roomId)
      } else {
        newSet.add(roomId)
      }
      return newSet
    })
  }

  const toggleAllSelection = () => {
    if (selectedRoomIds.size === filteredRooms.length) {
      setSelectedRoomIds(new Set())
    } else {
      setSelectedRoomIds(new Set(filteredRooms.map(r => r.id)))
    }
  }

  const clearSelection = () => {
    setSelectedRoomIds(new Set())
  }

  // Bulk action handlers
  const handleBulkSubscribe = async () => {
    setBulkActionLoading(true)
    const roomsToSubscribe = filteredRooms.filter(r =>
      selectedRoomIds.has(r.id) &&
      !getSubscriptionForRoom(r.roomUpn || "")
    )

    let successCount = 0
    let failCount = 0

    for (const room of roomsToSubscribe) {
      try {
        const response = await fetch("/api/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomEmail: room.roomUpn, durationHours: 72 }),
        })
        if (response.ok) {
          successCount++
          await logAuditEvent("room.subscribed", "room", room.id, {
            roomName: room.displayName,
            roomEmail: room.roomUpn,
            bulkAction: true
          })
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    await fetchSubscriptions()
    setBulkActionLoading(false)
    clearSelection()
    toast({
      title: "Bulk Subscribe Complete",
      description: `${successCount} rooms subscribed, ${failCount} failed`,
    })
  }

  const handleBulkUnsubscribe = async () => {
    setBulkActionLoading(true)
    const roomsToUnsubscribe = filteredRooms.filter(r => {
      const sub = getSubscriptionForRoom(r.roomUpn || "")
      return selectedRoomIds.has(r.id) && sub?.status === "active"
    })

    let successCount = 0
    let failCount = 0

    for (const room of roomsToUnsubscribe) {
      const subscription = getSubscriptionForRoom(room.roomUpn || "")
      if (!subscription) continue

      try {
        const response = await fetch("/api/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptionId: subscription.id }),
        })
        if (response.ok) {
          successCount++
          await logAuditEvent("room.unsubscribed", "room", room.id, {
            roomName: room.displayName,
            roomEmail: room.roomUpn,
            bulkAction: true
          })
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    await fetchSubscriptions()
    setBulkActionLoading(false)
    clearSelection()
    toast({
      title: "Bulk Unsubscribe Complete",
      description: `${successCount} rooms unsubscribed, ${failCount} failed`,
    })
  }

  const handleBulkAutoRenew = async (enabled: boolean) => {
    setBulkActionLoading(true)
    const newSettings = { ...autoRenewSettings }

    for (const roomId of selectedRoomIds) {
      const room = filteredRooms.find(r => r.id === roomId)
      if (room?.roomUpn && getSubscriptionForRoom(room.roomUpn)) {
        newSettings[room.roomUpn] = enabled
        await logAuditEvent("room.auto_renew_changed", "room", roomId, {
          autoRenew: enabled,
          roomEmail: room.roomUpn,
          bulkAction: true
        })
      }
    }

    setAutoRenewSettings(newSettings)
    localStorage.setItem("roomAutoRenew", JSON.stringify(newSettings))
    setBulkActionLoading(false)
    clearSelection()
    toast({
      title: enabled ? "Auto-Renew Enabled" : "Auto-Renew Disabled",
      description: `Updated ${selectedRoomIds.size} rooms`,
    })
  }

  // Room detail sheet handlers
  const openRoomDetails = (room: Room) => {
    setSelectedRoom(room)
    setSheetOpen(true)
  }

  // Helper to safely render avProfile (could be string or object)
  const formatAvProfile = (avProfile: unknown): string => {
    if (typeof avProfile === 'string') return avProfile
    if (typeof avProfile === 'object' && avProfile !== null) {
      const profile = avProfile as Record<string, boolean>
      const features: string[] = []
      if (profile.videoConference) features.push("Video")
      if (profile.audioConference) features.push("Audio")
      if (profile.display) features.push("Display")
      if (profile.whiteboard) features.push("Whiteboard")
      return features.length > 0 ? features.join(", ") : "Standard"
    }
    return "Not specified"
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Room Inventory</CardTitle>
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 w-8"
                title="Refresh rooms"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rooms..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 sm:w-64"
              />
            </div>
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                <SelectItem value="Cambridge">Cambridge</SelectItem>
                <SelectItem value="Oakland">Oakland</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {/* Bulk Actions Toolbar */}
        {selectedRoomIds.size > 0 && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{selectedRoomIds.size} room{selectedRoomIds.size > 1 ? "s" : ""} selected</span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkSubscribe}
                disabled={bulkActionLoading}
              >
                {bulkActionLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Bell className="h-3 w-3 mr-1" />}
                Subscribe All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkUnsubscribe}
                disabled={bulkActionLoading}
              >
                {bulkActionLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <BellOff className="h-3 w-3 mr-1" />}
                Unsubscribe All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAutoRenew(true)}
                disabled={bulkActionLoading}
              >
                Enable Auto-Renew
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAutoRenew(false)}
                disabled={bulkActionLoading}
              >
                Disable Auto-Renew
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        )}

        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedRoomIds.size === filteredRooms.length && filteredRooms.length > 0}
                  onCheckedChange={toggleAllSelection}
                  aria-label="Select all rooms"
                />
              </TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="hidden sm:table-cell">Capacity</TableHead>
              <TableHead className="hidden md:table-cell">AV Profile</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead className="hidden lg:table-cell">Time Left</TableHead>
              <TableHead className="hidden lg:table-cell">Auto-Renew</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <RoomRowSkeleton key={i} />)
            ) : (
              filteredRooms.map((room) => (
                <TableRow key={room.id} className={selectedRoomIds.has(room.id) ? "bg-muted/50" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedRoomIds.has(room.id)}
                      onCheckedChange={() => toggleRoomSelection(room.id)}
                      aria-label={`Select ${room.displayName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{room.displayName || "Unknown Room"}</p>
                      <p className="text-xs text-muted-foreground">{room.roomUpn || "N/A"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        room.site === "Cambridge"
                          ? "bg-[oklch(0.7_0.15_250)]/20 text-[oklch(0.7_0.15_250)]"
                          : "bg-[oklch(0.75_0.15_80)]/20 text-[oklch(0.75_0.15_80)]"
                      }
                    >
                      {room.site || "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span>{room.capacity ?? "N/A"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Monitor className="h-3 w-3 text-muted-foreground" />
                      <span className="max-w-[200px] truncate text-sm">
                        {formatAvProfile(room.avProfile)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={room.isActive ? "default" : "secondary"}
                      className={
                        room.isActive
                          ? "bg-[oklch(0.72_0.19_145)]/20 text-[oklch(0.72_0.19_145)]"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {room.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {/* Subscription Column */}
                  <TableCell>
                    {(() => {
                      const subscription = getSubscriptionForRoom(room.roomUpn || "")
                      const isSubscribing = subscribingRoom === room.roomUpn

                      if (loadingSubscriptions) {
                        return <Skeleton className="h-8 w-24" />
                      }

                      if (subscription && subscription.status === "active") {
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnsubscribe(room, subscription.id)}
                            disabled={isSubscribing}
                            className="gap-1 text-green-600 border-green-200 hover:bg-green-50"
                          >
                            {isSubscribing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Bell className="h-3 w-3" />
                            )}
                            <span className="hidden sm:inline">Subscribed</span>
                          </Button>
                        )
                      }

                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSubscribe(room)}
                          disabled={isSubscribing}
                          className="gap-1"
                        >
                          {isSubscribing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <BellOff className="h-3 w-3" />
                          )}
                          <span className="hidden sm:inline">Subscribe</span>
                        </Button>
                      )
                    })()}
                  </TableCell>
                  {/* Time Left Column */}
                  <TableCell className="hidden lg:table-cell">
                    {(() => {
                      const subscription = getSubscriptionForRoom(room.roomUpn || "")
                      if (!subscription || subscription.status !== "active") {
                        return <span className="text-muted-foreground">-</span>
                      }
                      const timeLeft = getTimeRemaining(subscription.expiresAt)
                      return (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className={timeLeft === "Expired" ? "text-red-500" : "text-foreground"}>
                            {timeLeft}
                          </span>
                        </div>
                      )
                    })()}
                  </TableCell>
                  {/* Auto-Renew Column */}
                  <TableCell className="hidden lg:table-cell">
                    {(() => {
                      const subscription = getSubscriptionForRoom(room.roomUpn || "")
                      if (!subscription || subscription.status !== "active") {
                        return <span className="text-muted-foreground">-</span>
                      }
                      return (
                        <Switch
                          checked={autoRenewSettings[room.roomUpn || ""] ?? false}
                          onCheckedChange={(checked) => handleAutoRenewToggle(room.roomUpn || "", checked)}
                        />
                      )
                    })()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openRoomDetails(room)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {filteredRooms.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            No rooms found matching your criteria.
          </div>
        )}
      </CardContent>

      {/* Room Detail Sheet */}
      <RoomDetailSheet
        room={selectedRoom}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        subscription={selectedRoom ? getSubscriptionForRoom(selectedRoom.roomUpn || "") : undefined}
        autoRenew={selectedRoom ? autoRenewSettings[selectedRoom.roomUpn || ""] : false}
        onSubscribe={async () => {
          if (selectedRoom) await handleSubscribe(selectedRoom)
        }}
        onUnsubscribe={async () => {
          if (selectedRoom) {
            const sub = getSubscriptionForRoom(selectedRoom.roomUpn || "")
            if (sub) await handleUnsubscribe(selectedRoom, sub.id)
          }
        }}
        onAutoRenewChange={async (enabled) => {
          if (selectedRoom?.roomUpn) {
            await handleAutoRenewToggle(selectedRoom.roomUpn, enabled)
          }
        }}
      />
    </Card>
  )
}
