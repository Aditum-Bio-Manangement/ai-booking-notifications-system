import { NextRequest, NextResponse } from "next/server"
import { createAuditLog, getAuditContext } from "@/lib/audit"

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        const { roomEmail, isHiddenFromGal, displayName, capacity } = body
        const { actorId, actorEmail } = getAuditContext(body)

        if (!roomEmail) {
            return NextResponse.json({ error: "Room email is required" }, { status: 400 })
        }

        // Note: Actually updating these properties requires Exchange Admin permissions
        // For now, we'll log the audit event and return success
        // The actual changes would need to be done via PowerShell or Exchange Admin Center

        // Log to audit log with actor info
        await createAuditLog({
            action: "room.settings_updated",
            actorId,
            actorEmail,
            resourceType: "room",
            resourceId: roomEmail,
            details: {
                isHiddenFromGal,
                displayName,
                capacity,
                note: "Requires Exchange Admin permissions to apply",
            },
        })

        return NextResponse.json({
            success: true,
            message: "Room update request logged. Note: Some changes require Exchange Admin permissions.",
            requiresExchangeAdmin: true,
        })
    } catch (error) {
        console.error("Failed to update room:", error)
        return NextResponse.json(
            { error: "Failed to update room" },
            { status: 500 }
        )
    }
}
