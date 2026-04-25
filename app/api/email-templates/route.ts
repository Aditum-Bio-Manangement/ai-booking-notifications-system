import { NextRequest, NextResponse } from "next/server"
import { setCustomTemplate } from "@/lib/email-templates"

// In-memory store for custom templates (in production, use a database)
// Structure: { accepted: { subject, body }, declined: { subject, body } }
interface TemplateData {
    subject: string
    body: string
    updatedAt: string
}

interface TemplateStore {
    accepted?: TemplateData
    declined?: TemplateData
}

// Global store that persists across requests (but not server restarts)
const customTemplates: TemplateStore = {}

// Version history store
interface TemplateVersion {
    id: string
    templateType: "accepted" | "declined"
    subject: string
    body: string
    createdAt: string
}

const templateVersions: TemplateVersion[] = []

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") as "accepted" | "declined" | null
    const includeVersions = searchParams.get("versions") === "true"

    if (type && customTemplates[type]) {
        const response: { template: TemplateData; versions?: TemplateVersion[] } = {
            template: customTemplates[type]!,
        }

        if (includeVersions) {
            response.versions = templateVersions
                .filter(v => v.templateType === type)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10) // Last 10 versions
        }

        return NextResponse.json(response)
    }

    if (type) {
        // Return null to indicate no custom template (use default)
        return NextResponse.json({ template: null })
    }

    // Return all custom templates
    return NextResponse.json({
        templates: customTemplates,
        hasCustomAccepted: !!customTemplates.accepted,
        hasCustomDeclined: !!customTemplates.declined,
    })
}

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

        if (!subject || !htmlBody) {
            return NextResponse.json(
                { error: "Subject and htmlBody are required" },
                { status: 400 }
            )
        }

        // Save version history before updating
        if (customTemplates[type as "accepted" | "declined"]) {
            const existingTemplate = customTemplates[type as "accepted" | "declined"]!
            templateVersions.push({
                id: crypto.randomUUID(),
                templateType: type as "accepted" | "declined",
                subject: existingTemplate.subject,
                body: existingTemplate.body,
                createdAt: existingTemplate.updatedAt,
            })
        }

        // Update the template
        const templateData = {
            subject,
            body: htmlBody,
            updatedAt: new Date().toISOString(),
        }
        customTemplates[type as "accepted" | "declined"] = templateData

        // Sync with email-templates cache so webhook uses new template
        setCustomTemplate(type as "accepted" | "declined", templateData)

        return NextResponse.json({
            success: true,
            message: `${type} template saved successfully`,
            template: customTemplates[type as "accepted" | "declined"],
        })
    } catch (error) {
        console.error("Error saving email template:", error)
        return NextResponse.json(
            { error: "Failed to save template", message: String(error) },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get("type") as "accepted" | "declined" | null

        if (!type || !["accepted", "declined"].includes(type)) {
            return NextResponse.json(
                { error: "Invalid template type" },
                { status: 400 }
            )
        }

        // Reset to default by deleting custom template
        delete customTemplates[type]

        // Sync with email-templates cache
        setCustomTemplate(type, null)

        return NextResponse.json({
            success: true,
            message: `${type} template reset to default`,
        })
    } catch (error) {
        console.error("Error resetting email template:", error)
        return NextResponse.json(
            { error: "Failed to reset template", message: String(error) },
            { status: 500 }
        )
    }
}

// Export the custom templates store for use in email-templates.ts
export function getCustomTemplate(type: "accepted" | "declined"): TemplateData | null {
    return customTemplates[type] || null
}
