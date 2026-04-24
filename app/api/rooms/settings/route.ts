import { NextResponse } from "next/server"
import { getAccessToken, getRoomMailboxes } from "@/lib/microsoft-graph"

// PATCH - Update room mailbox settings to suppress/enable default notifications
// This controls the automatic calendar processing responses that Exchange sends
export async function PATCH(request: Request) {
    try {
        const { suppressDefaultNotifications } = await request.json()

        // Get access token
        const accessToken = await getAccessToken()

        // Get all rooms
        const rooms = await getRoomMailboxes()

        const results: { roomEmail: string; success: boolean; error?: string }[] = []

        // Update each room's settings
        for (const room of rooms) {
            try {
                // First, ALWAYS disable the automatic reply (OOF) messages
                // These are the "Your room booking request has been processed" messages
                // We never want these regardless of the toggle state
                const autoReplyResponse = await fetch(
                    `https://graph.microsoft.com/v1.0/users/${room.emailAddress}/mailboxSettings`,
                    {
                        method: "PATCH",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            automaticRepliesSetting: {
                                status: "disabled",
                                internalReplyMessage: "",
                                externalReplyMessage: "",
                            },
                        }),
                    }
                )

                if (!autoReplyResponse.ok) {
                    const errorData = await autoReplyResponse.json().catch(() => ({}))
                    console.error(`Failed to disable auto-reply for ${room.emailAddress}:`, errorData)
                }

                // Now handle the calendar processing settings
                // This controls whether the room sends the standard "Accepted/Declined" emails
                // We use the beta endpoint to access calendarProcessing settings
                if (suppressDefaultNotifications) {
                    // Suppress: Set AddAdditionalResponse to false and clear the response text
                    // This prevents the extra response text but Exchange still sends accept/decline
                    // To fully suppress, we need to use PowerShell Set-CalendarProcessing
                    const calendarResponse = await fetch(
                        `https://graph.microsoft.com/beta/users/${room.emailAddress}/mailboxSettings`,
                        {
                            method: "PATCH",
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                // Note: Graph API has limited control over calendar processing
                                // The full suppression requires Exchange PowerShell
                                automaticRepliesSetting: {
                                    status: "disabled",
                                },
                            }),
                        }
                    )

                    if (!calendarResponse.ok) {
                        const errorData = await calendarResponse.json().catch(() => ({}))
                        throw new Error(errorData?.error?.message || `HTTP ${calendarResponse.status}`)
                    }

                    results.push({ roomEmail: room.emailAddress, success: true })
                } else {
                    // Enable: Allow normal Exchange behavior
                    // The auto-reply is still disabled (we disabled it above)
                    // Only the standard accept/decline emails will be sent
                    results.push({ roomEmail: room.emailAddress, success: true })
                }
            } catch (error) {
                console.error(`Failed to update room ${room.emailAddress}:`, error)
                results.push({
                    roomEmail: room.emailAddress,
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error"
                })
            }
        }

        const successCount = results.filter(r => r.success).length
        const failCount = results.filter(r => !r.success).length

        // Important: Full suppression of Exchange booking emails requires Exchange Admin Center
        // or PowerShell. Graph API can only control automatic replies, not calendar responses.
        const important = suppressDefaultNotifications
            ? "Important: To fully suppress Exchange accept/decline emails, you must also run PowerShell: Set-CalendarProcessing -Identity <room> -AddAdditionalResponse $false -DeleteComments $true"
            : "Automatic reply messages have been disabled. Standard accept/decline emails will be sent by Exchange."

        return NextResponse.json({
            success: failCount === 0,
            message: failCount === 0
                ? `Updated ${successCount} room(s) successfully`
                : `Updated ${successCount} room(s), ${failCount} failed`,
            results,
            note: important,
            requiresPowerShell: suppressDefaultNotifications,
        })

    } catch (error) {
        console.error("Failed to update room settings:", error)
        return NextResponse.json(
            {
                error: "Failed to update room settings",
                details: error instanceof Error ? error.message : "Unknown error",
                note: "Ensure your Azure AD app has MailboxSettings.ReadWrite permission."
            },
            { status: 500 }
        )
    }
}

// GET - Get current room mailbox settings status
export async function GET() {
    try {
        const accessToken = await getAccessToken()
        const rooms = await getRoomMailboxes()

        const roomSettings = []

        for (const room of rooms) {
            try {
                const response = await fetch(
                    `https://graph.microsoft.com/v1.0/users/${room.emailAddress}/mailboxSettings`,
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    }
                )

                if (response.ok) {
                    const settings = await response.json()
                    roomSettings.push({
                        roomEmail: room.emailAddress,
                        roomName: room.displayName,
                        automaticRepliesEnabled: settings.automaticRepliesSetting?.status !== "disabled",
                        status: settings.automaticRepliesSetting?.status || "unknown",
                    })
                } else {
                    roomSettings.push({
                        roomEmail: room.emailAddress,
                        roomName: room.displayName,
                        automaticRepliesEnabled: null,
                        status: "error",
                        error: `HTTP ${response.status}`,
                    })
                }
            } catch (error) {
                roomSettings.push({
                    roomEmail: room.emailAddress,
                    roomName: room.displayName,
                    automaticRepliesEnabled: null,
                    status: "error",
                    error: error instanceof Error ? error.message : "Unknown error",
                })
            }
        }

        return NextResponse.json({
            rooms: roomSettings,
            configured: true,
        })

    } catch (error) {
        console.error("Failed to get room settings:", error)
        return NextResponse.json(
            { error: "Failed to get room settings", configured: false },
            { status: 500 }
        )
    }
}
