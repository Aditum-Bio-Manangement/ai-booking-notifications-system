"use client"

import { useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Filter, Eye, Users, Monitor, MapPin, RefreshCw } from "lucide-react"
import { Skeleton } from "@/components/ui/loaders"
import type { Room, Site } from "@/lib/types"

interface RoomsTableProps {
  rooms: Room[]
  isLoading?: boolean
  onRefresh?: () => void
}

// Skeleton row for table loading
function RoomRowSkeleton() {
  return (
    <TableRow>
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
  const [isRefreshing, setIsRefreshing] = useState(false)

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
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>Room</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="hidden sm:table-cell">Capacity</TableHead>
              <TableHead className="hidden md:table-cell">AV Profile</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <RoomRowSkeleton key={i} />)
            ) : (
              filteredRooms.map((room) => (
              <TableRow key={room.id}>
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
                <TableCell className="text-right">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRoom(room)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>{room.displayName}</DialogTitle>
                        <DialogDescription>{room.roomUpn}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {room.building}, {room.floor}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>Capacity: {room.capacity} people</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Monitor className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <span>{formatAvProfile(room.avProfile)}</span>
                        </div>
                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-sm font-medium text-foreground">Access Notes</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {room.accessNotes}
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
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
    </Card>
  )
}
