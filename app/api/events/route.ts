import { NextRequest, NextResponse } from "next/server"
import { getRoomCalendarEvents, getRoomMailboxes } from "@/lib/microsoft-graph"

// Timezone conversion for Microsoft Graph API events
// Timezone offsets for US timezones (handles both standard and daylight time)
// Maps Microsoft Graph timezone names to UTC offset in hours
const TIMEZONE_OFFSETS: Record<string, number> = {
  "Eastern Standard Time": -5,
  "Eastern Daylight Time": -4,
  "Pacific Standard Time": -8,
  "Pacific Daylight Time": -7,
  "Central Standard Time": -6,
  "Central Daylight Time": -5,
  "Mountain Standard Time": -7,
  "Mountain Daylight Time": -6,
  "UTC": 0,
  "Coordinated Universal Time": 0,
}

// Convert MS Graph dateTime + timeZone to ISO string with proper UTC conversion
function convertGraphDateTime(dateTime: string, timeZone: string): string {
  // Get offset hours for the timezone (default to Eastern if unknown)
  let offsetHours = TIMEZONE_OFFSETS[timeZone]

  // If timezone not found, try to determine if we're in daylight saving time
  if (offsetHours === undefined) {
    // Default to Eastern, check if daylight time based on date
    const date = new Date(dateTime)
    const month = date.getMonth()
    // Rough DST check: March-November is usually DST in US
    const isDST = month >= 2 && month <= 10
    offsetHours = isDST ? -4 : -5
  }

  // Parse the local time (Graph returns time without timezone suffix)
  // e.g., "2026-04-29T11:30:00" in Eastern Time
  const localDate = new Date(dateTime)

  // Convert to UTC by subtracting the offset
  // If local time is 11:30 ET (-4 or -5), UTC is 15:30 or 16:30
  const utcMs = localDate.getTime() - (offsetHours * 60 * 60 * 1000)
  const utcDate = new Date(utcMs)

  return utcDate.toISOString()
}

export async function GET(request: NextRequest) {
  try {
    // Check if Microsoft Graph is configured
    if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET || !process.env.AZURE_TENANT_ID) {
      return NextResponse.json(
        { error: "Microsoft Graph not configured", configured: false },
        { status: 503 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const roomEmail = searchParams.get("roomEmail")
    const startDate = searchParams.get("startDate") || new Date().toISOString()
    const endDate = searchParams.get("endDate") || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    let events: Awaited<ReturnType<typeof getRoomCalendarEvents>> = []

    if (roomEmail) {
      // Fetch events for a specific room
      events = await getRoomCalendarEvents(roomEmail, startDate, endDate)
    } else {
      // Fetch events for all rooms
      const rooms = await getRoomMailboxes()
      const allEvents = await Promise.all(
        rooms.slice(0, 10).map(async (room) => { // Limit to 10 rooms to avoid rate limits
          try {
            const roomEvents = await getRoomCalendarEvents(room.emailAddress, startDate, endDate)
            return roomEvents.map((event) => ({
              ...event,
              roomEmail: room.emailAddress,
              roomName: room.displayName,
            }))
          } catch {
            return []
          }
        })
      )
      events = allEvents.flat()
    }

    // Transform events to our booking format
    const bookings = events.map((event) => {
      // Determine outcome based on response status
      let outcome: "accepted" | "declined-conflict" | "declined-policy" | "canceled" | "pending" = "pending"

      if (event.isCancelled) {
        outcome = "canceled"
      } else if (event.responseStatus?.response === "accepted") {
        outcome = "accepted"
      } else if (event.responseStatus?.response === "declined") {
        outcome = "declined-conflict" // Default to conflict, could be policy
      } else if (event.responseStatus?.response === "tentativelyAccepted") {
        outcome = "pending"
      }

      const roomEmailAddr = (event as { roomEmail?: string }).roomEmail || roomEmail || ""
      const roomDisplayName = (event as { roomName?: string }).roomName || event.location?.displayName || "Unknown Room"

      // Extract site from room name pattern "Room Name - Site" (handles " - ", "- ", "-", " -")
      let site = "Cambridge" // default
      // Match various dash formats: " - ", "- ", " -", "-"
      const dashMatch = roomDisplayName.match(/\s*-\s*([^-]+)$/)
      if (dashMatch && dashMatch[1]) {
        const extractedSite = dashMatch[1].trim()
        if (extractedSite) {
          site = extractedSite
        }
      } else if (roomEmailAddr.toLowerCase().includes("oak") ||
        roomDisplayName.toLowerCase().includes("oakland")) {
        site = "Oakland"
      }

      // Convert Graph dateTime with timezone to proper ISO strings
      const startTime = event.start?.dateTime && event.start?.timeZone
        ? convertGraphDateTime(event.start.dateTime, event.start.timeZone)
        : new Date().toISOString()

      const endTime = event.end?.dateTime && event.end?.timeZone
        ? convertGraphDateTime(event.end.dateTime, event.end.timeZone)
        : new Date().toISOString()

      return {
        id: event.id,
        roomId: event.id, // Use event ID as room ID for now
        roomName: roomDisplayName,
        site,
        organizer: event.organizer?.emailAddress?.name || "Unknown",
        organizerEmail: event.organizer?.emailAddress?.address || "",
        subject: event.subject || "No Subject",
        startTime,
        endTime,
        outcome,
        notificationSent: outcome !== "pending", // Assume notification sent if processed
        notificationTime: outcome !== "pending" ? event.lastModifiedDateTime : undefined,
        declineReason: outcome.startsWith("declined") ? "Conflict with existing booking" : undefined,
        createdAt: event.createdDateTime || new Date().toISOString(),
      }
    })

    // Sort by creation date, newest first
    bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ bookings, configured: true })
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json(
      { error: "Failed to fetch events", message: String(error) },
      { status: 500 }
    )
  }
}
