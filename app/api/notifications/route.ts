import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET - Fetch all notifications
export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        if (!supabase) {
            // Return empty array instead of error so UI doesn't break
            return NextResponse.json({ notifications: [] }, { status: 200 })
        }

        const searchParams = request.nextUrl.searchParams
        const limit = parseInt(searchParams.get("limit") || "100")
        const status = searchParams.get("status") // "all", "sent", "pending", "failed"

        let query = supabase
            .from("notifications")
            .select("*")
            .limit(limit)

        if (status === "sent") {
            query = query.eq("status", "sent")
        } else if (status === "pending") {
            query = query.eq("status", "pending")
        } else if (status === "failed") {
            query = query.eq("status", "failed")
        }

        const { data, error } = await query

        if (error) {
            console.error("Error fetching notifications:", error)
            // Return empty array on error so UI can show "no notifications" gracefully
            return NextResponse.json({ notifications: [], error: error.message }, { status: 200 })
        }

        return NextResponse.json({ notifications: data || [] })
    } catch (error) {
        console.error("Error in notifications GET:", error)
        return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
    }
}

// POST - Create a new notification (for system notifications)
export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        if (!supabase) {
            return NextResponse.json({ error: "Database not configured" }, { status: 500 })
        }

        const body = await request.json()
        const { type, recipient_email, recipient_name, subject, body: notificationBody } = body

        if (!subject) {
            return NextResponse.json({ error: "Subject is required" }, { status: 400 })
        }

        const { data, error } = await supabase
            .from("notifications")
            .insert({
                type: type || "system",
                recipient_email: recipient_email || null,
                recipient_name: recipient_name || null,
                subject,
                body: notificationBody || "",
                status: "pending",
            })
            .select()
            .single()

        if (error) {
            console.error("Error creating notification:", error)
            return NextResponse.json({ error: "Failed to create notification" }, { status: 500 })
        }

        return NextResponse.json({ notification: data })
    } catch (error) {
        console.error("Error in notifications POST:", error)
        return NextResponse.json({ error: "Failed to create notification" }, { status: 500 })
    }
}

// DELETE - Delete a notification
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        if (!supabase) {
            return NextResponse.json({ error: "Database not configured" }, { status: 500 })
        }

        const searchParams = request.nextUrl.searchParams
        const id = searchParams.get("id")
        const clearAll = searchParams.get("clearAll") === "true"

        if (clearAll) {
            const { error } = await supabase
                .from("notifications")
                .delete()
                .neq("id", "00000000-0000-0000-0000-000000000000") // Delete all

            if (error) {
                console.error("Error clearing notifications:", error)
                return NextResponse.json({ error: "Failed to clear notifications" }, { status: 500 })
            }

            return NextResponse.json({ success: true })
        }

        if (!id) {
            return NextResponse.json({ error: "Notification ID is required" }, { status: 400 })
        }

        const { error } = await supabase
            .from("notifications")
            .delete()
            .eq("id", id)

        if (error) {
            console.error("Error deleting notification:", error)
            return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error in notifications DELETE:", error)
        return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 })
    }
}
