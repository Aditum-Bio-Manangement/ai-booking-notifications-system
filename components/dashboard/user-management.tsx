"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  RefreshCw,
  Users,
  Download,
  CheckCircle2,
  Loader2,
  Building2,
  Mail,
  Phone,
  CloudDownload,
} from "lucide-react"

interface M365User {
  id: string
  email: string
  name: string
  department?: string
  title?: string
  phone?: string
  avatarUrl?: string
  officeLocation?: string
  microsoftId: string
}

export function UserManagement() {
  const [users, setUsers] = useState<M365User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [search, setSearch] = useState("")
  const [syncStatus, setSyncStatus] = useState<{ success: boolean; message: string } | null>(null)

  const fetchUsers = async () => {
    setIsLoading(true)
    setSyncStatus(null)
    try {
      const response = await fetch("/api/users/sync")
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      } else {
        const error = await response.json()
        setSyncStatus({ success: false, message: error.error || "Failed to fetch users" })
      }
    } catch (error) {
      console.error("Failed to fetch users:", error)
      setSyncStatus({ success: false, message: "Failed to connect to Microsoft Graph" })
    } finally {
      setIsLoading(false)
    }
  }

  const syncSelectedUsers = async () => {
    if (selectedUsers.size === 0) return
    
    setIsSyncing(true)
    setSyncStatus(null)
    try {
      const response = await fetch("/api/users/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedUsers) }),
      })
      
      if (response.ok) {
        const data = await response.json()
        setSyncStatus({ 
          success: true, 
          message: `Successfully synced ${data.syncedCount} users with profile photos` 
        })
        setSelectedUsers(new Set())
      } else {
        const error = await response.json()
        setSyncStatus({ success: false, message: error.error || "Failed to sync users" })
      }
    } catch (error) {
      console.error("Failed to sync users:", error)
      setSyncStatus({ success: false, message: "Failed to sync users" })
    } finally {
      setIsSyncing(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)))
    }
  }

  const toggleUser = (id: string) => {
    const newSet = new Set(selectedUsers)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedUsers(newSet)
  }

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    (user.department?.toLowerCase().includes(search.toLowerCase()))
  )

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">
            Sync user profiles and photos from Microsoft 365
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={fetchUsers} 
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudDownload className="h-4 w-4" />
            )}
            {isLoading ? "Loading..." : "Fetch from M365"}
          </Button>
          <Button 
            onClick={syncSelectedUsers} 
            disabled={selectedUsers.size === 0 || isSyncing}
            className="gap-2"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Sync Selected ({selectedUsers.size})
          </Button>
        </div>
      </div>

      {syncStatus && (
        <div className={`rounded-lg border p-4 ${
          syncStatus.success 
            ? "border-[oklch(0.72_0.19_145)] bg-[oklch(0.72_0.19_145)]/10" 
            : "border-destructive bg-destructive/10"
        }`}>
          <div className="flex items-center gap-2">
            {syncStatus.success ? (
              <CheckCircle2 className="h-5 w-5 text-[oklch(0.72_0.19_145)]" />
            ) : (
              <RefreshCw className="h-5 w-5 text-destructive" />
            )}
            <span className={syncStatus.success ? "text-[oklch(0.72_0.19_145)]" : "text-destructive"}>
              {syncStatus.message}
            </span>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                Microsoft 365 Users
                {users.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{users.length}</Badge>
                )}
              </CardTitle>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <CardDescription>
            {users.length === 0 
              ? "Click 'Fetch from M365' to load users from your Microsoft 365 tenant"
              : "Select users to sync their profile data and photos to your local database"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-lg font-medium">No users loaded</p>
              <p className="text-sm text-muted-foreground">
                Fetch users from Microsoft 365 to get started
              </p>
              <Button onClick={fetchUsers} className="mt-4 gap-2" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudDownload className="h-4 w-4" />
                )}
                Fetch Users
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="hidden md:table-cell">Department</TableHead>
                    <TableHead className="hidden lg:table-cell">Title</TableHead>
                    <TableHead className="hidden sm:table-cell">Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.has(user.id)}
                          onCheckedChange={() => toggleUser(user.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {user.department ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{user.department}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm">{user.title || "-"}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-32">{user.email}</span>
                          </div>
                          {user.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span>{user.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
