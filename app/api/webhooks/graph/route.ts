import { NextRequest, NextResponse } from "next/server"
import { getRoomEvent, sendEmail } from "@/lib/microsoft-graph"
import { renderAcceptedEmail, renderDeclinedEmail } from "@/lib/email-templates"
import { createClient } from "@/lib/supabase/server"

// Store processed notifications to ensure idempotency (prevents duplicate webhook processing)
const processedNotifications = new Map<string, number>()

// Store events for which we've already sent email notifications (prevents duplicate emails)
const emailsSentForEvents = new Map<string, number>()

// Clean up old entries periodically (keep last 24 hours)
function cleanupProcessedEvents() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  for (const [key, timestamp] of processedNotifications.entries()) {
    if (timestamp < cutoff) {
      processedNotifications.delete(key)
    }
  }
  for (const [key, timestamp] of emailsSentForEvents.entries()) {
    if (timestamp < cutoff) {
      emailsSentForEvents.delete(key)
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
      const lastProcessed = processedNotifications.get(idempotencyKey)
      const thirtySecondsAgo = Date.now() - 30000

      if (lastProcessed && lastProcessed > thirtySecondsAgo) {
        console.log(`[WEBHOOK] Skipping duplicate notification (processed ${Math.round((Date.now() - lastProcessed) / 1000)}s ago): ${idempotencyKey}`)
        return
      }

      // Mark as processed
      processedNotifications.set(idempotencyKey, Date.now())
      console.log(`[WEBHOOK] Processing notification: ${idempotencyKey}`)

      // Clean up periodically
      if (processedNotifications.size > 1000) {
        cleanupProcessedEvents()
      }

      try {
        await processNotification(notification)
      } catch (error) {
        console.error(`[WEBHOOK] Error processing notification ${idempotencyKey}:`, error)
        // Remove from processed so it can be retried
        processedNotifications.delete(idempotencyKey)
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
  // Parse resource path - Microsoft sends: Users/{userId}/Events/{eventId}
  // The regex handles both formats: /users/email/events/ and Users/guid/Events/
  const resourceMatch = notification.resource.match(/[Uu]sers\/([^/]+)\/[Ee]vents\/([^/]+)/)
  if (!resourceMatch) {
    console.error("[WEBHOOK] Could not parse resource path:", notification.resource)
    return
  }

  const [, userIdOrEmail, eventId] = resourceMatch
  console.log(`[WEBHOOK] User/Room ID: ${userIdOrEmail}, Event: ${eventId}, ChangeType: ${notification.changeType}`)

  // The userIdOrEmail might be a GUID (user ID) not an email address
  // We need to look up the room email from the subscription or use the user ID directly
  // For now, use the subscription to find the room email, or query the event to get the room
  let roomEmail = userIdOrEmail

  // If it looks like a GUID, we need to fetch the event to get the actual room email
  const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userIdOrEmail)
  if (isGuid) {
    console.log(`[WEBHOOK] User ID is a GUID, will use it directly for API calls`)
    // We can use the GUID directly with Graph API, but for settings lookup we need the email
    // Try to get it from the event later
  }

  console.log(`[WEBHOOK] Processing event ${eventId} for user ${roomEmail}`)

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

  // Fetch the full event details using the user ID or email
  console.log(`[WEBHOOK] Fetching event details for user ${userIdOrEmail}, event ${eventId}`)
  const event = await getRoomEvent(userIdOrEmail, eventId)
  console.log(`[WEBHOOK] Event fetched:`, JSON.stringify({
    id: event.id,
    subject: event.subject,
    responseStatus: event.responseStatus,
    organizer: event.organizer?.emailAddress?.address,
    location: event.location?.displayName,
  }))

  // Get the room email from the event attendees or location if we only have a GUID
  if (isGuid && event.attendees) {
    const roomAttendee = event.attendees.find(a => a.type === "resource")
    if (roomAttendee?.emailAddress?.address) {
      roomEmail = roomAttendee.emailAddress.address
      console.log(`[WEBHOOK] Found room email from attendees: ${roomEmail}`)
    }
  }

  // Get the notification email address (service mailbox)
  const notificationMailbox = process.env.NOTIFICATION_MAILBOX
  console.log(`[WEBHOOK] NOTIFICATION_MAILBOX:`, notificationMailbox ? "configured" : "NOT configured")
  if (!notificationMailbox) {
    console.error("NOTIFICATION_MAILBOX not configured")
    return
  }

  // Determine the outcome and send appropriate notification
  const organizerEmail = event.organizer.emailAddress.address
  const roomName = event.location?.displayName || roomEmail
  const responseStatus = event.responseStatus?.response

  console.log(`[WEBHOOK] ====== RESPONSE STATUS CHECK ======`)
  console.log(`[WEBHOOK] Response status: "${responseStatus}"`)
  console.log(`[WEBHOOK] Change type: "${notification.changeType}"`)
  console.log(`[WEBHOOK] Organizer: ${organizerEmail}`)
  console.log(`[WEBHOOK] Room: ${roomName}`)
  console.log(`[WEBHOOK] Subject: ${event.subject}`)
  console.log(`[WEBHOOK] isCancelled: ${event.isCancelled}`)

  // Check if the event is canceled - skip sending confirmation emails for canceled events
  // Microsoft sends "updated" notifications when events are canceled, not "deleted"
  // The event may have isCancelled=true or the subject may start with "Canceled:"
  const isCanceled = event.isCancelled === true ||
    event.subject?.toLowerCase().startsWith("canceled:") ||
    event.subject?.toLowerCase().startsWith("cancelled:")

  if (isCanceled) {
    console.log(`[WEBHOOK] Event is CANCELED - skipping notification email`)
    return
  }

  // If the event is newly created and not yet processed, wait briefly and retry
  // Exchange auto-accept typically happens within 1-2 seconds
  if (notification.changeType === "created" && (!responseStatus || responseStatus === "none" || responseStatus === "notResponded")) {
    console.log(`[WEBHOOK] Event status is "${responseStatus}" for newly created event. Waiting 2s for room to process...`)

    // Wait 2 seconds for Exchange to process
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Re-fetch the event to check if status updated
    const updatedEvent = await getRoomEvent(userIdOrEmail, eventId)
    const updatedStatus = updatedEvent.responseStatus?.response

    console.log(`[WEBHOOK] After retry, status is now: "${updatedStatus}"`)

    if (updatedStatus === "accepted" || updatedStatus === "tentativelyAccepted") {
      // Check if we already sent an email for this event
      if (emailsSentForEvents.has(eventId)) {
        console.log(`[WEBHOOK] Already sent email for event ${eventId}, skipping duplicate`)
        return
      }

      // Process as accepted
      if (!sendAcceptanceNotifications) {
        console.log(`[WEBHOOK] Acceptance notifications disabled, skipping`)
        return
      }

      console.log(`[WEBHOOK] Event now ACCEPTED after retry - sending notification`)
      const htmlContent = renderAcceptedEmail({
        organizerName: updatedEvent.organizer.emailAddress.name,
        roomName,
        subject: updatedEvent.subject,
        startTime: updatedEvent.start.dateTime,
        endTime: updatedEvent.end.dateTime,
        timeZone: updatedEvent.start.timeZone,
      })

      try {
        await sendEmail(
          notificationMailbox,
          organizerEmail,
          `Room Confirmed: ${roomName} - ${updatedEvent.subject}`,
          htmlContent
        )
        emailsSentForEvents.set(eventId, Date.now())
        console.log(`[WEBHOOK] SUCCESS: Sent acceptance email after retry`)
      } catch (emailError) {
        console.error(`[WEBHOOK] FAILED to send acceptance email:`, emailError)
      }
      return
    } else if (updatedStatus === "declined") {
      // Check if we already sent an email for this event
      if (emailsSentForEvents.has(eventId)) {
        console.log(`[WEBHOOK] Already sent email for event ${eventId}, skipping duplicate`)
        return
      }

      // Process as declined
      if (!sendDeclineNotifications) {
        console.log(`[WEBHOOK] Decline notifications disabled, skipping`)
        return
      }

      console.log(`[WEBHOOK] Event DECLINED after retry - sending notification`)
      const htmlContent = renderDeclinedEmail({
        organizerName: updatedEvent.organizer.emailAddress.name,
        roomName,
        subject: updatedEvent.subject,
        startTime: updatedEvent.start.dateTime,
        endTime: updatedEvent.end.dateTime,
        timeZone: updatedEvent.start.timeZone,
        reason: "The room has a scheduling conflict with an existing booking.",
      })

      try {
        await sendEmail(
          notificationMailbox,
          organizerEmail,
          `Room Unavailable: ${roomName} - ${updatedEvent.subject}`,
          htmlContent
        )
        emailsSentForEvents.set(eventId, Date.now())
        console.log(`[WEBHOOK] SUCCESS: Sent decline email after retry`)
      } catch (emailError) {
        console.error(`[WEBHOOK] FAILED to send decline email:`, emailError)
      }
      return
    } else {
      console.log(`[WEBHOOK] Status still "${updatedStatus}" after retry. Room may be slow to process or manually managed.`)
      return
    }
  }

  if (responseStatus === "accepted") {
    // Check if we already sent an email for this event
    if (emailsSentForEvents.has(eventId)) {
      console.log(`[WEBHOOK] Already sent email for event ${eventId}, skipping duplicate`)
      return
    }

    if (!sendAcceptanceNotifications) {
      console.log(`[WEBHOOK] Event ACCEPTED but acceptance notifications are disabled, skipping`)
      return
    }
    console.log(`[WEBHOOK] Event ACCEPTED - preparing acceptance notification`)
    console.log(`[WEBHOOK] Sending to: ${organizerEmail}, From: ${notificationMailbox}`)
    console.log(`[WEBHOOK] Event timezone from Graph: "${event.start.timeZone}"`)
    console.log(`[WEBHOOK] Event start dateTime: "${event.start.dateTime}"`)

    // Send acceptance notification
    const htmlContent = renderAcceptedEmail({
      organizerName: event.organizer.emailAddress.name,
      roomName,
      subject: event.subject,
      startTime: event.start.dateTime,
      endTime: event.end.dateTime,
      timeZone: event.start.timeZone || "America/New_York",
    })

    try {
      console.log(`[WEBHOOK] Calling sendEmail via Graph API...`)
      await sendEmail(
        notificationMailbox,
        organizerEmail,
        `Room Confirmed: ${roomName} - ${event.subject}`,
        htmlContent
      )
      emailsSentForEvents.set(eventId, Date.now())
      console.log(`[WEBHOOK] SUCCESS: Sent acceptance email for event ${eventId} to ${organizerEmail}`)
    } catch (emailError) {
      console.error(`[WEBHOOK] FAILED to send acceptance email:`, emailError)
      console.error(`[WEBHOOK] Error details:`, JSON.stringify(emailError, Object.getOwnPropertyNames(emailError)))
    }
  } else if (responseStatus === "declined") {
    // Check if we already sent an email for this event
    if (emailsSentForEvents.has(eventId)) {
      console.log(`[WEBHOOK] Already sent email for event ${eventId}, skipping duplicate`)
      return
    }

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
      emailsSentForEvents.set(eventId, Date.now())
      console.log(`[WEBHOOK] SUCCESS: Sent decline email for event ${eventId} to ${organizerEmail}`)
    } catch (emailError) {
      console.error(`[WEBHOOK] FAILED to send decline email:`, emailError)
      console.error(`[WEBHOOK] Error details:`, JSON.stringify(emailError, Object.getOwnPropertyNames(emailError)))
    }
  } else if (responseStatus === "tentativelyAccepted") {
    // Check if we already sent an email for this event
    if (emailsSentForEvents.has(eventId)) {
      console.log(`[WEBHOOK] Already sent email for event ${eventId}, skipping duplicate`)
      return
    }

    console.log(`[WEBHOOK] Event TENTATIVELY ACCEPTED - treating as accepted for notification purposes`)
    // Send acceptance notification for tentatively accepted
    if (!sendAcceptanceNotifications) {
      console.log(`[WEBHOOK] Acceptance notifications disabled, skipping`)
      return
    }
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
      emailsSentForEvents.set(eventId, Date.now())
      console.log(`[WEBHOOK] SUCCESS: Sent acceptance email for tentatively accepted event to ${organizerEmail}`)
    } catch (emailError) {
      console.error(`[WEBHOOK] FAILED to send email:`, emailError)
    }
  } else {
    console.log(`[WEBHOOK] Event response status is "${responseStatus}" - not accepted/declined/tentativelyAccepted`)
    console.log(`[WEBHOOK] No email will be sent for this notification. Possible statuses: none, notResponded, organizer`)
    console.log(`[WEBHOOK] If this is a new booking, an "updated" notification should follow when the room processes it.`)
  }
}

// GET endpoint for health checks and diagnostics
export async function GET() {
  const notificationMailbox = process.env.NOTIFICATION_MAILBOX
  const webhookUrl = process.env.WEBHOOK_URL

  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    processedNotificationsCount: processedNotifications.size,
    emailsSentCount: emailsSentForEvents.size,
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
