"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { FieldGroup, Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import {
  ArrowLeft,
  User,
  Mail,
  Building2,
  Phone,
  Camera,
  Save,
  Shield,
  Clock,
  CheckCircle2,
  ImageIcon,
  RefreshCw,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

export default function ProfilePage() {
  const { user, updateProfile, refreshUser, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "profile")
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle")

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department: "",
    title: "",
    phone: "",
    avatarUrl: "",
  })

  // Initialize form data from user
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        department: user.department || "",
        title: user.title || "",
        phone: user.phone || "",
        avatarUrl: user.avatarUrl || "",
      })
    }
  }, [user])

  const userInitials = formData.name && formData.name !== "User"
    ? formData.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email
      ? user.email.split("@")[0].slice(0, 2).toUpperCase()
      : "U"

  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus("idle")

    try {
      await updateProfile({
        name: formData.name,
        department: formData.department,
        title: formData.title,
        phone: formData.phone,
        avatarUrl: formData.avatarUrl,
      })
      setSaveStatus("success")
      setTimeout(() => setSaveStatus("idle"), 3000)
    } catch {
      setSaveStatus("error")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSyncFromM365 = async () => {
    if (!user?.email) return

    setIsSyncing(true)
    setSaveStatus("idle")

    try {
      const response = await fetch("/api/profile/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error("Sync failed:", data.error)
        setSaveStatus("error")
        return
      }

      if (data.profile) {
        // Update local form data with synced values
        const newFormData = {
          name: data.profile.name || formData.name,
          email: data.profile.email || formData.email,
          department: data.profile.department || formData.department,
          title: data.profile.title || formData.title,
          phone: data.profile.phone || formData.phone,
          avatarUrl: data.profile.avatarUrl || formData.avatarUrl,
        }
        setFormData(newFormData)

        // Refresh the user context to get updated data
        // Note: The API already saved to Supabase, so we just need to refresh
        await refreshUser()

        setSaveStatus("success")
        setTimeout(() => setSaveStatus("idle"), 3000)
      }
    } catch (error) {
      console.error("Failed to sync from M365:", error)
      setSaveStatus("error")
    } finally {
      setIsSyncing(false)
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Create a data URL for the image
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        setFormData((prev) => ({ ...prev, avatarUrl: dataUrl }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemovePhoto = () => {
    setFormData((prev) => ({ ...prev, avatarUrl: "" }))
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    router.push("/login")
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus === "success" && (
              <Badge variant="outline" className="gap-1 border-[oklch(0.72_0.19_145)] text-[oklch(0.72_0.19_145)]">
                <CheckCircle2 className="h-3 w-3" />
                Saved
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={handleSyncFromM365}
              disabled={isSyncing}
              className="gap-2"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Sync from M365</span>
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
          <p className="text-muted-foreground">Manage your profile and preferences</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="photo" className="gap-2">
              <Camera className="h-4 w-4" />
              Photo
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="flex flex-col gap-6">
              {/* Profile Overview Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Profile Overview</CardTitle>
                  <CardDescription>Your account information at a glance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <Avatar className="h-20 w-20">
                      {formData.avatarUrl && <AvatarImage src={formData.avatarUrl} alt={formData.name} />}
                      <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{formData.name}</h3>
                      <p className="text-muted-foreground">{formData.email}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          <Shield className="h-3 w-3" />
                          {user.role === "admin" ? "Administrator" : "Operator"}
                        </Badge>
                        {formData.department && (
                          <Badge variant="secondary">{formData.department}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profile Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Personal Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldGroup>
                      <Field>
                        <FieldLabel>Full Name</FieldLabel>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={formData.name}
                            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                            className="pl-10"
                          />
                        </div>
                      </Field>
                    </FieldGroup>

                    <FieldGroup>
                      <Field>
                        <FieldLabel>Email Address</FieldLabel>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={formData.email}
                            disabled
                            className="pl-10 bg-muted"
                          />
                        </div>
                        <FieldDescription>Email cannot be changed</FieldDescription>
                      </Field>
                    </FieldGroup>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldGroup>
                      <Field>
                        <FieldLabel>Department</FieldLabel>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={formData.department}
                            onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value }))}
                            placeholder="e.g., IT, Facilities"
                            className="pl-10"
                          />
                        </div>
                      </Field>
                    </FieldGroup>

                    <FieldGroup>
                      <Field>
                        <FieldLabel>Job Title</FieldLabel>
                        <Input
                          value={formData.title}
                          onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                          placeholder="e.g., System Administrator"
                        />
                      </Field>
                    </FieldGroup>
                  </div>

                  <FieldGroup>
                    <Field>
                      <FieldLabel>Phone Number</FieldLabel>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={formData.phone}
                          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="+1 (555) 123-4567"
                          className="pl-10"
                        />
                      </div>
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="photo">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profile Photo</CardTitle>
                <CardDescription>Update your profile picture</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6">
                <Avatar className="h-32 w-32">
                  {formData.avatarUrl && <AvatarImage src={formData.avatarUrl} alt={formData.name} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <div className="flex gap-3">
                    <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Upload Photo
                    </Button>
                    {formData.avatarUrl && (
                      <Button variant="outline" onClick={handleRemovePhoto}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended: Square image, at least 200x200px
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Account Information</CardTitle>
                  <CardDescription>Security details for your account</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Account Role</p>
                        <p className="text-sm text-muted-foreground">
                          Your access level in the system
                        </p>
                      </div>
                    </div>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role === "admin" ? "Administrator" : "Operator"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Account Created</p>
                        <p className="text-sm text-muted-foreground">
                          When your account was first set up
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Last Login</p>
                        <p className="text-sm text-muted-foreground">
                          Most recent sign-in to the system
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {user.lastLogin ? format(new Date(user.lastLogin), "MMM d, yyyy h:mm a") : "N/A"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Password</CardTitle>
                  <CardDescription>Change your account password</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Password management is handled through your organization&apos;s identity provider.
                    Contact IT support if you need to reset your password.
                  </p>
                  <Button variant="outline" disabled>
                    Change Password (Coming Soon)
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
