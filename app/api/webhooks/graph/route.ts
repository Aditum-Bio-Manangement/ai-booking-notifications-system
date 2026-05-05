import { NextRequest, NextResponse } from "next/server"
import { getRoomEvent, sendEmail, getUserTimezone, formatRecurrencePattern, formatSeriesDateRange, getSeriesConflicts } from "@/lib/microsoft-graph"
import { renderAcceptedEmail, renderDeclinedEmail, renderSeriesConflictEmail } from "@/lib/email-templates"
import { createAdminClient } from "@/lib/supabase/admin"

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

// Helper to extract series data from an event
function getSeriesData(event: { type?: string; recurrence?: Parameters<typeof formatRecurrencePattern>[0] }) {
  const isSeries = event.type === "seriesMaster" || event.type === "occurrence" || event.type === "exception" || !!event.recurrence



  if (!isSeries || !event.recurrence) {
    return { isSeries: false }
  }

  const recurrencePattern = formatRecurrencePattern(event.recurrence)
  const { startDate, endDate } = formatSeriesDateRange(event.recurrence)

  console.log(`[WEBHOOK] Series detected: pattern="${recurrencePattern}", range="${startDate} - ${endDate}"`)

  return {
    isSeries: true,
    recurrencePattern,
    seriesStartDate: startDate,
    seriesEndDate: endDate,
  }
}

// Helper to get series data, fetching series master if needed for occurrences
async function getSeriesDataAsync(
  event: { type?: string; recurrence?: Parameters<typeof formatRecurrencePattern>[0]; seriesMasterId?: string },
  roomEmail: string
): Promise<{ isSeries: boolean; recurrencePattern?: string; seriesStartDate?: string; seriesEndDate?: string }> {
  // An event is part of a series if:
  // 1. It has type "seriesMaster", "occurrence", or "exception"
  // 2. It has recurrence data (meaning it IS the series master)
  // 3. It has a seriesMasterId (meaning it's an occurrence/exception of a series)
  const isSeries = event.type === "seriesMaster" || event.type === "occurrence" || event.type === "exception" || !!event.recurrence || !!event.seriesMasterId

  console.log(`[WEBHOOK] getSeriesDataAsync: type="${event.type}", hasRecurrence=${!!event.recurrence}, seriesMasterId="${event.seriesMasterId}", isSeries=${isSeries}`)

  // If this has a seriesMasterId (even without a recognized type), fetch the series master
  if (event.seriesMasterId && !event.recurrence) {
    console.log(`[WEBHOOK] Fetching series master ${event.seriesMasterId} for recurrence data`)
    try {
      const seriesMaster = await getRoomEvent(roomEmail, event.seriesMasterId)
      console.log(`[WEBHOOK] Series master fetched: hasRecurrence=${!!seriesMaster.recurrence}, pattern=${seriesMaster.recurrence?.pattern?.type}`)
      if (seriesMaster.recurrence) {
        const recurrencePattern = formatRecurrencePattern(seriesMaster.recurrence)
        const { startDate, endDate } = formatSeriesDateRange(seriesMaster.recurrence)
        console.log(`[WEBHOOK] Series pattern: "${recurrencePattern}", range: ${startDate} - ${endDate}`)

        return {
          isSeries: true,
          recurrencePattern,
          seriesStartDate: startDate,
          seriesEndDate: endDate,
        }
      }
    } catch (error) {
      console.error(`[WEBHOOK] Failed to fetch series master:`, error)
    }
  }

  // Use local recurrence data if available
  if (!isSeries || !event.recurrence) {
    console.log(`[WEBHOOK] getSeriesDataAsync returning: isSeries=${isSeries}, hasRecurrence=${!!event.recurrence}`)
    return { isSeries }
  }

  const recurrencePattern = formatRecurrencePattern(event.recurrence)
  const { startDate, endDate } = formatSeriesDateRange(event.recurrence)



  return {
    isSeries: true,
    recurrencePattern,
    seriesStartDate: startDate,
    seriesEndDate: endDate,
  }
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
    const supabase = createAdminClient()

    if (!supabase) {
      console.log("[WEBHOOK] Supabase not configured, using default settings")
    } else {
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
    type: event.type,
    seriesMasterId: event.seriesMasterId,
    hasRecurrence: !!event.recurrence,
    recurrencePattern: event.recurrence?.pattern?.type,
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
      const retryAcceptTimezone = await getUserTimezone(organizerEmail)
      const seriesData = await getSeriesDataAsync(updatedEvent, roomEmail)

      // For series events, check for conflicts with existing bookings
      let retryConflictDates: Array<{ date: string; startTime: string; endTime: string; organizerName: string }> = []
      let retryConflictEvents: Array<{ start: { dateTime: string }; end: { dateTime: string }; id: string }> = []

      const retrySeriesMasterId = updatedEvent.recurrence
        ? updatedEvent.id
        : (updatedEvent.type === "seriesMaster"
          ? updatedEvent.id
          : (updatedEvent.seriesMasterId || updatedEvent.id))

      console.log(`[WEBHOOK] Retry path - Series check: isSeries=${seriesData.isSeries}, eventId=${updatedEvent.id}, seriesMasterId=${retrySeriesMasterId}`)

      if (seriesData.isSeries) {
        console.log(`[WEBHOOK] Retry path - Checking for booking conflicts...`)

        const seriesStart = seriesData.seriesStartDate
          ? new Date(seriesData.seriesStartDate)
          : new Date(updatedEvent.start.dateTime + "Z")
        const startDateTime = seriesStart.toISOString()

        const seriesEnd = seriesData.seriesEndDate
          ? new Date(seriesData.seriesEndDate)
          : new Date(seriesStart.getTime() + 6 * 30 * 24 * 60 * 60 * 1000)
        const endDateTime = seriesEnd.toISOString()

        console.log(`[WEBHOOK] Retry path - Checking conflicts from ${startDateTime} to ${endDateTime}`)

        try {
          const conflicts = await getSeriesConflicts(roomEmail, retrySeriesMasterId, startDateTime, endDateTime)

          if (conflicts.length > 0) {
            console.log(`[WEBHOOK] Retry path - Found ${conflicts.length} conflicting occurrences`)

            retryConflictEvents = conflicts.map(c => ({
              start: c.start,
              end: c.end,
              id: c.id
            }))

            // Format conflict dates for the email using the same approach as main path
            const ianaTimezone = retryAcceptTimezone.includes("Eastern") ? "America/New_York" :
              retryAcceptTimezone.includes("Pacific") ? "America/Los_Angeles" :
                retryAcceptTimezone.includes("Central") ? "America/Chicago" : "America/New_York"

            retryConflictDates = conflicts.map(conflict => {
              const conflictStart = new Date(conflict.start.dateTime + "Z")
              const conflictEnd = new Date(conflict.end.dateTime + "Z")

              return {
                date: conflictStart.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: ianaTimezone
                }),
                startTime: conflictStart.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                  timeZone: ianaTimezone
                }),
                endTime: conflictEnd.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                  timeZone: ianaTimezone
                }),
                organizerName: updatedEvent.organizer.emailAddress.name,
              }
            })
          } else {
            console.log(`[WEBHOOK] Retry path - No conflicts found`)
          }
        } catch (conflictError) {
          console.error(`[WEBHOOK] Retry path - Failed to check conflicts:`, conflictError)
        }
      }

      console.log(`[WEBHOOK] Retry path - Rendering email with series data:`, JSON.stringify(seriesData))
      console.log(`[WEBHOOK] Retry path - Conflicts found: ${retryConflictDates.length}`)

      const htmlContent = renderAcceptedEmail({
        organizerName: updatedEvent.organizer.emailAddress.name,
        organizerEmail,
        roomName,
        subject: updatedEvent.subject,
        startTime: updatedEvent.start.dateTime,
        endTime: updatedEvent.end.dateTime,
        timeZone: retryAcceptTimezone,
        attendees: updatedEvent.attendees?.map((a: { emailAddress: { name: string; address: string } }) => ({
          name: a.emailAddress.name,
          email: a.emailAddress.address,
        })),
        ...seriesData,
        conflictDates: retryConflictDates.length > 0 ? retryConflictDates : undefined,
      })

      // Determine email subject - include conflict count if there are conflicts
      const retrySubject = retryConflictDates.length > 0
        ? `Room Confirmed (${retryConflictDates.length} conflict${retryConflictDates.length > 1 ? 's' : ''}): ${roomName} - ${updatedEvent.subject}`
        : `Room Confirmed: ${roomName} - ${updatedEvent.subject}`

      try {
        await sendEmail(
          notificationMailbox,
          organizerEmail,
          retrySubject,
          htmlContent
        )
        emailsSentForEvents.set(eventId, Date.now())
        console.log(`[WEBHOOK] SUCCESS: Sent acceptance email after retry`)

        // Send follow-up decline email for conflicting dates (like Outlook does)
        if (retryConflictEvents.length > 0 && sendDeclineNotifications) {
          console.log(`[WEBHOOK] Retry path - Sending follow-up decline email for ${retryConflictEvents.length} conflicting dates`)

          // Get the first conflict for the email start/end times
          const firstConflict = retryConflictEvents[0]

          const declineHtmlContent = renderDeclinedEmail({
            organizerName: updatedEvent.organizer.emailAddress.name,
            organizerEmail,
            roomName,
            subject: updatedEvent.subject,
            startTime: firstConflict.start.dateTime,
            endTime: firstConflict.end.dateTime,
            timeZone: retryAcceptTimezone,
            reason: "This instance was declined because there are conflicts.",
            attendees: updatedEvent.attendees?.map((a: { emailAddress: { name: string; address: string } }) => ({
              name: a.emailAddress.name,
              email: a.emailAddress.address,
            })),
            ...seriesData,
            conflictDates: retryConflictDates,
          })

          try {
            await sendEmail(
              notificationMailbox,
              organizerEmail,
              `Declined: ${updatedEvent.subject}`,
              declineHtmlContent
            )
            console.log(`[WEBHOOK] SUCCESS: Sent follow-up decline email for conflicts after retry`)
          } catch (declineEmailError) {
            console.error(`[WEBHOOK] FAILED to send follow-up decline email:`, declineEmailError)
          }
        }
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
      const retryDeclineTimezone = await getUserTimezone(organizerEmail)
      const retryDeclineSeriesData = await getSeriesDataAsync(updatedEvent, userIdOrEmail)
      const htmlContent = renderDeclinedEmail({
        organizerName: updatedEvent.organizer.emailAddress.name,
        organizerEmail,
        roomName,
        subject: updatedEvent.subject,
        startTime: updatedEvent.start.dateTime,
        endTime: updatedEvent.end.dateTime,
        timeZone: retryDeclineTimezone,
        reason: "The room has a scheduling conflict with an existing booking.",
        attendees: updatedEvent.attendees?.map((a: { emailAddress: { name: string; address: string } }) => ({
          name: a.emailAddress.name,
          email: a.emailAddress.address,
        })),
        ...retryDeclineSeriesData,
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

    // Fetch the organizer's timezone from their mailbox settings
    const organizerTimezone = await getUserTimezone(organizerEmail)
    console.log(`[WEBHOOK] Organizer timezone from mailbox settings: "${organizerTimezone}"`)

    // Get series data and check for conflicts BEFORE sending accepted email
    const acceptSeriesData = await getSeriesDataAsync(event, roomEmail)

    // For series events, check if any occurrences have conflicts with existing bookings
    // seriesMasterId is: the event.id if this IS a series master (has recurrence or type is seriesMaster), otherwise event.seriesMasterId
    const seriesMasterId = event.recurrence
      ? event.id
      : (event.type === "seriesMaster"
        ? event.id
        : (event.seriesMasterId || event.id)) // fallback to event.id if no seriesMasterId

    let conflictDates: Array<{ date: string; startTime: string; endTime: string; organizerName: string }> = []
    let conflictEvents: Array<{ start: { dateTime: string }; end: { dateTime: string }; id: string }> = []

    console.log(`[WEBHOOK] Series check: isSeries=${acceptSeriesData.isSeries}, eventType=${event.type}, hasRecurrence=${!!event.recurrence}, eventId=${event.id}, seriesMasterId=${seriesMasterId}`)

    if (acceptSeriesData.isSeries) {
      console.log(`[WEBHOOK] This is a series - checking for booking conflicts...`)

      // Calculate date range for checking conflicts based on series range
      // Use series start date (or event start if not available) to catch all conflicts
      const seriesStart = acceptSeriesData.seriesStartDate
        ? new Date(acceptSeriesData.seriesStartDate)
        : new Date(event.start.dateTime + "Z")
      const startDateTime = seriesStart.toISOString()

      const seriesEnd = acceptSeriesData.seriesEndDate
        ? new Date(acceptSeriesData.seriesEndDate)
        : new Date(seriesStart.getTime() + 6 * 30 * 24 * 60 * 60 * 1000) // 6 months default
      const endDateTime = seriesEnd.toISOString()

      console.log(`[WEBHOOK] Checking series conflicts from ${startDateTime} to ${endDateTime}`)

      try {
        const conflicts = await getSeriesConflicts(
          roomEmail,
          seriesMasterId,
          startDateTime,
          endDateTime
        )

        if (conflicts.length > 0) {
          console.log(`[WEBHOOK] Found ${conflicts.length} declined occurrences in series`)
          conflictEvents = conflicts

          // Format conflict dates for the email (like Outlook does)
          const ianaTimezone = organizerTimezone.includes("Eastern") ? "America/New_York" :
            organizerTimezone.includes("Pacific") ? "America/Los_Angeles" :
              organizerTimezone.includes("Central") ? "America/Chicago" : "America/New_York"

          conflictDates = conflicts.map(conflict => {
            const conflictStart = new Date(conflict.start.dateTime + "Z")
            const conflictEnd = new Date(conflict.end.dateTime + "Z")

            return {
              date: conflictStart.toLocaleDateString("en-US", {
                weekday: "short",
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: ianaTimezone
              }),
              startTime: conflictStart.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
                timeZone: ianaTimezone
              }),
              endTime: conflictEnd.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
                timeZone: ianaTimezone
              }),
              organizerName: event.organizer.emailAddress.name,
            }
          })
        } else {
          console.log(`[WEBHOOK] No declined occurrences found in series`)
        }
      } catch (conflictError) {
        console.error(`[WEBHOOK] Failed to check series conflicts:`, conflictError)
      }
    }

    // Send acceptance notification with conflicts inline (like Outlook does)
    console.log(`[WEBHOOK] Rendering accepted email with series data:`, JSON.stringify(acceptSeriesData))
    console.log(`[WEBHOOK] Conflicts found: ${conflictDates.length}`)
    const htmlContent = renderAcceptedEmail({
      organizerName: event.organizer.emailAddress.name,
      organizerEmail,
      roomName,
      subject: event.subject,
      startTime: event.start.dateTime,
      endTime: event.end.dateTime,
      timeZone: organizerTimezone,
      attendees: event.attendees?.map((a: { emailAddress: { name: string; address: string } }) => ({
        name: a.emailAddress.name,
        email: a.emailAddress.address,
      })),
      ...acceptSeriesData,
      conflictDates: conflictDates.length > 0 ? conflictDates : undefined,
    })

    try {
      console.log(`[WEBHOOK] Calling sendEmail via Graph API...`)
      const subjectWithConflicts = conflictDates.length > 0
        ? `Room Confirmed (${conflictDates.length} conflict${conflictDates.length > 1 ? 's' : ''}): ${roomName} - ${event.subject}`
        : `Room Confirmed: ${roomName} - ${event.subject}`

      await sendEmail(
        notificationMailbox,
        organizerEmail,
        subjectWithConflicts,
        htmlContent
      )
      emailsSentForEvents.set(eventId, Date.now())
      console.log(`[WEBHOOK] SUCCESS: Sent acceptance email for event ${eventId} to ${organizerEmail}`)

      // Send individual declined emails for each conflict (like Outlook does)
      if (conflictEvents.length > 0) {
        console.log(`[WEBHOOK] Sending ${conflictEvents.length} individual decline notifications for conflicts...`)

        const ianaTimezone = organizerTimezone.includes("Eastern") ? "America/New_York" :
          organizerTimezone.includes("Pacific") ? "America/Los_Angeles" :
            organizerTimezone.includes("Central") ? "America/Chicago" : "America/New_York"

        for (const conflict of conflictEvents) {
          try {
            const conflictStart = new Date(conflict.start.dateTime + "Z")
            const conflictEnd = new Date(conflict.end.dateTime + "Z")

            const conflictDate = conflictStart.toLocaleDateString("en-US", {
              weekday: "short",
              month: "numeric",
              day: "numeric",
              year: "numeric",
              timeZone: ianaTimezone
            })
            const conflictStartTime = conflictStart.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
              timeZone: ianaTimezone
            })
            const conflictEndTime = conflictEnd.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
              timeZone: ianaTimezone
            })

            const declineHtml = renderDeclinedEmail({
              organizerName: event.organizer.emailAddress.name,
              organizerEmail,
              roomName,
              subject: event.subject,
              startTime: conflict.start.dateTime,
              endTime: conflict.end.dateTime,
              timeZone: organizerTimezone,
              reason: `This instance was declined because there are conflicts. The room is already booked for ${conflictDate} ${conflictStartTime} - ${conflictEndTime}.`,
              ...acceptSeriesData,
            })

            await sendEmail(
              notificationMailbox,
              organizerEmail,
              `Declined: ${roomName} - ${event.subject} (${conflictDate} ${conflictStartTime} - ${conflictEndTime})`,
              declineHtml
            )
            console.log(`[WEBHOOK] SUCCESS: Sent decline email for conflict on ${conflictDate}`)
          } catch (conflictEmailError) {
            console.error(`[WEBHOOK] Failed to send decline email for conflict:`, conflictEmailError)
          }
        }
      }
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
    console.log(`[WEBHOOK] Declined event type: ${event.type}, seriesMasterId: ${event.seriesMasterId}, hasRecurrence: ${!!event.recurrence}`)
    console.log(`[WEBHOOK] Sending to: ${organizerEmail}, From: ${notificationMailbox}`)

    // Fetch the organizer's timezone from their mailbox settings
    const organizerTimezoneDecline = await getUserTimezone(organizerEmail)
    console.log(`[WEBHOOK] Organizer timezone: "${organizerTimezoneDecline}"`)

    // Send decline notification using organizer's timezone
    const declineSeriesData = await getSeriesDataAsync(event, roomEmail)
    console.log(`[WEBHOOK] Decline series data: isSeries=${declineSeriesData.isSeries}, pattern="${declineSeriesData.recurrencePattern}"`)

    const htmlContent = renderDeclinedEmail({
      organizerName: event.organizer.emailAddress.name,
      organizerEmail,
      roomName,
      subject: event.subject,
      startTime: event.start.dateTime,
      endTime: event.end.dateTime,
      timeZone: organizerTimezoneDecline,
      reason: "The room has a scheduling conflict with an existing booking.",
      attendees: event.attendees?.map((a: { emailAddress: { name: string; address: string } }) => ({
        name: a.emailAddress.name,
        email: a.emailAddress.address,
      })),
      ...declineSeriesData,
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
    const tentativeTimezone = await getUserTimezone(organizerEmail)
    const tentativeSeriesData = await getSeriesDataAsync(event, roomEmail)
    const htmlContent = renderAcceptedEmail({
      organizerName: event.organizer.emailAddress.name,
      organizerEmail,
      roomName,
      subject: event.subject,
      startTime: event.start.dateTime,
      endTime: event.end.dateTime,
      timeZone: tentativeTimezone,
      attendees: event.attendees?.map((a: { emailAddress: { name: string; address: string } }) => ({
        name: a.emailAddress.name,
        email: a.emailAddress.address,
      })),
      ...tentativeSeriesData,
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
