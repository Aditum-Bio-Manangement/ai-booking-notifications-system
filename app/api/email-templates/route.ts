import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { setCustomTemplate } from "@/lib/email-templates"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getSupabase() {
    if (!supabaseUrl || !supabaseKey) {
        return null
    }
    return createClient(supabaseUrl, supabaseKey)
}

// GET - Fetch email template by type
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get("type") // "accepted" or "declined"

        if (!type || !["accepted", "declined"].includes(type)) {
            return NextResponse.json(
                { error: "Invalid template type. Must be 'accepted' or 'declined'" },
                { status: 400 }
            )
        }

        const supabase = getSupabase()

        if (!supabase) {
            return NextResponse.json({
                template: null,
                message: "Database not configured, using default template"
            })
        }

        // Fetch active template from database
        const { data, error } = await supabase
            .from("email_templates")
            .select("*")
            .eq("template_type", type)
            .eq("is_active", true)
            .order("version", { ascending: false })
            .limit(1)
            .single()

        if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
            console.error("Error fetching template:", error)
            return NextResponse.json(
                { error: "Failed to fetch template", details: error.message },
                { status: 500 }
            )
        }

        // Sync with in-memory cache if template exists
        if (data) {
            setCustomTemplate(type as "accepted" | "declined", {
                subject: data.subject,
                body: data.body,
                updatedAt: data.updated_at,
            })
        }

        return NextResponse.json({
            template: data ? {
                id: data.id,
                type: data.template_type,
                subject: data.subject,
                body: data.body,
                version: data.version,
                updatedAt: data.updated_at,
            } : null,
        })
    } catch (error) {
        console.error("Error in GET /api/email-templates:", error)
        return NextResponse.json(
            { error: "Internal server error", message: String(error) },
            { status: 500 }
        )
    }
}

// POST - Save/update email template
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { type, subject, htmlBody } = body

        if (!type || !["accepted", "declined"].includes(type)) {
            return NextResponse.json(
                { error: "Invalid template type. Must be 'accepted' or 'declined'" },
                { status: 400 }
            )
        }

        if (!htmlBody) {
            return NextResponse.json(
                { error: "htmlBody is required" },
                { status: 400 }
            )
        }

        const supabase = getSupabase()

        if (!supabase) {
            // Fallback: just update in-memory cache
            const templateData = {
                subject: subject || "",
                body: htmlBody,
                updatedAt: new Date().toISOString(),
            }
            setCustomTemplate(type as "accepted" | "declined", templateData)

            return NextResponse.json({
                success: true,
                message: "Template saved to memory (database not configured)",
                template: templateData,
            })
        }

        // Get current max version for this template type
        const { data: existingTemplates } = await supabase
            .from("email_templates")
            .select("version")
            .eq("template_type", type)
            .order("version", { ascending: false })
            .limit(1)

        const nextVersion = existingTemplates && existingTemplates.length > 0
            ? existingTemplates[0].version + 1
            : 1

        // Deactivate all existing templates of this type
        await supabase
            .from("email_templates")
            .update({ is_active: false })
            .eq("template_type", type)

        // Insert new active template
        const { data, error } = await supabase
            .from("email_templates")
            .insert({
                template_type: type,
                subject: subject || `Room Booking ${type === "accepted" ? "Confirmed" : "Declined"}: {{roomName}} - {{subject}}`,
                body: htmlBody,
                is_active: true,
                version: nextVersion,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (error) {
            console.error("Error saving template:", error)
            return NextResponse.json(
                { error: "Failed to save template", details: error.message },
                { status: 500 }
            )
        }

        // Sync with in-memory cache
        const templateData = {
            subject: data.subject,
            body: data.body,
            updatedAt: data.updated_at,
        }
        setCustomTemplate(type as "accepted" | "declined", templateData)

        return NextResponse.json({
            success: true,
            message: `${type} template saved successfully`,
            template: {
                id: data.id,
                type: data.template_type,
                subject: data.subject,
                version: data.version,
                updatedAt: data.updated_at,
            },
        })
    } catch (error) {
        console.error("Error in POST /api/email-templates:", error)
        return NextResponse.json(
            { error: "Internal server error", message: String(error) },
            { status: 500 }
        )
    }
}

// DELETE - Reset template to default (deactivate custom template)
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get("type")

        if (!type || !["accepted", "declined"].includes(type)) {
            return NextResponse.json(
                { error: "Invalid template type. Must be 'accepted' or 'declined'" },
                { status: 400 }
            )
        }

        const supabase = getSupabase()

        // Clear in-memory cache
        setCustomTemplate(type as "accepted" | "declined", null)

        if (!supabase) {
            return NextResponse.json({
                success: true,
                message: "Template reset to default (memory only)",
            })
        }

        // Deactivate all templates of this type
        const { error } = await supabase
            .from("email_templates")
            .update({ is_active: false })
            .eq("template_type", type)

        if (error) {
            console.error("Error resetting template:", error)
            return NextResponse.json(
                { error: "Failed to reset template", details: error.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: `${type} template reset to default`,
        })
    } catch (error) {
        console.error("Error in DELETE /api/email-templates:", error)
        return NextResponse.json(
            { error: "Internal server error", message: String(error) },
            { status: 500 }
        )
    }
}
