import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET - Fetch all settings
export async function GET() {
    try {
        const supabase = createAdminClient()
        if (!supabase) {
            return NextResponse.json({ error: "Database not configured" }, { status: 500 })
        }

        const { data: settings, error } = await supabase
            .from("global_notification_settings")
            .select("setting_key, setting_value")

        if (error) {
            console.error("Error fetching settings:", error)
            return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
        }

        // Transform to object format
        const settingsObj: Record<string, unknown> = {}
        for (const setting of settings || []) {
            settingsObj[setting.setting_key] = setting.setting_value
        }

        return NextResponse.json({ settings: settingsObj })
    } catch (error) {
        console.error("Error in settings GET:", error)
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
    }
}

// POST - Save settings
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { settings } = body

        if (!settings) {
            return NextResponse.json({ error: "Settings are required" }, { status: 400 })
        }

        const supabase = createAdminClient()
        if (!supabase) {
            return NextResponse.json({ error: "Database not configured" }, { status: 500 })
        }

        // Map frontend settings to database format
        const settingsToSave = [
            {
                setting_key: "custom_notifications_enabled",
                setting_value: { enabled: settings.notifications?.customNotificationsEnabled ?? false }
            },
            {
                setting_key: "default_suppress_exchange",
                setting_value: { enabled: settings.notifications?.suppressExchangeNotifications ?? false }
            },
            {
                setting_key: "notification_email_from",
                setting_value: { address: settings.notifications?.serviceMailbox ?? "" }
            },
            {
                setting_key: "send_acceptance_notifications",
                setting_value: { enabled: settings.notifications?.sendAcceptanceNotifications ?? true }
            },
            {
                setting_key: "send_decline_notifications",
                setting_value: { enabled: settings.notifications?.sendDeclineNotifications ?? true }
            },
            {
                setting_key: "include_alternative_suggestions",
                setting_value: { enabled: settings.notifications?.includeAlternativeSuggestions ?? false }
            },
            {
                setting_key: "include_av_guidance",
                setting_value: { enabled: settings.notifications?.includeAVGuidance ?? false }
            },
            {
                setting_key: "cc_executive_assistants",
                setting_value: { enabled: settings.notifications?.ccExecutiveAssistants ?? false }
            },
            {
                setting_key: "webhook_url",
                setting_value: { url: settings.general?.webhookUrl ?? "" }
            },
            {
                setting_key: "logo_url",
                setting_value: { url: settings.general?.logoUrl ?? "" }
            },
            {
                setting_key: "support_email",
                setting_value: { address: settings.general?.supportEmail ?? "" }
            },
            {
                setting_key: "debug_logging",
                setting_value: { enabled: settings.general?.debugLogging ?? false }
            },
            {
                setting_key: "retry_failed_notifications",
                setting_value: { enabled: settings.general?.retryFailedNotifications ?? true }
            },
            {
                setting_key: "max_retry_attempts",
                setting_value: { value: settings.general?.maxRetryAttempts ?? 3 }
            }
        ]

        // Upsert each setting
        for (const setting of settingsToSave) {
            const { error } = await supabase
                .from("global_notification_settings")
                .upsert(
                    {
                        setting_key: setting.setting_key,
                        setting_value: setting.setting_value,
                        updated_at: new Date().toISOString()
                    },
                    { onConflict: "setting_key" }
                )

            if (error) {
                console.error(`Error saving setting ${setting.setting_key}:`, error)
            }
        }

        console.log("[SETTINGS] Saved settings to database")

        return NextResponse.json({ success: true, message: "Settings saved successfully" })
    } catch (error) {
        console.error("Error in settings POST:", error)
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
    }
}
