import { NextRequest, NextResponse } from "next/server"
import { getRoomMailboxSettings, getRoomCalendarProcessing } from "@/lib/microsoft-graph"

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")

    if (!email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    try {
        // Get room mailbox settings
        let mailboxSettings: Record<string, unknown> = {}
        try {
            const settings = await getRoomMailboxSettings(email)
            if (settings && typeof settings === "object") {
                mailboxSettings = settings as Record<string, unknown>
            }
        } catch (e) {
            console.error("Failed to get mailbox settings:", e)
        }

        // Get calendar processing settings
        let calendarProcessing = null
        try {
            calendarProcessing = await getRoomCalendarProcessing(email)
        } catch (e) {
            console.error("Failed to get calendar processing:", e)
        }

        // Note: Getting delegates requires Exchange admin permissions
        // We'll return an empty array and show PowerShell commands instead
        const delegates: Array<{ id: string; displayName: string; email: string; type: string }> = []

        return NextResponse.json({
            room: {
                emailAddress: email,
                isHiddenFromGal: false, // Default - actual value requires Exchange admin
                ...mailboxSettings,
            },
            calendarProcessing: calendarProcessing || {
                autoAcceptEnabled: true,
                allowConflicts: false,
                bookingWindowInDays: 180,
                maximumDurationInMinutes: 1440,
                minimumDurationInMinutes: 0,
                allowRecurringMeetings: true,
                enforcedCapacity: false,
            },
            delegates,
        })
    } catch (error) {
        console.error("Failed to fetch room details:", error)
        return NextResponse.json(
            { error: "Failed to fetch room details" },
            { status: 500 }
        )
    }
}
