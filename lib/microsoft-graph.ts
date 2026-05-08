import { ConfidentialClientApplication } from "@azure/msal-node"

// Microsoft Graph API configuration
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
}

let msalClient: ConfidentialClientApplication | null = null

function getMsalClient(): ConfidentialClientApplication {
  if (!msalClient) {
    msalClient = new ConfidentialClientApplication(msalConfig)
  }
  return msalClient
}

export async function getAccessToken(): Promise<string> {
  // Validate environment variables
  if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET || !process.env.AZURE_TENANT_ID) {
    throw new Error("Missing Azure AD configuration. Please set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID environment variables.")
  }

  const client = getMsalClient()

  try {
    const result = await client.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    })

    if (!result?.accessToken) {
      throw new Error("Failed to acquire access token - no token returned")
    }

    return result.accessToken
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    if (message.includes("AADSTS7000215")) {
      throw new Error("Invalid client secret. Please verify your AZURE_CLIENT_SECRET is correct.")
    }
    if (message.includes("AADSTS700016")) {
      throw new Error("Application not found. Please verify your AZURE_CLIENT_ID and AZURE_TENANT_ID are correct.")
    }
    if (message.includes("AADSTS70011")) {
      throw new Error("Invalid scope. Please ensure the app has been granted admin consent for Microsoft Graph permissions.")
    }
    throw new Error(`Authentication failed: ${message}`)
  }
}

export async function graphRequest<T>(
  endpoint: string,
  options: RequestInit & { advancedQuery?: boolean } = {}
): Promise<T> {
  const token = await getAccessToken()
  const { advancedQuery, ...fetchOptions } = options

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  // Add ConsistencyLevel header for advanced queries (required for endsWith, startsWith, etc.)
  if (advancedQuery) {
    headers["ConsistencyLevel"] = "eventual"
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    ...fetchOptions,
    headers: {
      ...headers,
      ...(fetchOptions.headers as Record<string, string>),
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const errorCode = error?.error?.code || "Unknown"
    const errorMessage = error?.error?.message || "No message"

    // Provide actionable error messages
    if (response.status === 401) {
      throw new Error(
        `Authentication failed (401). Please verify: 1) Admin consent has been granted for the app permissions in Azure AD, 2) The app registration is configured correctly. Error: ${errorCode}`
      )
    }
    if (response.status === 403) {
      throw new Error(
        `Access denied (403). The app doesn't have permission to access this resource. Please grant admin consent for the required permissions (Calendars.Read, Place.Read.All, Mail.Send, User.Read.All). Error: ${errorCode}`
      )
    }
    if (response.status === 404) {
      throw new Error(
        `Resource not found (404). The requested mailbox or resource may not exist. Error: ${errorCode} - ${errorMessage}`
      )
    }

    throw new Error(
      `Graph API error: ${response.status} - ${errorCode}: ${errorMessage}`
    )
  }

  // Handle 204 No Content (e.g., sendMail returns empty response)
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return {} as T
  }

  // Check if there's actually content to parse
  const text = await response.text()
  if (!text || text.trim() === "") {
    return {} as T
  }

  return JSON.parse(text)
}

// Room Mailbox Types
export interface RoomMailbox {
  id: string
  emailAddress: string
  displayName: string
  capacity: number
  building?: string
  floorNumber?: number
  audioDeviceName?: string
  videoDeviceName?: string
  displayDeviceName?: string
  isWheelChairAccessible?: boolean
}

export interface CalendarEvent {
  id: string
  subject: string
  organizer: {
    emailAddress: {
      name: string
      address: string
    }
  }
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  attendees: Array<{
    type: string
    status: {
      response: string
      time: string
    }
    emailAddress: {
      name: string
      address: string
    }
  }>
  location?: {
    displayName: string
    locationUri?: string
  }
  responseStatus?: {
    response: "none" | "organizer" | "tentativelyAccepted" | "accepted" | "declined" | "notResponded"
    time: string
  }
  isCancelled?: boolean
  createdDateTime: string
  lastModifiedDateTime: string
  // Recurrence fields
  type?: "singleInstance" | "occurrence" | "exception" | "seriesMaster"
  seriesMasterId?: string
  recurrence?: {
    pattern: {
      type: "daily" | "weekly" | "absoluteMonthly" | "relativeMonthly" | "absoluteYearly" | "relativeYearly"
      interval: number
      daysOfWeek?: string[]
      dayOfMonth?: number
      month?: number
      firstDayOfWeek?: string
      index?: "first" | "second" | "third" | "fourth" | "last"
    }
    range: {
      type: "endDate" | "noEnd" | "numbered"
      startDate: string
      endDate?: string
      numberOfOccurrences?: number
    }
  }
}

export interface GraphSubscription {
  id: string
  resource: string
  changeType: string
  clientState: string
  notificationUrl: string
  expirationDateTime: string
  applicationId: string
}

// Fetch all room mailboxes (requires Places.Read.All permission)
export async function getRoomMailboxes(): Promise<RoomMailbox[]> {
  const response = await graphRequest<{ value: RoomMailbox[] }>("/places/microsoft.graph.room")
  return response.value
}

// Format recurrence pattern to human-readable string
export function formatRecurrencePattern(recurrence: CalendarEvent["recurrence"]): string {
  if (!recurrence) return ""

  const { pattern, range } = recurrence
  const daysOfWeek = pattern.daysOfWeek || []

  // Format days of week
  const dayNames: Record<string, string> = {
    sunday: "Sunday",
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
  }

  let patternText = ""

  switch (pattern.type) {
    case "daily":
      patternText = pattern.interval === 1 ? "Daily" : `Every ${pattern.interval} days`
      break
    case "weekly":
      const dayList = daysOfWeek.map(d => dayNames[d.toLowerCase()] || d).join(", ")
      patternText = pattern.interval === 1
        ? `Weekly on ${dayList}`
        : `Every ${pattern.interval} weeks on ${dayList}`
      break
    case "absoluteMonthly":
      patternText = pattern.interval === 1
        ? `Monthly on day ${pattern.dayOfMonth}`
        : `Every ${pattern.interval} months on day ${pattern.dayOfMonth}`
      break
    case "relativeMonthly":
      const indexName = pattern.index ? pattern.index.charAt(0).toUpperCase() + pattern.index.slice(1) : ""
      const relDays = daysOfWeek.map(d => dayNames[d.toLowerCase()] || d).join(", ")
      patternText = `Monthly on the ${indexName.toLowerCase()} ${relDays}`
      break
    case "absoluteYearly":
      patternText = `Yearly on day ${pattern.dayOfMonth}`
      break
    case "relativeYearly":
      patternText = `Yearly`
      break
    default:
      patternText = "Recurring"
  }

  return patternText
}

// Format series date range
export function formatSeriesDateRange(recurrence: CalendarEvent["recurrence"], timeZone: string = "America/New_York"): { startDate: string; endDate: string } {
  if (!recurrence) return { startDate: "", endDate: "" }

  const { range } = recurrence
  const options: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  }

  const startDate = new Date(range.startDate + "T00:00:00")
  const formattedStart = startDate.toLocaleDateString("en-US", options)

  let formattedEnd = ""
  if (range.type === "endDate" && range.endDate) {
    const endDate = new Date(range.endDate + "T00:00:00")
    formattedEnd = endDate.toLocaleDateString("en-US", options)
  } else if (range.type === "noEnd") {
    formattedEnd = "No end date"
  } else if (range.type === "numbered" && range.numberOfOccurrences) {
    formattedEnd = `${range.numberOfOccurrences} occurrences`
  }

  return { startDate: formattedStart, endDate: formattedEnd }
}

// Fetch calendar events for a room mailbox
export async function getRoomCalendarEvents(
  roomEmail: string,
  startDateTime: string,
  endDateTime: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    startDateTime,
    endDateTime,
    $orderby: "start/dateTime",
    $top: "100",
  })

  const response = await graphRequest<{ value: CalendarEvent[] }>(
    `/users/${roomEmail}/calendarView?${params}`
  )
  return response.value
}

// Get a specific event from a room calendar
export async function getRoomEvent(
  roomEmail: string,
  eventId: string
): Promise<CalendarEvent> {
  // Request all fields including recurrence data for series detection
  const params = new URLSearchParams({
    $select: "id,subject,body,start,end,location,organizer,attendees,responseStatus,isCancelled,createdDateTime,lastModifiedDateTime,type,seriesMasterId,recurrence",
  })
  return graphRequest<CalendarEvent>(`/users/${roomEmail}/events/${eventId}?${params}`)
}

// Check for conflicts by finding the ACTUAL conflicting events on the room's calendar
// This queries the calendar for existing bookings that overlap with the new series time slots
export async function getSeriesConflicts(
  roomEmail: string,
  seriesMasterId: string,
  startDateTime: string,
  endDateTime: string
): Promise<CalendarEvent[]> {
  console.log(`[GRAPH] getSeriesConflicts: checking room ${roomEmail} for conflicts`)
  console.log(`[GRAPH] Series master ID: ${seriesMasterId}, date range: ${startDateTime} to ${endDateTime}`)

  try {
    // Step 1: Get the series master to understand the meeting time
    const seriesMaster = await graphRequest<CalendarEvent>(
      `/users/${roomEmail}/events/${seriesMasterId}?$select=id,subject,start,end,recurrence,type`
    )

    if (!seriesMaster.recurrence) {
      console.log(`[GRAPH] Series master has no recurrence data`)
      return []
    }

    console.log(`[GRAPH] Series: ${seriesMaster.subject}, time=${seriesMaster.start.dateTime}`)

    // Step 2: Get the ACCEPTED instances (declined ones are NOT returned by Graph)
    const instancesParams = new URLSearchParams({
      startDateTime,
      endDateTime,
      $select: "id,subject,start,end,responseStatus,type,seriesMasterId",
      $top: "200",
    })

    let acceptedInstances: CalendarEvent[] = []
    try {
      const instancesResponse = await graphRequest<{ value: CalendarEvent[] }>(
        `/users/${roomEmail}/events/${seriesMasterId}/instances?${instancesParams}`
      )
      acceptedInstances = instancesResponse.value || []
      console.log(`[GRAPH] Got ${acceptedInstances.length} accepted instances from series`)
    } catch (instancesError) {
      console.error(`[GRAPH] Failed to get series instances:`, instancesError)
      return []
    }

    // Build a set of accepted instance dates (YYYY-MM-DD format)
    const acceptedDates = new Set(
      acceptedInstances.map(inst => {
        const d = new Date(inst.start.dateTime + "Z")
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      })
    )
    console.log(`[GRAPH] Accepted dates: ${Array.from(acceptedDates).join(', ')}`)

    // Step 3: Get ALL events on the room calendar during the date range
    const calendarParams = new URLSearchParams({
      startDateTime,
      endDateTime,
      $select: "id,subject,start,end,seriesMasterId,isCancelled,type,organizer",
      $orderby: "start/dateTime",
      $top: "500",
    })

    const calendarResponse = await graphRequest<{ value: CalendarEvent[] }>(
      `/users/${roomEmail}/calendarView?${calendarParams}`
    )

    const allEvents = calendarResponse.value || []
    console.log(`[GRAPH] Got ${allEvents.length} total events on room calendar`)

    // Step 4: Find events that are NOT part of our series (these are potential conflicts)
    // An event is part of our series if it has seriesMasterId === seriesMasterId or id === seriesMasterId
    const otherBookings = allEvents.filter(e => {
      if (e.isCancelled) return false
      if (e.id === seriesMasterId) return false
      if (e.seriesMasterId === seriesMasterId) return false
      return true
    })

    console.log(`[GRAPH] Found ${otherBookings.length} other bookings on calendar`)

    // Step 5: Extract the meeting time from series master (hours:minutes)
    const seriesStartTime = seriesMaster.start.dateTime.split('T')[1]?.substring(0, 5) || "00:00"
    const seriesEndTime = seriesMaster.end.dateTime.split('T')[1]?.substring(0, 5) || "00:00"
    console.log(`[GRAPH] Series time slot: ${seriesStartTime} - ${seriesEndTime}`)

    // Step 6: Find conflicts - other bookings that:
    // a) Are on a date that SHOULD have a series occurrence (based on recurrence pattern), AND
    // b) Overlap with the series time slot
    const conflicts: CalendarEvent[] = []

    for (const booking of otherBookings) {
      const bookingDate = new Date(booking.start.dateTime + "Z")
      const bookingDateStr = `${bookingDate.getUTCFullYear()}-${String(bookingDate.getUTCMonth() + 1).padStart(2, '0')}-${String(bookingDate.getUTCDate()).padStart(2, '0')}`

      // If this date already has an accepted instance, it's not a conflict
      if (acceptedDates.has(bookingDateStr)) {
        continue
      }

      // Check if this date SHOULD have had a series occurrence
      // by checking if it matches the recurrence pattern
      if (!matchesRecurrencePattern(bookingDate, seriesMaster.recurrence)) {
        continue
      }

      // Check time overlap
      const bookingStartTime = booking.start.dateTime.split('T')[1]?.substring(0, 5) || "00:00"
      const bookingEndTime = booking.end.dateTime.split('T')[1]?.substring(0, 5) || "00:00"

      // Simple time overlap check (convert to minutes for comparison)
      const seriesStartMins = timeToMinutes(seriesStartTime)
      const seriesEndMins = timeToMinutes(seriesEndTime)
      const bookingStartMins = timeToMinutes(bookingStartTime)
      const bookingEndMins = timeToMinutes(bookingEndTime)

      const overlaps = seriesStartMins < bookingEndMins && seriesEndMins > bookingStartMins

      if (overlaps) {
        console.log(`[GRAPH] CONFLICT: "${booking.subject}" on ${bookingDateStr} ${bookingStartTime}-${bookingEndTime} conflicts with series ${seriesStartTime}-${seriesEndTime}`)
        // Return the ACTUAL conflicting booking with its real date/time
        conflicts.push(booking)
      }
    }

    console.log(`[GRAPH] Found ${conflicts.length} actual conflicting events`)
    return conflicts

  } catch (error) {
    console.error(`[GRAPH] Failed to check series conflicts:`, error)
    return []
  }
}

// Helper: Convert time string "HH:MM" to minutes since midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Helper: Check if a date matches the recurrence pattern
function matchesRecurrencePattern(date: Date, recurrence: NonNullable<CalendarEvent["recurrence"]>): boolean {
  const { pattern, range } = recurrence

  const seriesStart = new Date(range.startDate + "T00:00:00Z")
  const seriesEnd = range.endDate ? new Date(range.endDate + "T23:59:59Z") : null

  // Date must be within series range
  if (date < seriesStart) return false
  if (seriesEnd && date > seriesEnd) return false

  if (pattern.type === "weekly") {
    // Check if the day of week matches
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6
    }
    const targetDays = (pattern.daysOfWeek || []).map(d => dayMap[d.toLowerCase()]).filter(d => d !== undefined)

    if (!targetDays.includes(date.getUTCDay())) {
      return false
    }

    // Check interval (every N weeks)
    if (pattern.interval > 1) {
      const weeksDiff = Math.floor((date.getTime() - seriesStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
      if (weeksDiff % pattern.interval !== 0) {
        return false
      }
    }

    return true
  } else if (pattern.type === "daily") {
    if (pattern.interval > 1) {
      const daysDiff = Math.floor((date.getTime() - seriesStart.getTime()) / (24 * 60 * 60 * 1000))
      if (daysDiff % pattern.interval !== 0) {
        return false
      }
    }
    return true
  } else if (pattern.type === "absoluteMonthly") {
    // Check if day of month matches
    if (date.getUTCDate() !== seriesStart.getUTCDate()) {
      return false
    }
    if (pattern.interval > 1) {
      const monthsDiff = (date.getUTCFullYear() - seriesStart.getUTCFullYear()) * 12 +
        (date.getUTCMonth() - seriesStart.getUTCMonth())
      if (monthsDiff % pattern.interval !== 0) {
        return false
      }
    }
    return true
  }

  return false
}

// Get a user's timezone from their mailbox settings
export async function getUserTimezone(userEmail: string): Promise<string> {
  try {
    // Get the full mailboxSettings object which contains the timeZone
    const response = await graphRequest<{ timeZone?: string; value?: string }>(
      `/users/${userEmail}/mailboxSettings`
    )
    console.log(`[GRAPH] Mailbox settings for ${userEmail}:`, JSON.stringify(response))

    const timezone = response.timeZone || response.value || "Eastern Standard Time"
    console.log(`[GRAPH] Using timezone: ${timezone}`)
    return timezone
  } catch (error) {
    console.error(`[GRAPH] Failed to get timezone for ${userEmail}:`, error)
    // Default to Eastern time if we can't get user's timezone
    return "Eastern Standard Time"
  }
}

// Create a subscription for room calendar changes
// durationMinutes defaults to 4230 (max for calendar resources, about 70.5 hours / ~3 days)
export async function createSubscription(
  roomEmail: string,
  notificationUrl: string,
  clientState: string,
  durationMinutes: number = 4230
): Promise<GraphSubscription> {
  // Subscriptions expire max 4230 minutes (about 3 days) for calendar resources
  // Clamp duration to valid range (1 minute to 4230 minutes)
  const clampedDuration = Math.min(Math.max(durationMinutes, 1), 4230)
  const expirationDateTime = new Date()
  expirationDateTime.setMinutes(expirationDateTime.getMinutes() + clampedDuration)

  return graphRequest<GraphSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      changeType: "created,updated,deleted",
      notificationUrl,
      resource: `/users/${roomEmail}/events`,
      expirationDateTime: expirationDateTime.toISOString(),
      clientState,
    }),
  })
}

// Renew an existing subscription
// durationMinutes defaults to 4230 (max for calendar resources)
export async function renewSubscription(
  subscriptionId: string,
  durationMinutes: number = 4230
): Promise<GraphSubscription> {
  const clampedDuration = Math.min(Math.max(durationMinutes, 1), 4230)
  const expirationDateTime = new Date()
  expirationDateTime.setMinutes(expirationDateTime.getMinutes() + clampedDuration)

  return graphRequest<GraphSubscription>(`/subscriptions/${subscriptionId}`, {
    method: "PATCH",
    body: JSON.stringify({
      expirationDateTime: expirationDateTime.toISOString(),
    }),
  })
}

// Delete a subscription
export async function deleteSubscription(subscriptionId: string): Promise<void> {
  await graphRequest(`/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  })
}

// List all active subscriptions
export async function listSubscriptions(): Promise<GraphSubscription[]> {
  const response = await graphRequest<{ value: GraphSubscription[] }>("/subscriptions")
  return response.value
}

// Send email using Microsoft Graph (requires Mail.Send permission)
export async function sendEmail(
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  ccRecipients?: string[]
): Promise<void> {
  await graphRequest(`/users/${from}/sendMail`, {
    method: "POST",
    body: JSON.stringify({
      message: {
        subject,
        body: {
          contentType: "HTML",
          content: htmlBody,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
        ccRecipients: ccRecipients?.map((email) => ({
          emailAddress: {
            address: email,
          },
        })),
      },
      saveToSentItems: true,
    }),
  })
}

// Get room mailbox calendar settings
export async function getRoomMailboxSettings(roomEmail: string) {
  return graphRequest(`/users/${roomEmail}/mailboxSettings`)
}

// Room Calendar Processing Configuration
export interface RoomCalendarProcessing {
  autoAcceptEnabled: boolean
  allowConflicts: boolean
  addOrganizerToSubject: boolean
  deleteAttachments: boolean
  deleteComments: boolean
  deleteNonCalendarItems: boolean
  deleteSubject: boolean
  processExternalMeetingMessages: boolean
  removeOldMeetingMessages: boolean
  removePrivateProperty: boolean
  addAdditionalResponse: boolean
  additionalResponse: string
}

// Get room calendar processing settings (auto-accept, auto-reply, etc.)
export async function getRoomCalendarProcessing(roomEmail: string): Promise<RoomCalendarProcessing> {
  // Note: This requires Exchange admin access via PowerShell or EWS
  // For Graph API, we can get partial settings from mailboxSettings
  const settings = await graphRequest<{
    automaticRepliesSetting?: {
      status: string
      internalReplyMessage?: string
      externalReplyMessage?: string
    }
  }>(`/users/${roomEmail}/mailboxSettings`)

  // Return default values - actual room calendar processing needs Exchange admin
  return {
    autoAcceptEnabled: true,
    allowConflicts: false,
    addOrganizerToSubject: true,
    deleteAttachments: true,
    deleteComments: false,
    deleteNonCalendarItems: true,
    deleteSubject: false,
    processExternalMeetingMessages: false,
    removeOldMeetingMessages: true,
    removePrivateProperty: true,
    addAdditionalResponse: false,
    additionalResponse: settings.automaticRepliesSetting?.internalReplyMessage || "",
  }
}

// Configure room to suppress automatic response emails
// Note: Full control requires Set-CalendarProcessing via Exchange PowerShell
// This uses Graph API to set automatic replies off
export async function disableRoomAutoReply(roomEmail: string): Promise<void> {
  await graphRequest(`/users/${roomEmail}/mailboxSettings`, {
    method: "PATCH",
    body: JSON.stringify({
      automaticRepliesSetting: {
        status: "disabled",
        internalReplyMessage: "",
        externalReplyMessage: ""
      }
    }),
  })
}

// Enable automatic reply for room (if needed to restore)
export async function enableRoomAutoReply(
  roomEmail: string,
  message: string
): Promise<void> {
  await graphRequest(`/users/${roomEmail}/mailboxSettings`, {
    method: "PATCH",
    body: JSON.stringify({
      automaticRepliesSetting: {
        status: "alwaysEnabled",
        internalReplyMessage: message,
        externalReplyMessage: message
      }
    }),
  })
}

// User Profile Types
export interface GraphUser {
  id: string
  displayName: string
  givenName?: string
  surname?: string
  mail: string
  userPrincipalName: string
  jobTitle?: string
  department?: string
  officeLocation?: string
  mobilePhone?: string
  businessPhones?: string[]
}

// Get user profile by email
export async function getUserProfile(email: string): Promise<GraphUser> {
  return graphRequest<GraphUser>(`/users/${email}?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones`)
}

// Get user's profile photo as base64
export async function getUserPhoto(email: string): Promise<string | null> {
  try {
    const token = await getAccessToken()

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${email}/photo/$value`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null // User has no photo
      }
      return null
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}

// Response type for paginated user queries
interface UsersResponse {
  value: GraphUser[]
  "@odata.nextLink"?: string
}

// Get all users in the tenant with pagination and domain filter
export async function getUsers(options?: {
  top?: number
  domain?: string
  fetchAll?: boolean
}): Promise<GraphUser[]> {
  const { top = 100, domain = "aditumbio.com", fetchAll = true } = options || {}

  // Build filter - always filter by enabled accounts and by domain
  let filter = "accountEnabled eq true"
  if (domain) {
    filter += ` and endswith(userPrincipalName,'@${domain}')`
  }

  const allUsers: GraphUser[] = []
  // $count=true is required when using advanced query operators like endsWith
  let nextLink: string | undefined = `/users?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones&$top=${top}&$count=true&$filter=${encodeURIComponent(filter)}`

  while (nextLink) {
    // Use advancedQuery: true because endsWith filter requires ConsistencyLevel: eventual header
    const response: UsersResponse = await graphRequest<UsersResponse>(nextLink, { advancedQuery: true })
    allUsers.push(...response.value)

    // Get next page URL if it exists and we want all users
    if (fetchAll && response["@odata.nextLink"]) {
      // Extract the path from the full URL
      const parsedUrl = new URL(response["@odata.nextLink"])
      nextLink = parsedUrl.pathname.replace("/v1.0", "") + parsedUrl.search
    } else {
      nextLink = undefined
    }
  }

  return allUsers
}

// Get user profile with photo combined
export async function getUserProfileWithPhoto(email: string): Promise<GraphUser & { photoUrl?: string }> {
  const [profile, photo] = await Promise.all([
    getUserProfile(email),
    getUserPhoto(email)
  ])

  return {
    ...profile,
    photoUrl: photo || undefined
  }
}
