"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Database, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

const SYSTEM_SETTINGS_KEY = "system-settings"
const EMAIL_TEMPLATES_KEY = "email-templates-state"

export function MigrateSettingsButton() {
    const [isOpen, setIsOpen] = useState(false)
    const [isMigrating, setIsMigrating] = useState(false)
    const [result, setResult] = useState<{
        success: boolean
        message: string
        details?: Record<string, { success: boolean; error?: string }>
    } | null>(null)

    const handleMigrate = async () => {
        setIsMigrating(true)
        setResult(null)

        try {
            // Get data from localStorage
            const systemSettingsRaw = localStorage.getItem(SYSTEM_SETTINGS_KEY)
            const emailTemplatesRaw = localStorage.getItem(EMAIL_TEMPLATES_KEY)

            const systemSettings = systemSettingsRaw ? JSON.parse(systemSettingsRaw) : null
            const emailTemplates = emailTemplatesRaw ? JSON.parse(emailTemplatesRaw) : null

            if (!systemSettings && !emailTemplates) {
                setResult({
                    success: false,
                    message: "No settings found in localStorage to migrate",
                })
                return
            }

            // Call the migration API
            const response = await fetch("/api/migrate-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ systemSettings, emailTemplates }),
            })

            const data = await response.json()

            if (response.ok) {
                setResult({
                    success: true,
                    message: "Settings successfully migrated to the database!",
                    details: data.results,
                })
            } else {
                setResult({
                    success: false,
                    message: data.error || "Migration failed",
                    details: data.details,
                })
            }
        } catch (error) {
            setResult({
                success: false,
                message: `Migration error: ${error}`,
            })
        } finally {
            setIsMigrating(false)
        }
    }

    const clearLocalStorage = () => {
        localStorage.removeItem(SYSTEM_SETTINGS_KEY)
        localStorage.removeItem(EMAIL_TEMPLATES_KEY)
        setResult({
            success: true,
            message: "localStorage cleared! Settings will now load from the database.",
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Database className="h-4 w-4" />
                    Migrate to Database
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Migrate Settings to Database</DialogTitle>
                    <DialogDescription>
                        This will copy all settings from localStorage to the Supabase database for persistence across sessions and devices.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="rounded-lg border border-border bg-muted/50 p-4">
                        <h4 className="font-medium text-sm mb-2">What will be migrated:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            <li>- System settings (notifications, SMTP, SSO, policies)</li>
                            <li>- Email templates and version history</li>
                        </ul>
                    </div>

                    {result && (
                        <div
                            className={`rounded-lg border p-4 ${result.success
                                    ? "border-green-500/50 bg-green-500/10"
                                    : "border-red-500/50 bg-red-500/10"
                                }`}
                        >
                            <div className="flex items-start gap-2">
                                {result.success ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                                )}
                                <div>
                                    <p className={`text-sm font-medium ${result.success ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                                        {result.message}
                                    </p>
                                    {result.details && (
                                        <ul className="mt-2 text-xs text-muted-foreground">
                                            {Object.entries(result.details).map(([key, val]) => (
                                                <li key={key} className="flex items-center gap-1">
                                                    {val.success ? (
                                                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                                                    ) : (
                                                        <AlertCircle className="h-3 w-3 text-red-500" />
                                                    )}
                                                    {key}: {val.success ? "OK" : val.error}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row">
                    {result?.success && (
                        <Button
                            variant="outline"
                            onClick={clearLocalStorage}
                            className="text-amber-600 border-amber-600 hover:bg-amber-50"
                        >
                            Clear localStorage
                        </Button>
                    )}
                    <Button onClick={handleMigrate} disabled={isMigrating}>
                        {isMigrating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Migrating...
                            </>
                        ) : (
                            "Start Migration"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
