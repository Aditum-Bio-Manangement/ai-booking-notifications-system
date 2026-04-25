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
  console.log("[WEBHOOK] POST request received at", new Date().toISOString())

  try {
    // Handle validation request from Microsoft Graph
    const validationToken = request.nextUrl.searchParams.get("validationToken")
    if (validationToken) {
      console.log("[WEBHOOK] Validation request received, responding with token")
      return new NextResponse(validationToken, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      })
    }

    const body = await request.json()
    console.log("[WEBHOOK] Received body:", JSON.stringify(body, null, 2))

    const notifications: GraphNotification[] = body.value || []
    console.log(`[WEBHOOK] Processing ${notifications.length} notification(s)`)

    // Process each notification asynchronously
    // Respond quickly to Microsoft Graph (they expect < 3 seconds)
    const processPromises = notifications.map(async (notification) => {
      // Create idempotency key - include a short time window to allow reprocessing
      // Microsoft may send the same notification multiple times quickly
      const idempotencyKey = `${notification.subscriptionId}-${notification.resourceData.id}-${notification.changeType}`

      // Check if already processed recently (within last 30 seconds)
      const lastProcessed = processedEvents.get(idempotencyKey)
      const thirtySecondsAgo = Date.now() - 30000

      if (lastProcessed && lastProcessed > thirtySecondsAgo) {
        console.log(`[WEBHOOK] Skipping duplicate notification (processed ${Math.round((Date.now() - lastProcessed) / 1000)}s ago): ${idempotencyKey}`)
        return
      }

      // Mark as processed
      processedEvents.set(idempotencyKey, Date.now())
      console.log(`[WEBHOOK] Processing notification: ${idempotencyKey}`)

      // Clean up periodically
      if (processedEvents.size > 1000) {
        cleanupProcessedEvents()
      }

      try {
        await processNotification(notification)
      } catch (error) {
        console.error(`[WEBHOOK] Error processing notification ${idempotencyKey}:`, error)
        // Remove from processed so it can be retried
        processedEvents.delete(idempotencyKey)
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
  console.log("[WEBHOOK] Processing notification:", JSON.stringify(notification, null, 2))

  // Extract room email from resource path
  // Format: /users/{email}/events/{eventId}
  const resourceMatch = notification.resource.match(/\/users\/([^/]+)\/events\/([^/]+)/)
  if (!resourceMatch) {
    console.error("[WEBHOOK] Could not parse resource path:", notification.resource)
    return
  }

  const [, roomEmail, eventId] = resourceMatch
  console.log(`[WEBHOOK] Room: ${roomEmail}, Event: ${eventId}, ChangeType: ${notification.changeType}`)

  // Skip deleted events
  if (notification.changeType === "deleted") {
    console.log(`[WEBHOOK] Event deleted: ${eventId} in room ${roomEmail}, skipping`)
    return
  }

  // Check if custom notifications are enabled
  // Default to ENABLED if no settings exist (so notifications work out of the box)
  let customNotificationsEnabled = true
  let sendAcceptanceNotifications = true
  let sendDeclineNotifications = true

  try {
    const supabase = await createClient()

    // First check room-specific settings
    const { data: roomSettings } = await supabase
      .from("room_notification_settings")
      .select("custom_notifications_enabled")
      .eq("room_email", roomEmail)
      .single()

    // If room-specific setting exists, use it
    if (roomSettings && roomSettings.custom_notifications_enabled !== null) {
      customNotificationsEnabled = roomSettings.custom_notifications_enabled
      console.log(`[WEBHOOK] Room-specific setting found: customNotificationsEnabled = ${customNotificationsEnabled}`)
    } else {
      // Check global settings
      const { data: globalSettings } = await supabase
        .from("global_notification_settings")
        .select("setting_key, setting_value")

      if (globalSettings && globalSettings.length > 0) {
        for (const setting of globalSettings) {
          if (setting.setting_key === "custom_notifications_enabled" && setting.setting_value?.enabled !== undefined) {
            customNotificationsEnabled = setting.setting_value.enabled
          }
          if (setting.setting_key === "send_acceptance_notifications" && setting.setting_value?.enabled !== undefined) {
            sendAcceptanceNotifications = setting.setting_value.enabled
          }
          if (setting.setting_key === "send_decline_notifications" && setting.setting_value?.enabled !== undefined) {
            sendDeclineNotifications = setting.setting_value.enabled
          }
        }
        console.log(`[WEBHOOK] Global settings: customNotificationsEnabled=${customNotificationsEnabled}, sendAcceptance=${sendAcceptanceNotifications}, sendDecline=${sendDeclineNotifications}`)
      } else {
        console.log(`[WEBHOOK] No settings found in database, using defaults (all enabled)`)
      }
    }
  } catch (error) {
    // If database tables don't exist or query fails, default to enabled
    console.log("[WEBHOOK] Could not check notification settings, defaulting to enabled:", error)
  }

  if (!customNotificationsEnabled) {
    console.log(`[WEBHOOK] Custom notifications disabled for room ${roomEmail}, skipping email`)
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
    if (!sendAcceptanceNotifications) {
      console.log(`[WEBHOOK] Event ACCEPTED but acceptance notifications are disabled, skipping`)
      return
    }
    console.log(`[WEBHOOK] Event ACCEPTED - preparing acceptance notification`)
    console.log(`[WEBHOOK] Sending to: ${organizerEmail}, From: ${notificationMailbox}`)

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
      console.log(`[WEBHOOK] Calling sendEmail via Graph API...`)
      await sendEmail(
        notificationMailbox,
        organizerEmail,
        `Room Confirmed: ${roomName} - ${event.subject}`,
        htmlContent
      )
      console.log(`[WEBHOOK] SUCCESS: Sent acceptance email for event ${eventId} to ${organizerEmail}`)
    } catch (emailError) {
      console.error(`[WEBHOOK] FAILED to send acceptance email:`, emailError)
      console.error(`[WEBHOOK] Error details:`, JSON.stringify(emailError, Object.getOwnPropertyNames(emailError)))
    }
  } else if (event.responseStatus?.response === "declined") {
    if (!sendDeclineNotifications) {
      console.log(`[WEBHOOK] Event DECLINED but decline notifications are disabled, skipping`)
      return
    }
    console.log(`[WEBHOOK] Event DECLINED - preparing decline notification`)
    console.log(`[WEBHOOK] Sending to: ${organizerEmail}, From: ${notificationMailbox}`)

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
      console.log(`[WEBHOOK] Calling sendEmail via Graph API...`)
      await sendEmail(
        notificationMailbox,
        organizerEmail,
        `Room Unavailable: ${roomName} - ${event.subject}`,
        htmlContent
      )
      console.log(`[WEBHOOK] SUCCESS: Sent decline email for event ${eventId} to ${organizerEmail}`)
    } catch (emailError) {
      console.error(`[WEBHOOK] FAILED to send decline email:`, emailError)
      console.error(`[WEBHOOK] Error details:`, JSON.stringify(emailError, Object.getOwnPropertyNames(emailError)))
    }
  } else {
    console.log(`[WEBHOOK] Event response status is "${event.responseStatus?.response}" - not accepted/declined, skipping email`)
  }
}

// GET endpoint for health checks and diagnostics
export async function GET() {
  const notificationMailbox = process.env.NOTIFICATION_MAILBOX
  const webhookUrl = process.env.WEBHOOK_URL

  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    processedEventsCount: processedEvents.size,
    diagnostics: {
      notificationMailbox: notificationMailbox ? `configured (${notificationMailbox})` : "NOT CONFIGURED - emails will not send",
      webhookUrl: webhookUrl ? `configured (${webhookUrl})` : "NOT CONFIGURED",
      azureClientId: process.env.AZURE_CLIENT_ID ? "configured" : "NOT CONFIGURED",
      azureClientSecret: process.env.AZURE_CLIENT_SECRET ? "configured" : "NOT CONFIGURED",
      azureTenantId: process.env.AZURE_TENANT_ID ? "configured" : "NOT CONFIGURED",
    },
    hint: "POST to this endpoint to receive webhook notifications from Microsoft Graph",
  })
}
