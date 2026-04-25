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
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken()

  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
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
  return graphRequest<CalendarEvent>(`/users/${roomEmail}/events/${eventId}`)
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
export async function createSubscription(
  roomEmail: string,
  notificationUrl: string,
  clientState: string
): Promise<GraphSubscription> {
  // Subscriptions expire max 4230 minutes (about 3 days) for calendar resources
  const expirationDateTime = new Date()
  expirationDateTime.setMinutes(expirationDateTime.getMinutes() + 4230)

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
export async function renewSubscription(
  subscriptionId: string
): Promise<GraphSubscription> {
  const expirationDateTime = new Date()
  expirationDateTime.setMinutes(expirationDateTime.getMinutes() + 4230)

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

// Get all users in the tenant (paginated)
export async function getUsers(top: number = 100): Promise<GraphUser[]> {
  const response = await graphRequest<{ value: GraphUser[] }>(
    `/users?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones&$top=${top}&$filter=accountEnabled eq true`
  )
  return response.value
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
