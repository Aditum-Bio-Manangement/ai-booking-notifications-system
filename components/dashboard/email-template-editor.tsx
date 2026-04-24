"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Code, 
  Save, 
  RotateCcw, 
  History, 
  Trash2, 
  MoreVertical,
  Clock,
  ArrowUpFromLine,
  Send,
  TestTube,
  Settings2,
} from "lucide-react"
import { defaultTemplates } from "@/lib/email-templates"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { format } from "date-fns"

interface TemplateVersion {
  id: string
  subject: string
  body: string
  savedAt: string
  label?: string
}

interface TemplateState {
  accepted: {
    current: { subject: string; body: string }
    versions: TemplateVersion[]
  }
  declined: {
    current: { subject: string; body: string }
    versions: TemplateVersion[]
  }
}

const STORAGE_KEY = "email-templates-state"

const defaultSampleData = {
  organizerName: "John Smith",
  roomName: "Cambridge Conference Room A",
  subject: "Q1 Planning Meeting",
  date: "Friday, March 27, 2026",
  startTime: "2:00 PM",
  endTime: "3:00 PM",
  timeZone: "America/New_York",
  reason: "The room has a scheduling conflict with an existing booking.",
  logoUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Aditum%20Logo%20Horizontal%201536x1024-5t69K1LQrBFk3K8lGSV6y6nHkWuYrG.png",
  organizerEmail: "john.smith@aditumbio.com",
}

// Replace template variables with sample data
function renderTemplate(template: string, data: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(regex, value)
  }
  return result
}

export function EmailTemplateEditor() {
  const [activeTemplate, setActiveTemplate] = useState<"accepted" | "declined">("accepted")
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview")
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle")
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showTestVariables, setShowTestVariables] = useState(false)
  const [showSendTest, setShowSendTest] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Test variables for preview
  const [sampleData, setSampleData] = useState(defaultSampleData)
  
  // Send test email state
  const [testEmailTo, setTestEmailTo] = useState("")
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [testEmailStatus, setTestEmailStatus] = useState<"idle" | "success" | "error">("idle")
  const [testEmailError, setTestEmailError] = useState("")

  // Initialize state with defaults
  const [templateState, setTemplateState] = useState<TemplateState>({
    accepted: {
      current: { subject: defaultTemplates.accepted.subject, body: defaultTemplates.accepted.body },
      versions: [],
    },
    declined: {
      current: { subject: defaultTemplates.declined.subject, body: defaultTemplates.declined.body },
      versions: [],
    },
  })

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setTemplateState(parsed)
      }
    } catch (e) {
      console.error("Failed to load templates from storage:", e)
    }
  }, [])

  // Current template helpers
  const currentSubject = templateState[activeTemplate].current.subject
  const currentBody = templateState[activeTemplate].current.body
  const currentVersions = templateState[activeTemplate].versions

  const setCurrentSubject = (subject: string) => {
    setTemplateState((prev) => ({
      ...prev,
      [activeTemplate]: {
        ...prev[activeTemplate],
        current: { ...prev[activeTemplate].current, subject },
      },
    }))
  }

  const setCurrentBody = (body: string) => {
    setTemplateState((prev) => ({
      ...prev,
      [activeTemplate]: {
        ...prev[activeTemplate],
        current: { ...prev[activeTemplate].current, body },
      },
    }))
  }

  // Save current template as a new version
  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus("idle")

    try {
      const newVersion: TemplateVersion = {
        id: crypto.randomUUID(),
        subject: currentSubject,
        body: currentBody,
        savedAt: new Date().toISOString(),
        label: `Version ${currentVersions.length + 1}`,
      }

      const newState = {
        ...templateState,
        [activeTemplate]: {
          current: { subject: currentSubject, body: currentBody },
          versions: [newVersion, ...templateState[activeTemplate].versions].slice(0, 20), // Keep max 20 versions
        },
      }

      setTemplateState(newState)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))

      // Simulate API save
      await new Promise((resolve) => setTimeout(resolve, 500))
      setSaveStatus("success")
      setTimeout(() => setSaveStatus("idle"), 3000)
    } catch {
      setSaveStatus("error")
    } finally {
      setIsSaving(false)
    }
  }

  // Reset to default template
  const handleResetToDefault = () => {
    const defaults = activeTemplate === "accepted" 
      ? defaultTemplates.accepted 
      : defaultTemplates.declined

    setTemplateState((prev) => ({
      ...prev,
      [activeTemplate]: {
        ...prev[activeTemplate],
        current: { subject: defaults.subject, body: defaults.body },
      },
    }))
  }

  // Restore a specific version
  const handleRestoreVersion = (version: TemplateVersion) => {
    setTemplateState((prev) => ({
      ...prev,
      [activeTemplate]: {
        ...prev[activeTemplate],
        current: { subject: version.subject, body: version.body },
      },
    }))
    setShowVersionHistory(false)
  }

  // Delete a specific version
  const handleDeleteVersion = (versionId: string) => {
    setTemplateState((prev) => {
      const newState = {
        ...prev,
        [activeTemplate]: {
          ...prev[activeTemplate],
          versions: prev[activeTemplate].versions.filter((v) => v.id !== versionId),
        },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
      return newState
    })
  }

  // Generate preview HTML
  const previewHtml = useMemo(() => {
    return renderTemplate(currentBody, sampleData)
  }, [currentBody, sampleData])

  // Format saved time
  const formatSavedTime = (dateStr: string) => {
    if (!mounted) return "..."
    try {
      return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a")
    } catch {
      return dateStr
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Email Templates</h2>
          <p className="text-sm text-muted-foreground">
            Configure notification emails sent to meeting organizers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Test Variables Dialog */}
          <Dialog open={showTestVariables} onOpenChange={setShowTestVariables}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Test Variables
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Test Variables</DialogTitle>
                <DialogDescription>
                  Set values for template variables to preview and test emails
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 md:grid-cols-2">
                {Object.entries(sampleData).map(([key, value]) => (
                  <FieldGroup key={key}>
                    <Field>
                      <FieldLabel className="flex items-center gap-2">
                        <code className="rounded bg-muted px-1 text-xs">{`{{${key}}}`}</code>
                      </FieldLabel>
                      <Input 
                        value={value}
                        onChange={(e) => setSampleData(prev => ({ ...prev, [key]: e.target.value }))}
                      />
                    </Field>
                  </FieldGroup>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSampleData(defaultSampleData)}>
                  Reset to Defaults
                </Button>
                <DialogClose asChild>
                  <Button>Apply</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Send Test Email Dialog */}
          <Dialog open={showSendTest} onOpenChange={(open) => {
            setShowSendTest(open)
            if (!open) {
              setTestEmailStatus("idle")
              setTestEmailError("")
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Send className="h-4 w-4" />
                Send Test
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Test Email</DialogTitle>
                <DialogDescription>
                  Send this {activeTemplate === "accepted" ? "acceptance" : "decline"} template to a test recipient
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel>Recipient Email</FieldLabel>
                    <Input 
                      type="email"
                      placeholder="test@example.com"
                      value={testEmailTo}
                      onChange={(e) => setTestEmailTo(e.target.value)}
                    />
                  </Field>
                </FieldGroup>
                {testEmailStatus === "success" && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Test email sent successfully!
                  </div>
                )}
                {testEmailStatus === "error" && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    <XCircle className="h-4 w-4" />
                    {testEmailError || "Failed to send test email"}
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button 
                  onClick={async () => {
                    if (!testEmailTo) return
                    setIsSendingTest(true)
                    setTestEmailStatus("idle")
                    setTestEmailError("")
                    try {
                      const res = await fetch("/api/email/test", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          to: testEmailTo,
                          subject: renderTemplate(currentSubject, sampleData),
                          html: renderTemplate(currentBody, sampleData),
                          variables: sampleData,
                        }),
                      })
                      const data = await res.json()
                      if (res.ok) {
                        setTestEmailStatus("success")
                      } else {
                        setTestEmailStatus("error")
                        setTestEmailError(data.message || data.error || "Failed to send")
                      }
                    } catch (err) {
                      setTestEmailStatus("error")
                      setTestEmailError("Network error")
                    } finally {
                      setIsSendingTest(false)
                    }
                  }}
                  disabled={isSendingTest || !testEmailTo}
                  className="gap-2"
                >
                  {isSendingTest ? (
                    <>Sending...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Test
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <History className="h-4 w-4" />
                Version History
                {currentVersions.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {currentVersions.length}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Version History</DialogTitle>
                <DialogDescription>
                  {activeTemplate === "accepted" ? "Accepted" : "Declined"} template versions. 
                  Restore a previous version or delete versions you no longer need.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[400px]">
                {currentVersions.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No saved versions yet. Save changes to create a version.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 pr-4">
                    {currentVersions.map((version, index) => (
                      <div
                        key={version.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                            {currentVersions.length - index}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {version.label || `Version ${currentVersions.length - index}`}
                            </p>
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatSavedTime(version.savedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestoreVersion(version)}
                            className="gap-1"
                          >
                            <ArrowUpFromLine className="h-4 w-4" />
                            Restore
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleRestoreVersion(version)}>
                                <ArrowUpFromLine className="mr-2 h-4 w-4" />
                                Restore this version
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteVersion(version.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete version
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={handleResetToDefault} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset to Default
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          {saveStatus === "success" && (
            <Badge variant="outline" className="border-[oklch(0.72_0.19_145)] text-[oklch(0.72_0.19_145)] gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Saved
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor Panel */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Template Editor</CardTitle>
              <Tabs value={activeTemplate} onValueChange={(v) => setActiveTemplate(v as "accepted" | "declined")}>
                <TabsList className="h-8">
                  <TabsTrigger value="accepted" className="h-7 gap-1.5 px-3 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[oklch(0.72_0.19_145)]" />
                    Accepted
                  </TabsTrigger>
                  <TabsTrigger value="declined" className="h-7 gap-1.5 px-3 text-xs">
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                    Declined
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <CardDescription>
              {activeTemplate === "accepted"
                ? "Sent when a room booking is confirmed"
                : "Sent when a room booking is declined"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Email Subject</FieldLabel>
                <Input
                  value={currentSubject}
                  onChange={(e) => setCurrentSubject(e.target.value)}
                  placeholder="Email subject line..."
                />
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span>Email Body (HTML)</span>
                  <span className="text-xs font-normal text-muted-foreground break-all">
                    Variables: {"{{organizerName}}, {{roomName}}, {{subject}}, {{date}}, {{startTime}}, {{endTime}}, {{timeZone}}, {{reason}}"}
                  </span>
                </FieldLabel>
                <Textarea
                  value={currentBody}
                  onChange={(e) => setCurrentBody(e.target.value)}
                  placeholder="HTML email content..."
                  className="min-h-[300px] font-mono text-xs sm:min-h-[400px]"
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Preview</CardTitle>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "preview" | "code")}>
                <TabsList className="h-8">
                  <TabsTrigger value="preview" className="h-7 gap-1.5 px-3 text-xs">
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="code" className="h-7 gap-1.5 px-3 text-xs">
                    <Code className="h-3.5 w-3.5" />
                    HTML
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <CardDescription>Live preview with sample data</CardDescription>
          </CardHeader>
          <CardContent>
            {viewMode === "preview" ? (
              <div className="rounded-lg border bg-white">
                <iframe
                  srcDoc={previewHtml}
                  className="h-[350px] w-full rounded-lg sm:h-[500px]"
                  title="Email preview"
                />
              </div>
            ) : (
              <pre className="max-h-[350px] overflow-auto rounded-lg bg-muted p-4 text-xs sm:max-h-[500px]">
                <code>{previewHtml}</code>
              </pre>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Variable Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Template Variables</CardTitle>
          <CardDescription>
            Use these placeholders in your templates - they will be replaced with actual values
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { var: "{{organizerName}}", desc: "Meeting organizer name" },
              { var: "{{roomName}}", desc: "Room display name" },
              { var: "{{subject}}", desc: "Meeting subject/title" },
              { var: "{{date}}", desc: "Meeting date (formatted)" },
              { var: "{{startTime}}", desc: "Start time (12h format)" },
              { var: "{{endTime}}", desc: "End time (12h format)" },
              { var: "{{timeZone}}", desc: "Time zone identifier" },
              { var: "{{reason}}", desc: "Decline reason (declined only)" },
              { var: "{{logoUrl}}", desc: "Company logo URL" },
              { var: "{{alternativeRooms}}", desc: "AI-suggested alternatives" },
              { var: "{{avInstructions}}", desc: "Room AV setup guidance" },
              { var: "{{accessNotes}}", desc: "Room access information" },
            ].map((item) => (
              <div key={item.var} className="rounded-lg border bg-muted/50 p-3">
                <code className="text-sm font-medium text-primary">{item.var}</code>
                <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
