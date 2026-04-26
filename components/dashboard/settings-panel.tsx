"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Trash2,
  AlertTriangle,
  Settings,
  Bell,
  Shield,
  Database,
  Save,
  Users,
  Key,
  Mail,
  Eye,
  EyeOff,
  Send,
  TestTube,
  Pencil,
  Clock,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { defaultTestVariables } from "@/lib/email-types"
import { FieldGroup, Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import useSWR from "swr"
import { UserManagement } from "./user-management"
import { useTimezone } from "@/lib/timezone-context"
import { MigrateSettingsButton } from "./migrate-settings-button"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface Subscription {
  id: string
  roomEmail: string
  resource: string
  expiresAt: string
  status: "active" | "expired"
}

interface SystemSettings {
  notifications: {
    serviceMailbox: string
    customNotificationsEnabled: boolean
    suppressExchangeNotifications: boolean
    sendAcceptanceNotifications: boolean
    sendDeclineNotifications: boolean
    includeAlternativeSuggestions: boolean
    includeAVGuidance: boolean
    ccExecutiveAssistants: boolean
  }
  general: {
    webhookUrl: string
    logoUrl: string
    supportEmail: string
    debugLogging: boolean
    retryFailedNotifications: boolean
    maxRetryAttempts: number
  }
  roomPolicies: {
    allowConflicts: boolean
    conflictThreshold: number
    autoDeclineOutsideHours: boolean
    businessHoursStart: string
    businessHoursEnd: string
  }
  smtp: {
    host: string
    port: string
    user: string
    pass: string
    from: string
  }
  sso: {
    enabled: boolean
    provider: 'microsoft' | 'none'
    clientId: string
    clientSecret: string
    tenantId: string
    allowedDomains: string
  }
}

interface AppUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'operator' | 'viewer'
  status: 'active' | 'invited' | 'disabled'
  lastLogin?: string
}

const SETTINGS_STORAGE_KEY = "system-settings"

const defaultSettings: SystemSettings = {
  notifications: {
    serviceMailbox: "room-notifications@aditumbio.com",
    customNotificationsEnabled: false,
    suppressExchangeNotifications: false,
    sendAcceptanceNotifications: true,
    sendDeclineNotifications: true,
    includeAlternativeSuggestions: true,
    includeAVGuidance: true,
    ccExecutiveAssistants: false,
  },
  general: {
    webhookUrl: "",
    logoUrl: "/images/aditum-logo-horizontal.png",
    supportEmail: "facilities@aditumbio.com",
    debugLogging: false,
    retryFailedNotifications: true,
    maxRetryAttempts: 3,
  },
  roomPolicies: {
    allowConflicts: false,
    conflictThreshold: 0,
    autoDeclineOutsideHours: false,
    businessHoursStart: "08:00",
    businessHoursEnd: "18:00",
  },
  smtp: {
    host: "",
    port: "587",
    user: "",
    pass: "",
    from: "",
  },
  sso: {
    enabled: false,
    provider: 'none',
    clientId: "",
    clientSecret: "",
    tenantId: "",
    allowedDomains: "aditumbio.com",
  },
}

const mockUsers: AppUser[] = [
  { id: "1", email: "admin@aditumbio.com", name: "Admin User", role: "admin", status: "active", lastLogin: "2026-03-27T10:00:00Z" },
  { id: "2", email: "operator@aditumbio.com", name: "Room Operator", role: "operator", status: "active", lastLogin: "2026-03-26T14:30:00Z" },
  { id: "3", email: "viewer@aditumbio.com", name: "View Only", role: "viewer", status: "active" },
]

function WebhookStatusCard() {
  const { data: webhookStatus } = useSWR<{
    webhookUrl: string
    isConfigured: boolean
    isPublicUrl: boolean
    hasNotificationMailbox: boolean
    notificationMailbox: string | null
    issues: string[]
  }>("/api/webhooks/status", (url: string) => fetch(url).then(r => r.json()))

  if (!webhookStatus) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Webhook Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading webhook status...</div>
        </CardContent>
      </Card>
    )
  }

  const hasIssues = webhookStatus.issues.length > 0

  return (
    <Card className={`mb-4 ${hasIssues ? "border-warning/50" : "border-success/50"}`}>
      <CardHeader>
        <div className="flex items-center gap-2">
          {hasIssues ? (
            <AlertTriangle className="h-5 w-5 text-warning" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-success" />
          )}
          <CardTitle className="text-base">Webhook Configuration</CardTitle>
        </div>
        <CardDescription>
          {hasIssues
            ? "There are issues with your webhook configuration that may prevent notifications from working"
            : "Webhook is properly configured to receive Microsoft Graph notifications"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Webhook URL</p>
          <code className="text-sm break-all">{webhookStatus.webhookUrl}</code>
        </div>

        {webhookStatus.hasNotificationMailbox && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Notification Mailbox</p>
            <code className="text-sm">{webhookStatus.notificationMailbox}</code>
          </div>
        )}

        {hasIssues && (
          <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
            <p className="text-sm font-medium text-warning mb-2">Configuration Issues:</p>
            <ul className="text-sm text-foreground space-y-1">
              {webhookStatus.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-warning mt-0.5">•</span>
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p><strong>Note:</strong> For webhooks to work, you must:</p>
          <ol className="list-decimal ml-4 mt-1 space-y-1">
            <li>Set the WEBHOOK_URL environment variable to your public HTTPS URL</li>
            <li>Set NOTIFICATION_MAILBOX to the email address that will send notifications</li>
            <li>Ensure the app is deployed to a stable, publicly accessible URL</li>
            <li>Create subscriptions for each room you want to monitor</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}

function TimezoneSettings() {
  const { timezone, setTimezone, timezones, getTimezoneAbbreviation } = useTimezone()

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Display Timezone</FieldLabel>
        <FieldDescription>
          All event times in the dashboard will be displayed in this timezone.
          Currently showing: {getTimezoneAbbreviation()}
        </FieldDescription>
        <Select value={timezone} onValueChange={(value) => setTimezone(value as typeof timezone)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {timezones.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  )
}

export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState("subscriptions")
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle")
  const [hasChanges, setHasChanges] = useState(false)

  const { data: subsData, mutate: mutateSubscriptions } = useSWR<{ subscriptions: Subscription[]; configured: boolean }>(
    "/api/subscriptions",
    fetcher
  )
  const { data: roomsData } = useSWR<{ rooms: Array<{ email: string; name: string }>; configured: boolean }>(
    "/api/rooms",
    fetcher
  )

  const [isCreating, setIsCreating] = useState(false)
  const [newRoomEmail, setNewRoomEmail] = useState("")
  const [subscriptionDuration, setSubscriptionDuration] = useState(72) // Default 72 hours (3 days)
  const [editingSubscription, setEditingSubscription] = useState<{ id: string; roomEmail: string; expiresIn: number } | null>(null)
  const [renewDuration, setRenewDuration] = useState(72)

  // User management state
  const [users, setUsers] = useState<AppUser[]>(mockUsers)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState<{ email: string; name: string; role: AppUser["role"] }>({ email: "", name: "", role: "viewer" })

  // SMTP test state
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [testEmailTo, setTestEmailTo] = useState("")
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [testEmailStatus, setTestEmailStatus] = useState<"idle" | "success" | "error">("idle")

  // Suppress Exchange notifications state
  const [isUpdatingSuppression, setIsUpdatingSuppression] = useState(false)
  const [suppressionStatus, setSuppressionStatus] = useState<{ type: "idle" | "success" | "error"; message?: string }>({ type: "idle" })

  // Test variables state
  const [testVariables, setTestVariables] = useState(defaultTestVariables)

  // Load settings from database first, fallback to localStorage
  useEffect(() => {
    async function loadSettings() {
      try {
        // Try to load from database first
        const response = await fetch("/api/settings")
        if (response.ok) {
          const data = await response.json()
          if (data.settings && Object.keys(data.settings).length > 0) {
            // Merge database settings with defaults - using type assertion for dynamic keys
            const mergedSettings = { ...defaultSettings }
            const settingsData = data.settings as Record<string, unknown>

            if (settingsData.notifications) {
              mergedSettings.notifications = { ...mergedSettings.notifications, ...(settingsData.notifications as typeof mergedSettings.notifications) }
            }
            if (settingsData.general) {
              mergedSettings.general = { ...mergedSettings.general, ...(settingsData.general as typeof mergedSettings.general) }
            }
            if (settingsData.smtp) {
              mergedSettings.smtp = { ...mergedSettings.smtp, ...(settingsData.smtp as typeof mergedSettings.smtp) }
            }
            if (settingsData.sso) {
              mergedSettings.sso = { ...mergedSettings.sso, ...(settingsData.sso as typeof mergedSettings.sso) }
            }
            if (settingsData.roomPolicies) {
              mergedSettings.roomPolicies = { ...mergedSettings.roomPolicies, ...(settingsData.roomPolicies as typeof mergedSettings.roomPolicies) }
            }

            setSettings(mergedSettings)
            // Sync to localStorage for offline access
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(mergedSettings))
            return
          }
        }
      } catch (e) {
        console.error("Failed to load settings from database:", e)
      }

      // Fallback to localStorage
      try {
        const saved = localStorage.getItem(SETTINGS_STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          setSettings({ ...defaultSettings, ...parsed })
        }
      } catch (e) {
        console.error("Failed to load settings from localStorage:", e)
      }
    }

    loadSettings()
  }, [])

  // Update settings helper
  const updateSettings = <K extends keyof SystemSettings>(
    section: K,
    key: keyof SystemSettings[K],
    value: SystemSettings[K][keyof SystemSettings[K]]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }))
    setHasChanges(true)
  }

  // Handle suppress Exchange notifications toggle
  const handleSuppressToggle = async (checked: boolean) => {
    setIsUpdatingSuppression(true)
    setSuppressionStatus({ type: "idle" })

    // Update local state immediately for responsive UI
    updateSettings("notifications", "suppressExchangeNotifications", checked)

    try {
      const response = await fetch("/api/rooms/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suppressDefaultNotifications: checked }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update room settings")
      }

      setSuppressionStatus({
        type: "success",
        message: data.message + (data.note ? ` ${data.note}` : "")
      })

      // Clear success message after 5 seconds
      setTimeout(() => setSuppressionStatus({ type: "idle" }), 5000)

    } catch (error) {
      console.error("Failed to update suppress setting:", error)
      setSuppressionStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to update room settings"
      })

      // Revert local state on error
      updateSettings("notifications", "suppressExchangeNotifications", !checked)
    } finally {
      setIsUpdatingSuppression(false)
    }
  }

  // Save all settings
  const handleSaveSettings = async () => {
    setIsSaving(true)
    setSaveStatus("idle")

    try {
      // Save to localStorage for quick loading
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))

      // Save to database via API
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save settings")
      }

      console.log("[SETTINGS] Settings saved to database successfully")
      setSaveStatus("success")
      setHasChanges(false)
      setTimeout(() => setSaveStatus("idle"), 3000)
    } catch (error) {
      console.error("Failed to save settings:", error)
      setSaveStatus("error")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateSubscription = async () => {
    if (!newRoomEmail) return
    setIsCreating(true)

    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomEmail: newRoomEmail, durationHours: subscriptionDuration }),
      })
      const data = await response.json()

      if (!response.ok) {
        console.error("Failed to create subscription:", data.error || data.message)
        alert(`Failed to create subscription: ${data.error || data.message}`)
        return
      }

      // Force refresh the subscriptions list
      await mutateSubscriptions()
      setNewRoomEmail("")
    } catch (error) {
      console.error("Failed to create subscription:", error)
      alert("Failed to create subscription. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleRenewSubscription = async (subscriptionId: string, durationHours?: number) => {
    try {
      await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId, durationHours: durationHours || 72 }),
      })
      mutateSubscriptions()
      setEditingSubscription(null)
    } catch (error) {
      console.error("Failed to renew subscription:", error)
    }
  }

  const handleDeleteSubscription = async (subscriptionId: string) => {
    try {
      await fetch("/api/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId }),
      })
      mutateSubscriptions()
    } catch (error) {
      console.error("Failed to delete subscription:", error)
    }
  }

  const isConfigured = subsData?.configured !== false

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">System Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure Microsoft Graph subscriptions, notifications, and system preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="border-warning text-warning">
              Unsaved changes
            </Badge>
          )}
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving || !hasChanges}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
          {saveStatus === "success" && (
            <Badge variant="outline" className="border-[oklch(0.72_0.19_145)] text-[oklch(0.72_0.19_145)] gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Saved
            </Badge>
          )}
        </div>
      </div>

      {!isConfigured && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <div>
              <p className="font-medium text-foreground">Microsoft Graph Not Configured</p>
              <p className="text-sm text-muted-foreground">
                Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID environment variables to connect.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-max md:w-auto md:flex-wrap">
            <TabsTrigger value="subscriptions" className="gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Subscriptions</span>
              <span className="sm:hidden">Subs</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
              <span className="sm:hidden">Notify</span>
            </TabsTrigger>
            <TabsTrigger value="policies" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Room Policies</span>
              <span className="sm:hidden">Policies</span>
            </TabsTrigger>
            <TabsTrigger value="smtp" className="gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email/SMTP</span>
              <span className="sm:hidden">Email</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="sso" className="gap-2">
              <Key className="h-4 w-4" />
              SSO
            </TabsTrigger>
            <TabsTrigger value="general" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
              <span className="sm:hidden">Gen</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="subscriptions" className="mt-6">
          <div className="flex flex-col gap-6">
            {/* Create Subscription */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create Subscription</CardTitle>
                <CardDescription>
                  Subscribe to calendar change notifications for a room mailbox
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Input
                        placeholder="room@aditumbio.com"
                        value={newRoomEmail}
                        onChange={(e) => setNewRoomEmail(e.target.value)}
                        list="room-emails"
                      />
                      <datalist id="room-emails">
                        {Array.isArray(roomsData?.rooms) && roomsData.rooms.map((room, index) => (
                          <option key={`room-option-${index}-${room?.email || ''}`} value={room?.email || ''}>
                            {room?.name || 'Unknown'}
                          </option>
                        ))}
                      </datalist>
                    </div>
                    <Select value={String(subscriptionDuration)} onValueChange={(v) => setSubscriptionDuration(Number(v))}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">24 hours</SelectItem>
                        <SelectItem value="48">48 hours</SelectItem>
                        <SelectItem value="72">72 hours (max)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleCreateSubscription}
                      disabled={isCreating || !newRoomEmail}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      {isCreating ? "Creating..." : "Create"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Microsoft Graph subscriptions expire after a maximum of ~70 hours. Set the duration and renew before expiration.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Active Subscriptions */}
            <WebhookStatusCard />

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Active Subscriptions</CardTitle>
                    <CardDescription>
                      Microsoft Graph webhook subscriptions for room calendars
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => mutateSubscriptions()} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!subsData?.subscriptions?.length ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No active subscriptions. Create one to start receiving notifications.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {subsData.subscriptions.map((sub, index) => {
                      const expiresAtTime = sub.expiresAt ? new Date(sub.expiresAt).getTime() : 0
                      const isValidDate = !isNaN(expiresAtTime) && expiresAtTime > 0
                      const expiresAt = isValidDate ? new Date(sub.expiresAt) : new Date()
                      const isExpired = isValidDate ? expiresAt < new Date() : true
                      const expiresIn = isValidDate ? Math.max(0, Math.floor((expiresAtTime - Date.now()) / (1000 * 60 * 60))) : 0

                      return (
                        <div
                          key={sub.id || `subscription-${index}`}
                          className="flex items-center justify-between rounded-lg border p-4"
                        >
                          <div className="flex items-center gap-3">
                            {isExpired ? (
                              <XCircle className="h-5 w-5 text-destructive" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5 text-[oklch(0.72_0.19_145)]" />
                            )}
                            <div>
                              <p className="font-medium text-foreground">{sub.roomEmail}</p>
                              <p className="text-xs text-muted-foreground">
                                {isExpired
                                  ? "Expired"
                                  : `Expires in ${expiresIn} hours`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={isExpired ? "destructive" : "outline"}>
                              {isExpired ? "Expired" : "Active"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingSubscription({ id: sub.id, roomEmail: sub.roomEmail, expiresIn })
                                setRenewDuration(72)
                              }}
                              title="Edit/Extend subscription"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRenewSubscription(sub.id)}
                              title="Quick renew (72h)"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSubscription(sub.id)}
                              className="text-destructive hover:text-destructive"
                              title="Delete subscription"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edit Subscription Dialog */}
            <Dialog open={!!editingSubscription} onOpenChange={(open) => !open && setEditingSubscription(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Edit Subscription Duration
                  </DialogTitle>
                  <DialogDescription>
                    Set the duration for renewing the subscription for {editingSubscription?.roomEmail}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Subscription Duration</FieldLabel>
                      <Select value={String(renewDuration)} onValueChange={(v) => setRenewDuration(Number(v))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12">12 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                          <SelectItem value="48">48 hours</SelectItem>
                          <SelectItem value="72">72 hours (maximum)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Current status: {editingSubscription?.expiresIn ? `Expires in ${editingSubscription.expiresIn} hours` : "Unknown"}
                      </p>
                    </Field>
                  </FieldGroup>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingSubscription(null)}>
                    Cancel
                  </Button>
                  <Button onClick={() => editingSubscription && handleRenewSubscription(editingSubscription.id, renewDuration)}>
                    Renew Subscription
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification System</CardTitle>
              <CardDescription>
                Enable custom branded notifications and disable default Exchange responses
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {/* Master Enable Switch */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <FieldGroup>
                  <Field className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <FieldLabel className="text-base font-semibold">Enable Custom Notifications</FieldLabel>
                      <FieldDescription>
                        Turn on this system to send branded email notifications instead of default Exchange responses.
                        When enabled, organizers will receive your custom-designed emails for booking confirmations and declines.
                      </FieldDescription>
                    </div>
                    <div className="shrink-0">
                      <Switch
                        checked={settings.notifications.customNotificationsEnabled}
                        onCheckedChange={(checked) => updateSettings("notifications", "customNotificationsEnabled", checked)}
                      />
                    </div>
                  </Field>
                </FieldGroup>
              </div>

              {/* Suppress Exchange Notifications */}
              <FieldGroup>
                <Field className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <FieldLabel>Suppress Default Exchange Notifications</FieldLabel>
                      <FieldDescription>
                        When enabled, Exchange will not send the standard "Your request was accepted/declined" emails.
                        Only your custom branded notifications will be sent to organizers.
                      </FieldDescription>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {isUpdatingSuppression && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      )}
                      <Switch
                        checked={settings.notifications.suppressExchangeNotifications}
                        disabled={isUpdatingSuppression}
                        onCheckedChange={handleSuppressToggle}
                      />
                    </div>
                  </div>

                  {suppressionStatus.type !== "idle" && (
                    <div className={`p-3 rounded-lg text-sm ${suppressionStatus.type === "success"
                        ? "bg-success/10 border border-success/30 text-success"
                        : "bg-destructive/10 border border-destructive/30 text-destructive"
                      }`}>
                      {suppressionStatus.message}
                    </div>
                  )}

                  {settings.notifications.suppressExchangeNotifications && (
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-4">
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                          PowerShell Required for Full Suppression
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                          The Graph API cannot suppress Exchange&apos;s calendar accept/decline emails.
                          You must run these PowerShell commands in Exchange Online PowerShell to fully suppress them:
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                          Step 1: Connect to Exchange Online
                        </p>
                        <code className="block p-2 bg-amber-100 dark:bg-amber-900/50 rounded text-xs font-mono text-amber-900 dark:text-amber-100 overflow-x-auto">
                          Connect-ExchangeOnline -UserPrincipalName admin@yourdomain.com
                        </code>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                          Step 2: Suppress accept/decline emails for all room mailboxes
                        </p>
                        <code className="block p-2 bg-amber-100 dark:bg-amber-900/50 rounded text-xs font-mono text-amber-900 dark:text-amber-100 overflow-x-auto whitespace-pre-wrap">
                          {`Get-Mailbox -RecipientTypeDetails RoomMailbox | ForEach-Object {
  Set-CalendarProcessing -Identity $_.Identity -AddAdditionalResponse $false -DeleteComments $true -AddOrganizerToSubject $false -DeleteSubject $false
}`}
                        </code>
                      </div>

                      <div className="pt-2 border-t border-amber-200 dark:border-amber-700">
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                          Important Note
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Exchange will still send a basic calendar acceptance/decline notification as this is built into
                          the calendar processing system. The commands above minimize the email content. To completely
                          eliminate duplicate emails, organizers can create an Outlook rule to auto-delete emails from
                          room mailboxes, or you can set rooms to not auto-process: <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">Set-CalendarProcessing -AutomateProcessing None</code> (but then rooms won&apos;t auto-accept bookings).
                        </p>
                      </div>
                    </div>
                  )}

                  {!settings.notifications.suppressExchangeNotifications && (
                    <div className="p-3 rounded-lg bg-muted/50 border border-muted text-xs text-muted-foreground">
                      <strong>Current behavior:</strong> Exchange will send standard accept/decline emails.
                      Automatic reply messages ("Your room booking request has been processed") are always disabled.
                    </div>
                  )}
                </Field>
              </FieldGroup>

              <div className="border-t pt-6">
                <h4 className="mb-4 font-medium text-foreground">Email Configuration</h4>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Service Mailbox</FieldLabel>
                    <FieldDescription>
                      Email address used to send notifications (requires Mail.Send permission)
                    </FieldDescription>
                    <Input
                      placeholder="room-notifications@aditumbio.com"
                      value={settings.notifications.serviceMailbox}
                      onChange={(e) => updateSettings("notifications", "serviceMailbox", e.target.value)}
                    />
                  </Field>
                </FieldGroup>
              </div>

              <div className="border-t pt-6">
                <h4 className="mb-4 font-medium text-foreground">Notification Types</h4>
                <FieldGroup>
                  <Field className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <FieldLabel>Send Acceptance Notifications</FieldLabel>
                      <FieldDescription>
                        Email organizers when their room booking is confirmed
                      </FieldDescription>
                    </div>
                    <div className="shrink-0">
                      <Switch
                        checked={settings.notifications.sendAcceptanceNotifications}
                        onCheckedChange={(checked) => updateSettings("notifications", "sendAcceptanceNotifications", checked)}
                      />
                    </div>
                  </Field>
                </FieldGroup>

                <FieldGroup>
                  <Field className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <FieldLabel>Send Decline Notifications</FieldLabel>
                      <FieldDescription>
                        Email organizers when their room booking is declined
                      </FieldDescription>
                    </div>
                    <div className="shrink-0">
                      <Switch
                        checked={settings.notifications.sendDeclineNotifications}
                        onCheckedChange={(checked) => updateSettings("notifications", "sendDeclineNotifications", checked)}
                      />
                    </div>
                  </Field>
                </FieldGroup>

                <FieldGroup>
                  <Field className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <FieldLabel>Include Alternative Suggestions</FieldLabel>
                      <FieldDescription>
                        Include AI-suggested alternative rooms in decline notifications
                      </FieldDescription>
                    </div>
                    <div className="shrink-0">
                      <Switch
                        checked={settings.notifications.includeAlternativeSuggestions}
                        onCheckedChange={(checked) => updateSettings("notifications", "includeAlternativeSuggestions", checked)}
                      />
                    </div>
                  </Field>
                </FieldGroup>

                <FieldGroup>
                  <Field className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <FieldLabel>Include AV Guidance</FieldLabel>
                      <FieldDescription>
                        Add room-specific AV setup instructions to acceptance emails
                      </FieldDescription>
                    </div>
                    <div className="shrink-0">
                      <Switch
                        checked={settings.notifications.includeAVGuidance}
                        onCheckedChange={(checked) => updateSettings("notifications", "includeAVGuidance", checked)}
                      />
                    </div>
                  </Field>
                </FieldGroup>

                <FieldGroup>
                  <Field className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <FieldLabel>CC Executive Assistants</FieldLabel>
                      <FieldDescription>
                        Copy executive assistants on booking notifications
                      </FieldDescription>
                    </div>
                    <div className="shrink-0">
                      <Switch
                        checked={settings.notifications.ccExecutiveAssistants}
                        onCheckedChange={(checked) => updateSettings("notifications", "ccExecutiveAssistants", checked)}
                      />
                    </div>
                  </Field>
                </FieldGroup>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Room Booking Policies</CardTitle>
              <CardDescription>
                Configure Exchange room mailbox policies - these enforce no double booking
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="rounded-lg border border-warning bg-warning/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Exchange is the System of Record</p>
                    <p className="text-sm text-muted-foreground">
                      Room booking acceptance/decline decisions are made by Exchange Online. These settings reflect
                      the Exchange room mailbox configuration. Changes here require corresponding PowerShell
                      commands to take effect in Exchange.
                    </p>
                  </div>
                </div>
              </div>

              <FieldGroup>
                <Field className="flex items-center justify-between">
                  <div>
                    <FieldLabel>Allow Conflicts (AllowConflicts)</FieldLabel>
                    <FieldDescription>
                      Must remain FALSE to prevent double booking. Exchange auto-declines conflicting requests.
                    </FieldDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.roomPolicies.allowConflicts}
                      onCheckedChange={(checked) => updateSettings("roomPolicies", "allowConflicts", checked)}
                      disabled
                    />
                    <Badge variant="secondary">Locked</Badge>
                  </div>
                </Field>
              </FieldGroup>

              <FieldGroup>
                <Field>
                  <FieldLabel>Conflict Threshold (Minutes)</FieldLabel>
                  <FieldDescription>
                    ConflictPercentageAllowed must remain 0 to enforce strict conflict rejection
                  </FieldDescription>
                  <Input
                    type="number"
                    value={settings.roomPolicies.conflictThreshold}
                    onChange={(e) => updateSettings("roomPolicies", "conflictThreshold", parseInt(e.target.value) || 0)}
                    disabled
                  />
                </Field>
              </FieldGroup>

              <FieldGroup>
                <Field className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <FieldLabel>Auto-Decline Outside Business Hours</FieldLabel>
                    <FieldDescription>
                      Automatically decline booking requests outside of business hours
                    </FieldDescription>
                  </div>
                  <div className="shrink-0">
                    <Switch
                      checked={settings.roomPolicies.autoDeclineOutsideHours}
                      onCheckedChange={(checked) => updateSettings("roomPolicies", "autoDeclineOutsideHours", checked)}
                    />
                  </div>
                </Field>
              </FieldGroup>

              {settings.roomPolicies.autoDeclineOutsideHours && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Business Hours Start</FieldLabel>
                      <Input
                        type="time"
                        value={settings.roomPolicies.businessHoursStart}
                        onChange={(e) => updateSettings("roomPolicies", "businessHoursStart", e.target.value)}
                      />
                    </Field>
                  </FieldGroup>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Business Hours End</FieldLabel>
                      <Input
                        type="time"
                        value={settings.roomPolicies.businessHoursEnd}
                        onChange={(e) => updateSettings("roomPolicies", "businessHoursEnd", e.target.value)}
                      />
                    </Field>
                  </FieldGroup>
                </div>
              )}

              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="font-medium text-foreground">PowerShell Commands</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  To update Exchange room mailbox settings, run these commands:
                </p>
                <pre className="mt-3 overflow-auto rounded bg-background p-3 text-xs font-mono">
                  {`# Ensure no double booking
Set-CalendarProcessing -Identity "room@aditumbio.com" \\
  -AllowConflicts $false \\
  -ConflictPercentageAllowed 0 \\
  -MaximumConflictInstances 0`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">General Settings</CardTitle>
                <CardDescription>
                  Configure general application preferences
                </CardDescription>
              </div>
              <MigrateSettingsButton />
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <TimezoneSettings />

              <FieldGroup>
                <Field>
                  <FieldLabel>Webhook URL</FieldLabel>
                  <FieldDescription>
                    Endpoint for Microsoft Graph change notifications. This is automatically set based on your deployment URL.
                  </FieldDescription>
                  <Input
                    placeholder="https://your-domain.com/api/webhooks/graph"
                    value={settings.general.webhookUrl || (typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/graph` : '')}
                    onChange={(e) => updateSettings("general", "webhookUrl", e.target.value)}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Your webhook endpoint is: <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/graph` : '/api/webhooks/graph'}</code>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This URL must be publicly accessible for Microsoft Graph to send notifications. Use your Vercel deployment URL (e.g., https://your-app.vercel.app/api/webhooks/graph).
                  </p>
                </Field>
              </FieldGroup>

              <FieldGroup>
                <Field>
                  <FieldLabel>Logo URL</FieldLabel>
                  <FieldDescription>
                    URL to your company logo for email templates
                  </FieldDescription>
                  <Input
                    placeholder="/images/aditum-logo-horizontal.png"
                    value={settings.general.logoUrl}
                    onChange={(e) => updateSettings("general", "logoUrl", e.target.value)}
                  />
                </Field>
              </FieldGroup>

              <FieldGroup>
                <Field>
                  <FieldLabel>Support Email</FieldLabel>
                  <FieldDescription>
                    Email address shown in notification emails for support requests
                  </FieldDescription>
                  <Input
                    placeholder="facilities@aditumbio.com"
                    value={settings.general.supportEmail}
                    onChange={(e) => updateSettings("general", "supportEmail", e.target.value)}
                  />
                </Field>
              </FieldGroup>

              <FieldGroup>
                <Field className="flex items-center justify-between">
                  <div className="flex-1">
                    <FieldLabel>Retry Failed Notifications</FieldLabel>
                    <FieldDescription>
                      Automatically retry sending failed email notifications
                    </FieldDescription>
                  </div>
                  <div className="shrink-0">
                    <Switch
                      checked={settings.general.retryFailedNotifications}
                      onCheckedChange={(checked) => updateSettings("general", "retryFailedNotifications", checked)}
                    />
                  </div>
                </Field>
              </FieldGroup>

              {settings.general.retryFailedNotifications && (
                <FieldGroup>
                  <Field>
                    <FieldLabel>Max Retry Attempts</FieldLabel>
                    <FieldDescription>
                      Maximum number of retry attempts for failed notifications
                    </FieldDescription>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={settings.general.maxRetryAttempts}
                      onChange={(e) => updateSettings("general", "maxRetryAttempts", parseInt(e.target.value) || 3)}
                    />
                  </Field>
                </FieldGroup>
              )}

              <FieldGroup>
                <Field className="flex items-center justify-between">
                  <div className="flex-1">
                    <FieldLabel>Enable Debug Logging</FieldLabel>
                    <FieldDescription>
                      Log detailed information for troubleshooting
                    </FieldDescription>
                  </div>
                  <div className="shrink-0">
                    <Switch
                      checked={settings.general.debugLogging}
                      onCheckedChange={(checked) => updateSettings("general", "debugLogging", checked)}
                    />
                  </div>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {/* Azure Configuration (Read-only) */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Azure AD Configuration</CardTitle>
              <CardDescription>
                Microsoft Graph authentication settings (managed via environment variables)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <FieldGroup>
                <Field>
                  <FieldLabel>Azure AD Application</FieldLabel>
                  <FieldDescription>
                    Application (client) ID for Microsoft Graph authentication
                  </FieldDescription>
                  <Input
                    placeholder="Not configured"
                    value={process.env.NEXT_PUBLIC_AZURE_CLIENT_ID ? "••••••••-••••-••••-••••-••••••••" + (process.env.NEXT_PUBLIC_AZURE_CLIENT_ID?.slice(-4) || "") : "Set via AZURE_CLIENT_ID env var"}
                    disabled
                  />
                </Field>
              </FieldGroup>

              <FieldGroup>
                <Field>
                  <FieldLabel>Tenant ID</FieldLabel>
                  <FieldDescription>
                    Azure AD tenant (directory) ID
                  </FieldDescription>
                  <Input
                    placeholder="Not configured"
                    value={process.env.NEXT_PUBLIC_AZURE_TENANT_ID ? "••••••••-••••-••���•-••••-••••••••" + (process.env.NEXT_PUBLIC_AZURE_TENANT_ID?.slice(-4) || "") : "Set via AZURE_TENANT_ID env var"}
                    disabled
                  />
                </Field>
              </FieldGroup>

              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="font-medium text-foreground">Required API Permissions</h4>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.19_145)]" />
                    Calendars.Read - Read calendars in all mailboxes
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.19_145)]" />
                    Place.Read.All - Read room mailbox information
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.19_145)]" />
                    Mail.Send - Send notification emails
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.19_145)]" />
                    User.Read.All - Resolve organizer details
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMTP / Email Settings Tab */}
        <TabsContent value="smtp" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SMTP Configuration</CardTitle>
              <CardDescription>
                Configure email server settings for sending notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldGroup>
                  <Field>
                    <FieldLabel>SMTP Host</FieldLabel>
                    <Input
                      placeholder="smtp.office365.com"
                      value={settings.smtp.host}
                      onChange={(e) => updateSettings("smtp", "host", e.target.value)}
                    />
                  </Field>
                </FieldGroup>
                <FieldGroup>
                  <Field>
                    <FieldLabel>SMTP Port</FieldLabel>
                    <Input
                      placeholder="587"
                      value={settings.smtp.port}
                      onChange={(e) => updateSettings("smtp", "port", e.target.value)}
                    />
                  </Field>
                </FieldGroup>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldGroup>
                  <Field>
                    <FieldLabel>Username</FieldLabel>
                    <Input
                      placeholder="notifications@aditumbio.com"
                      value={settings.smtp.user}
                      onChange={(e) => updateSettings("smtp", "user", e.target.value)}
                    />
                  </Field>
                </FieldGroup>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Password</FieldLabel>
                    <div className="relative">
                      <Input
                        type={showSmtpPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={settings.smtp.pass}
                        onChange={(e) => updateSettings("smtp", "pass", e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      >
                        {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </Field>
                </FieldGroup>
              </div>

              <FieldGroup>
                <Field>
                  <FieldLabel>From Address</FieldLabel>
                  <FieldDescription>
                    The email address that notifications will be sent from
                  </FieldDescription>
                  <Input
                    placeholder="Room Notifications <notifications@aditumbio.com>"
                    value={settings.smtp.from}
                    onChange={(e) => updateSettings("smtp", "from", e.target.value)}
                  />
                </Field>
              </FieldGroup>

              <div className="border-t pt-6">
                <h4 className="mb-4 font-medium">Send Test Email</h4>
                <div className="flex gap-3">
                  <Input
                    placeholder="recipient@example.com"
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                    className="max-w-sm"
                  />
                  <Button
                    onClick={async () => {
                      if (!testEmailTo) return
                      setIsSendingTest(true)
                      setTestEmailStatus("idle")
                      try {
                        const res = await fetch("/api/email/test", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            to: testEmailTo,
                            subject: "Test Email from Room Booking Notifications",
                            html: "<h1>Test Email</h1><p>This is a test email from your Room Booking Notifications system.</p>",
                            smtpConfig: settings.smtp,
                          }),
                        })
                        if (res.ok) {
                          setTestEmailStatus("success")
                        } else {
                          setTestEmailStatus("error")
                        }
                      } catch {
                        setTestEmailStatus("error")
                      } finally {
                        setIsSendingTest(false)
                      }
                    }}
                    disabled={isSendingTest || !testEmailTo || !settings.smtp.host}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {isSendingTest ? "Sending..." : "Send Test"}
                  </Button>
                  {testEmailStatus === "success" && (
                    <Badge variant="outline" className="border-[oklch(0.72_0.19_145)] text-[oklch(0.72_0.19_145)]">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Sent!
                    </Badge>
                  )}
                  {testEmailStatus === "error" && (
                    <Badge variant="outline" className="border-destructive text-destructive">
                      <XCircle className="mr-1 h-3 w-3" /> Failed
                    </Badge>
                  )}
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="mb-4 font-medium">Test Variables</h4>
                <p className="mb-4 text-sm text-muted-foreground">
                  Set values for template variables to preview and test emails
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {testVariables.map((variable, index) => (
                    <FieldGroup key={variable.key}>
                      <Field>
                        <FieldLabel className="flex items-center gap-2">
                          <code className="rounded bg-muted px-1 text-xs">{`{{${variable.key}}}`}</code>
                        </FieldLabel>
                        <Input
                          value={variable.value}
                          onChange={(e) => {
                            const updated = [...testVariables]
                            updated[index] = { ...variable, value: e.target.value }
                            setTestVariables(updated)
                          }}
                          placeholder={variable.description}
                        />
                      </Field>
                    </FieldGroup>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">User Management</CardTitle>
                  <CardDescription>
                    Manage users who have access to this application
                  </CardDescription>
                </div>
                <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New User</DialogTitle>
                      <DialogDescription>
                        Invite a new user to access the Room Booking Notifications system
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4">
                      <FieldGroup>
                        <Field>
                          <FieldLabel>Email Address</FieldLabel>
                          <Input
                            placeholder="user@aditumbio.com"
                            value={newUser.email}
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          />
                        </Field>
                      </FieldGroup>
                      <FieldGroup>
                        <Field>
                          <FieldLabel>Full Name</FieldLabel>
                          <Input
                            placeholder="John Smith"
                            value={newUser.name}
                            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                          />
                        </Field>
                      </FieldGroup>
                      <FieldGroup>
                        <Field>
                          <FieldLabel>Role</FieldLabel>
                          <Select
                            value={newUser.role}
                            onValueChange={(value: "admin" | "operator" | "viewer") => setNewUser({ ...newUser, role: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin - Full access</SelectItem>
                              <SelectItem value="operator">Operator - Manage bookings</SelectItem>
                              <SelectItem value="viewer">Viewer - Read only</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </FieldGroup>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddUser(false)}>Cancel</Button>
                      <Button onClick={() => {
                        if (newUser.email && newUser.name) {
                          setUsers([...users, {
                            id: crypto.randomUUID(),
                            email: newUser.email,
                            name: newUser.name,
                            role: newUser.role,
                            status: "invited"
                          }])
                          setNewUser({ email: "", name: "", role: "viewer" })
                          setShowAddUser(false)
                          setHasChanges(true)
                        }
                      }}>
                        Send Invite
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left text-sm font-medium">User</th>
                      <th className="p-3 text-left text-sm font-medium">Role</th>
                      <th className="p-3 text-left text-sm font-medium">Status</th>
                      <th className="p-3 text-left text-sm font-medium">Last Login</th>
                      <th className="p-3 text-right text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b last:border-0">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <Select
                            value={user.role}
                            onValueChange={(value: "admin" | "operator" | "viewer") => {
                              setUsers(users.map(u => u.id === user.id ? { ...u, role: value } : u))
                              setHasChanges(true)
                            }}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="operator">Operator</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Badge variant={user.status === "active" ? "default" : user.status === "invited" ? "secondary" : "destructive"}>
                            {user.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setUsers(users.filter(u => u.id !== user.id))
                              setHasChanges(true)
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* M365 User Sync Section */}
          <div className="mt-6">
            <UserManagement />
          </div>
        </TabsContent>

        {/* SSO Tab */}
        <TabsContent value="sso" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Single Sign-On (SSO)</CardTitle>
              <CardDescription>
                Configure Microsoft Entra ID (Azure AD) for single sign-on authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <FieldGroup>
                <Field className="flex items-center justify-between">
                  <div className="flex-1">
                    <FieldLabel>Enable SSO</FieldLabel>
                    <FieldDescription>
                      Allow users to sign in with their Microsoft work account
                    </FieldDescription>
                  </div>
                  <div className="shrink-0">
                    <Switch
                      checked={settings.sso.enabled}
                      onCheckedChange={(checked) => updateSettings("sso", "enabled", checked)}
                    />
                  </div>
                </Field>
              </FieldGroup>

              {settings.sso.enabled && (
                <>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Identity Provider</FieldLabel>
                      <Select
                        value={settings.sso.provider}
                        onValueChange={(value: "microsoft" | "none") => updateSettings("sso", "provider", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="microsoft">Microsoft Entra ID (Azure AD)</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldGroup>

                  {settings.sso.provider === "microsoft" && (
                    <>
                      <div className="rounded-lg border bg-muted/50 p-4">
                        <h4 className="font-medium text-foreground">Setup Instructions</h4>
                        <ol className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground list-decimal list-inside">
                          <li>Go to Azure Portal &gt; Microsoft Entra ID &gt; App registrations</li>
                          <li>Create a new application registration</li>
                          <li>Add a redirect URI: <code className="rounded bg-background px-1">{typeof window !== "undefined" ? window.location.origin : ""}/auth/callback</code></li>
                          <li>Create a client secret and copy the values below</li>
                        </ol>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <FieldGroup>
                          <Field>
                            <FieldLabel>Application (Client) ID</FieldLabel>
                            <Input
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                              value={settings.sso.clientId}
                              onChange={(e) => updateSettings("sso", "clientId", e.target.value)}
                            />
                          </Field>
                        </FieldGroup>
                        <FieldGroup>
                          <Field>
                            <FieldLabel>Directory (Tenant) ID</FieldLabel>
                            <Input
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                              value={settings.sso.tenantId}
                              onChange={(e) => updateSettings("sso", "tenantId", e.target.value)}
                            />
                          </Field>
                        </FieldGroup>
                      </div>

                      <FieldGroup>
                        <Field>
                          <FieldLabel>Client Secret</FieldLabel>
                          <FieldDescription>
                            Create a client secret in Azure AD and paste it here
                          </FieldDescription>
                          <div className="relative">
                            <Input
                              type="password"
                              placeholder="••••••••••••••••••••"
                              value={settings.sso.clientSecret}
                              onChange={(e) => updateSettings("sso", "clientSecret", e.target.value)}
                            />
                          </div>
                        </Field>
                      </FieldGroup>

                      <FieldGroup>
                        <Field>
                          <FieldLabel>Allowed Email Domains</FieldLabel>
                          <FieldDescription>
                            Comma-separated list of email domains allowed to sign in
                          </FieldDescription>
                          <Input
                            placeholder="aditumbio.com, aditum.com"
                            value={settings.sso.allowedDomains}
                            onChange={(e) => updateSettings("sso", "allowedDomains", e.target.value)}
                          />
                        </Field>
                      </FieldGroup>

                      <div className="rounded-lg border bg-muted/50 p-4">
                        <h4 className="font-medium text-foreground">Required API Permissions</h4>
                        <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.19_145)]" />
                            openid - Sign users in
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.19_145)]" />
                            profile - View users&apos; basic profile
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-[oklch(0.72_0.19_145)]" />
                            email - View users&apos; email address
                          </li>
                        </ul>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
