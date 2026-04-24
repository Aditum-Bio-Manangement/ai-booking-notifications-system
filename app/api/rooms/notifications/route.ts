import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { disableRoomAutoReply } from "@/lib/microsoft-graph"

// Get notification settings for all rooms or a specific room
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const roomId = request.nextUrl.searchParams.get("roomId")

    if (roomId) {
      const { data, error } = await supabase
        .from("room_notification_settings")
        .select("*")
        .eq("room_id", roomId)
        .single()

      if (error && error.code !== "PGRST116") {
        throw error
      }

      return NextResponse.json({
        settings: data || {
          room_id: roomId,
          custom_notifications_enabled: false,
          suppress_exchange_notifications: false,
        },
      })
    }

    const { data, error } = await supabase
      .from("room_notification_settings")
      .select("*")

    if (error) throw error

    return NextResponse.json({ settings: data || [] })
  } catch (error) {
    console.error("Failed to get notification settings:", error)
    return NextResponse.json(
      { error: "Failed to get notification settings" },
      { status: 500 }
    )
  }
}

// Update notification settings for a room
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { 
      roomId, 
      roomEmail,
      customNotificationsEnabled, 
      suppressExchangeNotifications 
    } = body

    if (!roomId) {
      return NextResponse.json(
        { error: "roomId is required" },
        { status: 400 }
      )
    }

    // If suppressing Exchange notifications, disable auto-reply via Graph API
    if (suppressExchangeNotifications && roomEmail) {
      try {
        await disableRoomAutoReply(roomEmail)
      } catch (error) {
        console.error("Failed to disable Exchange auto-reply:", error)
        // Continue anyway - we'll still enable custom notifications
      }
    }

    // Upsert the settings in the database
    const { data, error } = await supabase
      .from("room_notification_settings")
      .upsert({
        room_id: roomId,
        room_email: roomEmail,
        custom_notifications_enabled: customNotificationsEnabled,
        suppress_exchange_notifications: suppressExchangeNotifications,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "room_id",
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      settings: data,
    })
  } catch (error) {
    console.error("Failed to update notification settings:", error)
    return NextResponse.json(
      { error: "Failed to update notification settings" },
      { status: 500 }
    )
  }
}

// Bulk update notification settings for multiple rooms
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { 
      roomIds, 
      customNotificationsEnabled, 
      suppressExchangeNotifications,
      roomEmails // Array of {id, email} objects
    } = body

    if (!roomIds || !Array.isArray(roomIds)) {
      return NextResponse.json(
        { error: "roomIds array is required" },
        { status: 400 }
      )
    }

    // If suppressing Exchange notifications, disable auto-reply via Graph API
    if (suppressExchangeNotifications && roomEmails) {
      const disablePromises = roomEmails.map(async (room: { id: string; email: string }) => {
        try {
          await disableRoomAutoReply(room.email)
        } catch (error) {
          console.error(`Failed to disable Exchange auto-reply for ${room.email}:`, error)
        }
      })
      await Promise.allSettled(disablePromises)
    }

    // Bulk upsert the settings
    const settingsToUpsert = roomIds.map((roomId: string) => {
      const roomData = roomEmails?.find((r: { id: string }) => r.id === roomId)
      return {
        room_id: roomId,
        room_email: roomData?.email || null,
        custom_notifications_enabled: customNotificationsEnabled,
        suppress_exchange_notifications: suppressExchangeNotifications,
        updated_at: new Date().toISOString(),
      }
    })

    const { data, error } = await supabase
      .from("room_notification_settings")
      .upsert(settingsToUpsert, {
        onConflict: "room_id",
      })
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      settings: data,
      updatedCount: roomIds.length,
    })
  } catch (error) {
    console.error("Failed to bulk update notification settings:", error)
    return NextResponse.json(
      { error: "Failed to bulk update notification settings" },
      { status: 500 }
    )
  }
}
