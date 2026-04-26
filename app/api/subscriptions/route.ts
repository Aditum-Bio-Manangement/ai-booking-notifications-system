import { NextRequest, NextResponse } from "next/server"
import {
  createSubscription,
  deleteSubscription,
  listSubscriptions,
  renewSubscription,
} from "@/lib/microsoft-graph"
import { createAdminClient } from "@/lib/supabase/admin"

// In-memory storage for mock subscriptions (in production, use a database)
let mockSubscriptions: Array<{
  id: string
  roomEmail: string
  resource: string
  expiresAt: string
  status: "active" | "expired"
}> = []

const isGraphConfigured = () => {
  // Check both naming conventions for Azure AD credentials
  const clientId = process.env.AZURE_AD_CLIENT_ID || process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET
  const tenantId = process.env.AZURE_AD_TENANT_ID || process.env.AZURE_TENANT_ID
  return !!(clientId && clientSecret && tenantId)
}

// Helper to save subscription to Supabase
async function saveSubscriptionToDb(subscription: {
  id: string
  roomEmail: string
  resource: string
  expiresAt: string
  notificationUrl: string
  changeType?: string
  clientState?: string
}) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      console.error("[SUBSCRIPTION] Supabase admin client not available")
      return
    }

    // Calculate duration in hours from expiresAt
    const expiresAtDate = new Date(subscription.expiresAt)
    const now = new Date()
    const durationHours = Math.round((expiresAtDate.getTime() - now.getTime()) / (1000 * 60 * 60))

    const { error } = await supabase
      .from("subscriptions")
      .upsert({
        id: subscription.id,
        roomEmail: subscription.roomEmail,
        resource: subscription.resource,
        expiresAt: subscription.expiresAt,
        notificationUrl: subscription.notificationUrl || "",
        durationHours: durationHours > 0 ? durationHours : 72,
        clientState: subscription.clientState || null,
      }, { onConflict: "id" })

    if (error) {
      console.error("[SUBSCRIPTION] Failed to save to database:", error)
    } else {
      console.log("[SUBSCRIPTION] Saved to database:", subscription.id)
    }
  } catch (error) {
    console.error("[SUBSCRIPTION] Database save error:", error)
  }
}

// Helper to delete subscription from Supabase
async function deleteSubscriptionFromDb(subscriptionId: string) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      console.error("[SUBSCRIPTION] Supabase admin client not available")
      return
    }

    const { error } = await supabase
      .from("subscriptions")
      .delete()
      .eq("id", subscriptionId)

    if (error) {
      console.error("[SUBSCRIPTION] Failed to delete from database:", error)
    } else {
      console.log("[SUBSCRIPTION] Deleted from database:", subscriptionId)
    }
  } catch (error) {
    console.error("[SUBSCRIPTION] Database delete error:", error)
  }
}

export async function GET() {
  try {
    if (!isGraphConfigured()) {
      // Return mock subscriptions when Graph is not configured
      // Update status based on expiration
      mockSubscriptions = mockSubscriptions.map((sub) => ({
        ...sub,
        status: new Date(sub.expiresAt) > new Date() ? "active" : "expired",
      }))

      return NextResponse.json({
        subscriptions: mockSubscriptions,
        configured: false,
        message: "Running in demo mode - subscriptions are stored locally"
      })
    }

    const subscriptions = await listSubscriptions()

    // Transform to our format
    const transformedSubs = subscriptions.map((sub) => ({
      id: sub.id,
      roomEmail: sub.resource.replace("/users/", "").replace("/events", ""),
      resource: sub.resource,
      changeType: sub.changeType,
      expiresAt: sub.expirationDateTime,
      notificationUrl: sub.notificationUrl,
      status: new Date(sub.expirationDateTime) > new Date() ? "active" : "expired",
    }))

    return NextResponse.json({ subscriptions: transformedSubs, configured: true })
  } catch (error) {
    console.error("Error fetching subscriptions:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscriptions", message: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { roomEmail, notificationUrl, durationHours } = body

    if (!roomEmail) {
      return NextResponse.json(
        { error: "roomEmail is required" },
        { status: 400 }
      )
    }

    // Convert hours to minutes (default to 72 hours = 4320 minutes, max is 70.5 hours = 4230 minutes)
    const durationMinutes = durationHours ? Math.min(durationHours * 60, 4230) : 4230

    if (!isGraphConfigured()) {
      // Create mock subscription with specified duration
      const mockClientState = crypto.randomUUID()
      const mockSub = {
        id: crypto.randomUUID(),
        roomEmail,
        resource: `/users/${roomEmail}/events`,
        expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
        status: "active" as const,
        clientState: mockClientState,
      }

      mockSubscriptions.push(mockSub)

      // Save to database even in demo mode
      await saveSubscriptionToDb({
        id: mockSub.id,
        roomEmail,
        resource: mockSub.resource,
        expiresAt: mockSub.expiresAt,
        notificationUrl: "demo-mode",
        changeType: "created,updated,deleted",
        clientState: mockClientState,
      })

      return NextResponse.json({
        subscription: mockSub,
        message: "Demo subscription created (no actual Graph webhook)"
      })
    }

    // Use environment variable for notification URL or provided one
    const webhookUrl = notificationUrl || process.env.WEBHOOK_URL || `${process.env.VERCEL_URL || "http://localhost:3000"}/api/webhooks/graph`

    console.log(`[SUBSCRIPTION] Creating subscription for room: ${roomEmail}`)
    console.log(`[SUBSCRIPTION] Webhook URL: ${webhookUrl}`)

    // Generate a client state for validation
    const clientState = crypto.randomUUID()

    try {
      const subscription = await createSubscription(roomEmail, webhookUrl, clientState, durationMinutes)

      console.log(`[SUBSCRIPTION] Successfully created subscription: ${subscription.id}`)
      console.log(`[SUBSCRIPTION] Expires at: ${subscription.expirationDateTime}`)

      // Save to Supabase database
      await saveSubscriptionToDb({
        id: subscription.id,
        roomEmail,
        resource: subscription.resource,
        expiresAt: subscription.expirationDateTime,
        notificationUrl: webhookUrl,
        changeType: subscription.changeType,
        clientState,
      })

      return NextResponse.json({
        subscription: {
          id: subscription.id,
          roomEmail,
          resource: subscription.resource,
          expiresAt: subscription.expirationDateTime,
          clientState,
          notificationUrl: webhookUrl,
        },
      })
    } catch (subError) {
      console.error(`[SUBSCRIPTION] Failed to create subscription:`, subError)
      throw subError
    }
  } catch (error) {
    console.error("Error creating subscription:", error)
    return NextResponse.json(
      { error: "Failed to create subscription", message: String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { subscriptionId, durationHours } = body

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId is required" },
        { status: 400 }
      )
    }

    // Convert hours to minutes (default to max 4230 minutes)
    const durationMinutes = durationHours ? Math.min(durationHours * 60, 4230) : 4230

    if (!isGraphConfigured()) {
      // Renew mock subscription
      const subIndex = mockSubscriptions.findIndex((s) => s.id === subscriptionId)
      if (subIndex === -1) {
        return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
      }

      mockSubscriptions[subIndex] = {
        ...mockSubscriptions[subIndex],
        expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
        status: "active",
      }

      return NextResponse.json({
        subscription: mockSubscriptions[subIndex],
        message: "Demo subscription renewed"
      })
    }

    const subscription = await renewSubscription(subscriptionId, durationMinutes)

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        expiresAt: subscription.expirationDateTime,
      },
    })
  } catch (error) {
    console.error("Error renewing subscription:", error)
    return NextResponse.json(
      { error: "Failed to renew subscription", message: String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { subscriptionId } = body

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId is required" },
        { status: 400 }
      )
    }

    if (!isGraphConfigured()) {
      // Delete mock subscription
      const subIndex = mockSubscriptions.findIndex((s) => s.id === subscriptionId)
      if (subIndex === -1) {
        return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
      }

      mockSubscriptions.splice(subIndex, 1)

      // Delete from database too
      await deleteSubscriptionFromDb(subscriptionId)

      return NextResponse.json({ success: true, message: "Demo subscription deleted" })
    }

    await deleteSubscription(subscriptionId)

    // Delete from Supabase database
    await deleteSubscriptionFromDb(subscriptionId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting subscription:", error)
    return NextResponse.json(
      { error: "Failed to delete subscription", message: String(error) },
      { status: 500 }
    )
  }
}
