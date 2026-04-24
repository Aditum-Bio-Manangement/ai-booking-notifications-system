import { NextRequest, NextResponse } from "next/server"
import { sendEmail } from "@/lib/microsoft-graph"
import { renderAcceptedEmail } from "@/lib/email-templates"

// Test endpoint to verify email sending works
// POST /api/test/send-notification
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            toEmail,
            roomName = "Test Room",
            subject = "Test Meeting",
            organizerName = "Test User"
        } = body

        if (!toEmail) {
            return NextResponse.json(
                { error: "toEmail is required" },
                { status: 400 }
            )
        }

        const notificationMailbox = process.env.NOTIFICATION_MAILBOX
        if (!notificationMailbox) {
            return NextResponse.json(
                { error: "NOTIFICATION_MAILBOX environment variable is not set" },
                { status: 500 }
            )
        }

        console.log(`[TEST] Sending test notification email`)
        console.log(`[TEST] From: ${notificationMailbox}`)
        console.log(`[TEST] To: ${toEmail}`)

        // Generate test email content
        const htmlContent = renderAcceptedEmail({
            organizerName,
            roomName,
            subject,
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            timeZone: "America/New_York",
        })

        // Send the email via Microsoft Graph
        await sendEmail(
            notificationMailbox,
            toEmail,
            `[TEST] Room Confirmed: ${roomName} - ${subject}`,
            htmlContent
        )

        console.log(`[TEST] Email sent successfully!`)

        return NextResponse.json({
            success: true,
            message: `Test notification email sent to ${toEmail}`,
            from: notificationMailbox,
        })
    } catch (error) {
        console.error(`[TEST] Failed to send email:`, error)
        return NextResponse.json(
            {
                error: "Failed to send test email",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}

// GET endpoint to show instructions
export async function GET() {
    const notificationMailbox = process.env.NOTIFICATION_MAILBOX

    return NextResponse.json({
        endpoint: "POST /api/test/send-notification",
        description: "Test endpoint to verify email sending via Microsoft Graph",
        configuration: {
            notificationMailbox: notificationMailbox || "NOT CONFIGURED",
            azureClientId: process.env.AZURE_CLIENT_ID ? "configured" : "NOT CONFIGURED",
            azureClientSecret: process.env.AZURE_CLIENT_SECRET ? "configured" : "NOT CONFIGURED",
            azureTenantId: process.env.AZURE_TENANT_ID ? "configured" : "NOT CONFIGURED",
        },
        exampleRequest: {
            method: "POST",
            body: {
                toEmail: "caleb.klobe@aditumbio.com.com",
                roomName: "Longfellow Room - Cambridge",
                subject: "Test Meeting",
                organizerName: "Caleb Klobe"
            }
        }
    })
}
