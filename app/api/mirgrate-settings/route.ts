import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST - Migrate localStorage settings to database
export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        if (!supabase) {
            return NextResponse.json({ error: "Database not configured" }, { status: 500 })
        }

        const body = await request.json()
        const { systemSettings, emailTemplates } = body

        const results: Record<string, { success: boolean; error?: string }> = {}

        // Migrate system settings to the settings table
        if (systemSettings) {
            try {
                // Save each settings category
                const settingsToSave = [
                    { key: "notifications", value: systemSettings.notifications },
                    { key: "general", value: systemSettings.general },
                    { key: "roomPolicies", value: systemSettings.roomPolicies },
                    { key: "smtp", value: systemSettings.smtp },
                    { key: "sso", value: systemSettings.sso },
                ]

                for (const setting of settingsToSave) {
                    if (setting.value) {
                        const { error } = await supabase
                            .from("settings")
                            .upsert({
                                key: setting.key,
                                value: setting.value,
                                updated_at: new Date().toISOString(),
                            }, { onConflict: "key" })

                        if (error) {
                            results[setting.key] = { success: false, error: error.message }
                        } else {
                            results[setting.key] = { success: true }
                        }
                    }
                }

                // Also save to global_notification_settings for webhook compatibility
                if (systemSettings.notifications) {
                    const notificationSettings = [
                        {
                            setting_key: "custom_notifications_enabled",
                            setting_value: { enabled: systemSettings.notifications.customNotificationsEnabled ?? true }
                        },
                        {
                            setting_key: "send_acceptance_notifications",
                            setting_value: { enabled: systemSettings.notifications.sendAcceptanceNotifications ?? true }
                        },
                        {
                            setting_key: "send_decline_notifications",
                            setting_value: { enabled: systemSettings.notifications.sendDeclineNotifications ?? true }
                        },
                        {
                            setting_key: "service_mailbox",
                            setting_value: { email: systemSettings.notifications.serviceMailbox ?? "" }
                        },
                    ]

                    for (const setting of notificationSettings) {
                        await supabase
                            .from("global_notification_settings")
                            .upsert({
                                setting_key: setting.setting_key,
                                setting_value: setting.setting_value,
                                updated_at: new Date().toISOString(),
                            }, { onConflict: "setting_key" })
                    }
                }

                results["systemSettings"] = { success: true }
            } catch (error) {
                results["systemSettings"] = { success: false, error: String(error) }
            }
        }

        // Migrate email templates
        if (emailTemplates) {
            try {
                for (const type of ["accepted", "declined"] as const) {
                    const template = emailTemplates[type]
                    if (template?.current) {
                        // Deactivate existing templates of this type
                        await supabase
                            .from("email_templates")
                            .update({ is_active: false })
                            .eq("template_type", type)

                        // Get current max version
                        const { data: versionData } = await supabase
                            .from("email_templates")
                            .select("version")
                            .eq("template_type", type)
                            .order("version", { ascending: false })
                            .limit(1)
                            .single()

                        const newVersion = (versionData?.version || 0) + 1

                        // Insert new template
                        const { error } = await supabase
                            .from("email_templates")
                            .insert({
                                template_type: type,
                                subject: template.current.subject,
                                body: template.current.body,
                                is_active: true,
                                version: newVersion,
                            })

                        if (error) {
                            results[`emailTemplate_${type}`] = { success: false, error: error.message }
                        } else {
                            results[`emailTemplate_${type}`] = { success: true }
                        }

                        // Save version history to email_template_versions
                        if (template.versions && template.versions.length > 0) {
                            for (const version of template.versions) {
                                await supabase
                                    .from("email_template_versions")
                                    .upsert({
                                        id: version.id,
                                        template_type: type,
                                        subject: version.subject,
                                        body: version.body,
                                        label: version.label,
                                        saved_at: version.savedAt,
                                    }, { onConflict: "id" })
                            }
                            results[`emailTemplateVersions_${type}`] = { success: true }
                        }
                    }
                }
            } catch (error) {
                results["emailTemplates"] = { success: false, error: String(error) }
            }
        }

        return NextResponse.json({
            success: true,
            message: "Settings migrated to database",
            results,
        })
    } catch (error) {
        console.error("[MIGRATE] Error:", error)
        return NextResponse.json(
            { error: "Failed to migrate settings", details: String(error) },
            { status: 500 }
        )
    }
}
