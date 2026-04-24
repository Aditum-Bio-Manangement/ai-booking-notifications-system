import { NextRequest, NextResponse } from "next/server"
import { getRoomEvent, sendEmail } from "@/lib/microsoft-graph"
import { renderAcceptedEmail, renderDeclinedEmail } from "@/lib/email-templates"
import { createClient } from "@/lib/supabase/server"

// Store processed events to ensure idempotency
const processedEvents = new Map<string, number>()

// Clean up old entries periodically (keep last 24 hours)
function cleanupProcessedEvents() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  for (const [key, timestamp] of processedEvents.entries()) {
    if (timestamp < cutoff) {
      processedEvents.delete(key)
    }
  }
}

interface GraphNotification {
  subscriptionId: string
  subscriptionExpirationDateTime: string
  changeType: "created" | "updated" | "deleted"
  resource: string
  resourceData: {
    "@odata.type": string
    "@odata.id": string
    "@odata.etag": string
    id: string
  }
  clientState?: string
  tenantId: string
}

export async function POST(request: NextRequest) {
  try {
    // Handle validation request from Microsoft Graph
    const validationToken = request.nextUrl.searchParams.get("validationToken")
    if (validationToken) {
      return new NextResponse(validationToken, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      })
    }

    const body = await request.json()
    const notifications: GraphNotification[] = body.value || []

    // Process each notification asynchronously
    // Respond quickly to Microsoft Graph (they expect < 3 seconds)
    const processPromises = notifications.map(async (notification) => {
      // Create idempotency key
      const idempotencyKey = `${notification.subscriptionId}-${notification.resourceData.id}-${notification.changeType}`
      
      // Check if already processed
      if (processedEvents.has(idempotencyKey)) {
        console.log(`Skipping duplicate notification: ${idempotencyKey}`)
        return
      }
      
      // Mark as processed
      processedEvents.set(idempotencyKey, Date.now())
      
      // Clean up periodically
      if (processedEvents.size > 1000) {
        cleanupProcessedEvents()
      }

      try {
        await processNotification(notification)
      } catch (error) {
        console.error(`Error processing notification ${idempotencyKey}:`, error)
        // Don't throw - we want to return 202 to Graph even if processing fails
        // The event can be retried or handled via dead letter queue
      }
    })

    // Fire and forget - don't await all promises
    // This ensures we respond quickly to Microsoft Graph
    Promise.all(processPromises).catch(console.error)

    return NextResponse.json({ status: "accepted" }, { status: 202 })
  } catch (error) {
    console.error("Webhook error:", error)
    // Still return 202 to prevent Graph from retrying
    return NextResponse.json({ status: "accepted" }, { status: 202 })
  }
}

async function processNotification(notification: GraphNotification) {
  // Extract room email from resource path
  // Format: /users/{email}/events/{eventId}
  const resourceMatch = notification.resource.match(/\/users\/([^/]+)\/events\/([^/]+)/)
  if (!resourceMatch) {
    console.error("Could not parse resource path:", notification.resource)
    return
  }

  const [, roomEmail, eventId] = resourceMatch

  // Skip deleted events
  if (notification.changeType === "deleted") {
    console.log(`Event deleted: ${eventId} in room ${roomEmail}`)
    return
  }

  // Check if custom notifications are enabled
  // Default to ENABLED if no settings exist (so notifications work out of the box)
  let customNotificationsEnabled = true
  
  try {
    const supabase = await createClient()
    
    // First check room-specific settings
    const { data: roomSettings } = await supabase
      .from("room_notification_settings")
      .select("custom_notifications_enabled")
      .eq("room_email", roomEmail)
      .single()

    // If room-specific setting exists, use it
    if (roomSettings) {
      customNotificationsEnabled = roomSettings.custom_notifications_enabled
    } else {
      // Check global setting
      const { data: globalSettings } = await supabase
        .from("global_notification_settings")
        .select("setting_value")
        .eq("setting_key", "custom_notifications_enabled")
        .single()

      if (globalSettings?.setting_value?.enabled !== undefined) {
        customNotificationsEnabled = globalSettings.setting_value.enabled
      }
      // If no settings exist, keep default (enabled)
    }
  } catch (error) {
    // If database tables don't exist or query fails, default to enabled
    console.log("Could not check notification settings, defaulting to enabled:", error)
  }

  if (!customNotificationsEnabled) {
    console.log(`Custom notifications disabled for room ${roomEmail}, skipping`)
    return
  }

  // Fetch the full event details
  console.log(`[v0] Fetching event details for room ${roomEmail}, event ${eventId}`)
  const event = await getRoomEvent(roomEmail, eventId)
  console.log(`[v0] Event fetched:`, JSON.stringify({
    id: event.id,
    subject: event.subject,
    responseStatus: event.responseStatus,
    organizer: event.organizer?.emailAddress?.address,
  }))

  // Get the notification email address (service mailbox)
  const notificationMailbox = process.env.NOTIFICATION_MAILBOX
  console.log(`[v0] NOTIFICATION_MAILBOX:`, notificationMailbox ? "configured" : "NOT configured")
  if (!notificationMailbox) {
    console.error("NOTIFICATION_MAILBOX not configured")
    return
  }

  // Determine the outcome and send appropriate notification
  const organizerEmail = event.organizer.emailAddress.address
  const roomName = event.location?.displayName || roomEmail
  console.log(`[v0] Checking response status: ${event.responseStatus?.response}`)

  if (event.responseStatus?.response === "accepted") {
    console.log(`[v0] Event accepted - sending acceptance notification`)
    // Send acceptance notification
    const htmlContent = renderAcceptedEmail({
      organizerName: event.organizer.emailAddress.name,
      roomName,
      subject: event.subject,
      startTime: event.start.dateTime,
      endTime: event.end.dateTime,
      timeZone: event.start.timeZone,
    })

    try {
      await sendEmail(
        notificationMailbox,
        organizerEmail,
        `Room Confirmed: ${roomName} - ${event.subject}`,
        htmlContent
      )
      console.log(`[v0] Successfully sent acceptance email for event ${eventId} to ${organizerEmail}`)
    } catch (emailError) {
      console.error(`[v0] Failed to send acceptance email:`, emailError)
    }
  } else if (event.responseStatus?.response === "declined") {
    console.log(`[v0] Event declined - sending decline notification`)
    // Send decline notification
    const htmlContent = renderDeclinedEmail({
      organizerName: event.organizer.emailAddress.name,
      roomName,
      subject: event.subject,
      startTime: event.start.dateTime,
      endTime: event.end.dateTime,
      timeZone: event.start.timeZone,
      reason: "The room has a scheduling conflict with an existing booking.",
    })

    try {
      await sendEmail(
        notificationMailbox,
        organizerEmail,
        `Room Unavailable: ${roomName} - ${event.subject}`,
        htmlContent
      )
      console.log(`[v0] Successfully sent decline email for event ${eventId} to ${organizerEmail}`)
    } catch (emailError) {
      console.error(`[v0] Failed to send decline email:`, emailError)
    }
  } else {
    console.log(`[v0] Event response status not accepted/declined: ${event.responseStatus?.response}`)
  }
}

// GET endpoint for health checks
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    processedEventsCount: processedEvents.size,
  })
}
