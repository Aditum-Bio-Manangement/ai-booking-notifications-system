import { format } from "date-fns"

// Custom template cache - synced with API
interface CustomTemplate {
  subject: string
  body: string
  updatedAt: string
}

// In-memory cache for custom templates
let customTemplatesCache: {
  accepted: CustomTemplate | null
  declined: CustomTemplate | null
} = {
  accepted: null,
  declined: null,
}

// Function to set custom templates (called from API sync)
export function setCustomTemplate(type: "accepted" | "declined", template: CustomTemplate | null) {
  customTemplatesCache[type] = template
}

// Function to get custom templates
export function getCustomTemplateCache(type: "accepted" | "declined"): CustomTemplate | null {
  return customTemplatesCache[type]
}

// Default email templates - these can be customized via the UI
export const defaultTemplates = {
  accepted: {
    subject: "Room Confirmed: {{roomName}} - {{subject}}",
    body: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Room Booking Confirmed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 20px 24px; border-bottom: 1px solid #e2e8f0;" bgcolor="#ffffff">
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;" valign="middle" width="100">
                    <img src="{{logoUrl}}" alt="Aditum Bio" style="height: 48px; display: block;" height="48">
                  </td>
                  <td style="vertical-align: middle; text-align: center;" valign="middle" align="center">
                    <h1 style="margin: 0; color: #425cc7; font-size: 20px; font-weight: 600; white-space: nowrap;">Room Booking Confirmed</h1>
                  </td>
                  <td style="vertical-align: middle;" valign="middle" width="100">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 24px 20px;">
              <p style="margin: 0 0 24px; color: #19226d; font-size: 16px; line-height: 1.6;">
                Hi {{organizerName}},
              </p>
              
              <p style="margin: 0 0 24px; color: #19226d; font-size: 16px; line-height: 1.6;">
                Great news! Your room booking has been confirmed.
              </p>
              
              <!-- Booking Details Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 20px 16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                      <tr>
                        <td style="padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; color: #64748b; font-size: 16px; font-weight: 600;">Meeting</p>
                          <p style="margin: 4px 0 0; color: #425cc7; font-size: 16px; font-weight: 600;">{{subject}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                            <tr>
                              <td width="65%" style="vertical-align: top;">
                                <p style="margin: 0; color: #64748b; font-size: 16px; font-weight: 600;">Room</p>
                                <p style="margin: 4px 0 0; color: #19226d; font-size: 16px; font-weight: 500;">{{roomName}}</p>
                              </td>
                              <td width="35%" style="vertical-align: top;">
                                <p style="margin: 0; color: #64748b; font-size: 16px; font-weight: 600;">Date</p>
                                <p style="margin: 4px 0 0; color: #19226d; font-size: 16px; font-weight: 500;">{{date}}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; color: #64748b; font-size: 16px; font-weight: 600;">Time</p>
                          <p style="margin: 4px 0 0; color: #19226d; font-size: 16px; font-weight: 500;">{{startTime}} - {{endTime}} ({{timeZone}})</p>
                        </td>
                      </tr>
                      {{seriesSection}}
                      <tr>
                        <td style="padding-top: 16px;">
                          <p style="margin: 0; color: #64748b; font-size: 16px; font-weight: 600;">Organizer</p>
                          <p style="margin: 4px 0 0; color: #19226d; font-size: 16px; font-weight: 500;">{{organizerName}}</p>
                          {{attendeesSection}}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              {{conflictsSection}}
              
              <p style="margin: 24px 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                Please arrive a few minutes early to set up any required equipment. If you need to cancel or modify this booking, please do so through Outlook.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">
                This is an automated message from the Aditum Bio Room Booking System.<br>
                Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`,
  },
  declined: {
    subject: "Room Unavailable: {{roomName}} - {{subject}}",
    body: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Room Booking Declined</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 20px 24px; border-bottom: 1px solid #e2e8f0;" bgcolor="#ffffff">
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;" valign="middle" width="100">
                    <img src="{{logoUrl}}" alt="Aditum Bio" style="height: 48px; display: block;" height="48">
                  </td>
                  <td style="vertical-align: middle; text-align: center;" valign="middle" align="center">
                    <h1 style="margin: 0; color: #b91c1c; font-size: 20px; font-weight: 600; white-space: nowrap;">Room Unavailable</h1>
                  </td>
                  <td style="vertical-align: middle;" valign="middle" width="100">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 24px 20px;">
              <p style="margin: 0 0 24px; color: #19226d; font-size: 16px; line-height: 1.6;">
                Hi {{organizerName}},
              </p>
              
              <p style="margin: 0 0 24px; color: #19226d; font-size: 16px; line-height: 1.6;">
                Unfortunately, your room booking request could not be confirmed.
              </p>
              
              <!-- Reason Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">
                <tr>
                  <td style="padding: 16px 24px;">
                    <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 500;">
                      <strong>Reason:</strong> {{reason}}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Booking Details Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 24px;">
                <tr>
                  <td style="padding: 20px 16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                      <tr>
                        <td style="padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; color: #64748b; font-size: 16px; font-weight: 600;">Requested Meeting</p>
                          <p style="margin: 4px 0 0; color: #19226d; font-size: 16px; font-weight: 600;">{{subject}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                            <tr>
                              <td width="65%" style="vertical-align: top;">
                                <p style="margin: 0; color: #64748b; font-size: 16px; font-weight: 600;">Room</p>
                                <p style="margin: 4px 0 0; color: #19226d; font-size: 16px; font-weight: 500;">{{roomName}}</p>
                              </td>
                              <td width="35%" style="vertical-align: top;">
                                <p style="margin: 0; color: #64748b; font-size: 16px; font-weight: 600;">Date</p>
                                <p style="margin: 4px 0 0; color: #19226d; font-size: 16px; font-weight: 500;">{{date}}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; color: #64748b; font-size: 16px; font-weight: 600;">Time</p>
                          <p style="margin: 4px 0 0; color: #19226d; font-size: 16px; font-weight: 500;">{{startTime}} - {{endTime}} ({{timeZone}})</p>
                        </td>
                      </tr>
                      {{seriesSection}}
                      <tr>
                        <td style="padding-top: 16px;">
                          <p style="margin: 0; color: #64748b; font-size: 16px; font-weight: 600;">Organizer</p>
                          <p style="margin: 4px 0 0; color: #19226d; font-size: 16px; font-weight: 500;">{{organizerName}}</p>
                          {{attendeesSection}}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- What You Can Do Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; color: #1e40af; font-size: 15px; font-weight: 600;">What you can do:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 15px; line-height: 1.8;">
                      <li>Check for available time slots in Outlook</li>
                      <li>Try booking a different room</li>
                      <li>Contact the current room holder to negotiate</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">
                This is an automated message from the Aditum Bio Room Booking System.<br>
                Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`,
  },
}

export interface EmailTemplateData {
  organizerName: string
  organizerEmail?: string
  roomName: string
  subject: string
  startTime: string
  endTime: string
  timeZone: string
  reason?: string
  logoUrl?: string
  attendees?: Array<{ name: string; email: string }>
  // Series/Recurrence fields
  isSeries?: boolean
  recurrencePattern?: string // e.g., "Daily", "Weekly on Monday", "Monthly"
  seriesStartDate?: string
  seriesEndDate?: string
  // Conflict fields for series with partial declines - shown inline in accepted email
  conflictDates?: Array<{ date: string; startTime: string; endTime: string; organizerName?: string }>
}

// Map common Microsoft timezone IDs to IANA timezone names
const timezoneMap: Record<string, string> = {
  "Eastern Standard Time": "America/New_York",
  "Eastern Daylight Time": "America/New_York",
  "Pacific Standard Time": "America/Los_Angeles",
  "Pacific Daylight Time": "America/Los_Angeles",
  "Central Standard Time": "America/Chicago",
  "Central Daylight Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "Mountain Daylight Time": "America/Denver",
  "UTC": "UTC",
  "GMT": "UTC",
  "Coordinated Universal Time": "UTC",
}

function formatDateTime(isoString: string, timeZone: string) {
  // Microsoft Graph returns dateTime in UTC format (ending with Z)
  // We need to convert it to the organizer's timezone for display

  // Convert Microsoft timezone ID to IANA if needed
  const ianaTimezone = timezoneMap[timeZone] || timeZone || "America/New_York"



  try {
    // Parse the datetime - Microsoft Graph sends UTC times with Z suffix
    // or local times without suffix (depends on event configuration)
    let dateStr = isoString.replace(/\.0+$/, "") // Remove trailing zeros

    // If no timezone indicator, assume UTC (Microsoft Graph default)
    if (!dateStr.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(dateStr)) {
      dateStr = dateStr + "Z"
    }

    const date = new Date(dateStr)

    // Format weekday on its own line, then abbreviated month date below it
    const weekday = date.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: ianaTimezone,
    })

    const shortDate = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: ianaTimezone,
    })

    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: ianaTimezone,
    }

    const formattedTime = date.toLocaleTimeString("en-US", timeOptions)

    return {
      // weekday on line 1, abbreviated date on line 2
      date: `${weekday}<br>${shortDate}`,
      time: formattedTime,
    }
  } catch (error) {
    console.error(`[EMAIL] Error formatting datetime:`, error)
    // Fall back to date-fns formatting
    return {
      date: `${format(new Date(isoString), "EEEE")}<br>${format(new Date(isoString), "MMM d, yyyy")}`,
      time: format(new Date(isoString), "h:mm a"),
    }
  }
}

// Remove appended meeting links (Zoom/Teams/etc.) from a location/room string
function cleanLocationName(name: string): string {
  if (!name) return name
  // Locations often come as "Room Name; https://zoom.us/..." - take the part before the link
  let cleaned = name.split(/;?\s*https?:\/\//i)[0]
  // Also strip a trailing semicolon and whitespace
  cleaned = cleaned.replace(/;\s*$/, "").trim()
  return cleaned || name
}

// Get a friendly timezone display name
function getTimezoneDisplayName(timeZone: string): string {
  const displayNames: Record<string, string> = {
    "Eastern Standard Time": "ET",
    "Eastern Daylight Time": "ET",
    "Pacific Standard Time": "PT",
    "Pacific Daylight Time": "PT",
    "Central Standard Time": "CT",
    "Central Daylight Time": "CT",
    "Mountain Standard Time": "MT",
    "Mountain Daylight Time": "MT",
    "UTC": "UTC",
    "Coordinated Universal Time": "UTC",
    "America/New_York": "ET",
    "America/Los_Angeles": "PT",
    "America/Chicago": "CT",
    "America/Denver": "MT",
  }
  return displayNames[timeZone] || timeZone
}

function replaceTemplateVariables(template: string, data: EmailTemplateData): string {
  const start = formatDateTime(data.startTime, data.timeZone)
  const end = formatDateTime(data.endTime, data.timeZone)

  const logoUrl = data.logoUrl || process.env.LOGO_URL || "https://ai-booking-notifications-system.onrender.com/images/aditum-logo-horizontal.png"
  const timezoneDisplay = getTimezoneDisplayName(data.timeZone)

  // Strip any appended meeting links (e.g. Zoom/Teams URLs) from the room name
  const cleanRoomName = cleanLocationName(data.roomName)

  // Generate attendees section HTML if attendees exist
  let attendeesSection = ""
  if (data.attendees && data.attendees.length > 0) {
    const attendeeNames = data.attendees
      .filter(a => a.email !== data.organizerEmail) // Exclude organizer from attendees list
      .map(a => a.name || a.email)
      .slice(0, 5) // Limit to 5 attendees shown

    if (attendeeNames.length > 0) {
      const moreCount = data.attendees.length - 5
      const attendeeText = attendeeNames.join(", ") + (moreCount > 0 ? ` +${moreCount} more` : "")
      attendeesSection = `<p style="margin: 8px 0 0; color: #64748b; font-size: 14px;">Attendees: ${attendeeText}</p>`
    }
  }

  // Generate conflicts section HTML if there are conflicts in the series (like Outlook does)
  let conflictsSection = ""
  if (data.conflictDates && data.conflictDates.length > 0) {
    const conflictListHtml = data.conflictDates.map(conflict => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #fecaca;">
          <span style="color: #991b1b; font-weight: 500;">${conflict.organizerName || data.organizerName}</span>
          <span style="color: #64748b;"> - </span>
          <span style="color: #dc2626;">${conflict.date} ${conflict.startTime} to ${conflict.date} ${conflict.endTime}</span>
        </td>
      </tr>
    `).join("")

    conflictsSection = `
    <!-- Conflicts Warning (like Outlook) -->
    <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #fef3c7; border-radius: 8px; border: 1px solid #fcd34d; margin-top: 24px;">
      <tr>
        <td style="padding: 16px 24px;">
          <p style="margin: 0 0 8px; color: #92400e; font-size: 14px; font-weight: 600;">
            However, the following instances conflict:
          </p>
          <p style="margin: 0 0 8px; color: #78350f; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
            Organizer and Time of Conflicting Meeting
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
            ${conflictListHtml}
          </table>
        </td>
      </tr>
    </table>`
  }

  // Generate series section HTML if this is a recurring meeting
  let seriesSection = ""

  if (data.isSeries && data.recurrencePattern) {
    const seriesDateRange = data.seriesStartDate && data.seriesEndDate
      ? `${data.seriesStartDate} - ${data.seriesEndDate}`
      : data.seriesStartDate
        ? `Starting ${data.seriesStartDate}`
        : ""

    seriesSection = `
  <tr>
  <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
  <tr>
  <td style="vertical-align: top;">
  <p style="margin: 0;">
  <span style="display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Recurring Meeting Series</span>
  </p>
  <p style="margin: 8px 0 0; color: #19226d; font-size: 16px; font-weight: 500;">${data.recurrencePattern}</p>
  ${seriesDateRange ? `<p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">${seriesDateRange}</p>` : ""}
  </td>
  </tr>
  </table>
  </td>
  </tr>`
  }

  return template
    .replace(/\{\{organizerName\}\}/g, data.organizerName)
    .replace(/\{\{roomName\}\}/g, cleanRoomName)
    .replace(/\{\{subject\}\}/g, data.subject)
    .replace(/\{\{date\}\}/g, start.date)
    .replace(/\{\{startTime\}\}/g, start.time)
    .replace(/\{\{endTime\}\}/g, end.time)
    .replace(/\{\{timeZone\}\}/g, timezoneDisplay)
    .replace(/\{\{reason\}\}/g, data.reason || "")
    .replace(/\{\{logoUrl\}\}/g, logoUrl)
    .replace(/\{\{attendeesSection\}\}/g, attendeesSection)
    .replace(/\{\{seriesSection\}\}/g, seriesSection)
    .replace(/\{\{conflictsSection\}\}/g, conflictsSection)
    .replace(/\{\{isSeries\}\}/g, data.isSeries ? "Yes" : "No")
    .replace(/\{\{recurrencePattern\}\}/g, data.recurrencePattern || "")
    .replace(/\{\{seriesStartDate\}\}/g, data.seriesStartDate || "")
    .replace(/\{\{seriesEndDate\}\}/g, data.seriesEndDate || "")
}

export function renderAcceptedEmail(data: EmailTemplateData): string {
  // Use custom template if available, otherwise use default
  const customTemplate = customTemplatesCache.accepted
  const template = customTemplate?.body || defaultTemplates.accepted.body
  return replaceTemplateVariables(template, data)
}

export function renderDeclinedEmail(data: EmailTemplateData): string {
  // Use custom template if available, otherwise use default
  const customTemplate = customTemplatesCache.declined
  const template = customTemplate?.body || defaultTemplates.declined.body
  return replaceTemplateVariables(template, data)
}

// Render a series conflict notification email (when some occurrences are declined)
export function renderSeriesConflictEmail(data: EmailTemplateData): string {
  const logoUrl = data.logoUrl || process.env.LOGO_URL || "https://ai-booking-notifications-system.onrender.com/images/aditum-logo-horizontal.png"
  const timezoneDisplay = getTimezoneDisplayName(data.timeZone)

  // Format conflict dates as a list
  let conflictListHtml = ""
  if (data.conflictDates && data.conflictDates.length > 0) {
    conflictListHtml = data.conflictDates.map(conflict => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #fecaca;">
          <span style="color: #991b1b; font-weight: 500;">${conflict.date}</span>
          <span style="color: #dc2626; margin-left: 8px;">${conflict.startTime} - ${conflict.endTime}</span>
        </td>
      </tr>
    `).join("")
  }

  const seriesInfo = data.recurrencePattern
    ? `<p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">Series: ${data.recurrencePattern}</p>`
    : ""

  const seriesDateRange = data.seriesStartDate && data.seriesEndDate
    ? `<p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">Duration: ${data.seriesStartDate} - ${data.seriesEndDate}</p>`
    : ""

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meeting Series - Some Dates Unavailable</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 20px 24px; border-bottom: 1px solid #e2e8f0;" bgcolor="#ffffff">
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;" valign="middle" width="100">
                    <img src="${logoUrl}" alt="Aditum Bio" style="height: 48px; display: block;" height="48">
                  </td>
                  <td style="vertical-align: middle; text-align: center;" valign="middle" align="center">
                    <h1 style="margin: 0; color: #b91c1c; font-size: 20px; font-weight: 600; white-space: nowrap;">Series Conflict Notice</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 24px 20px;">
              <p style="margin: 0 0 24px; color: #19226d; font-size: 16px; line-height: 1.6;">
                Hi ${data.organizerName},
              </p>
              
              <p style="margin: 0 0 24px; color: #19226d; font-size: 16px; line-height: 1.6;">
                Your recurring meeting series has been partially booked. <strong>Most dates are confirmed</strong>, but the following dates have conflicts and could not be reserved:
              </p>
              
              <!-- Conflict Dates -->
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #fef2f2; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0 0 12px; color: #991b1b; font-size: 16px; font-weight: 600;">
                      Unavailable Dates
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                      ${conflictListHtml}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Meeting Details Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 20px 16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                      <tr>
                        <td style="padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0;">
                            <span style="display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Recurring Meeting Series</span>
                          </p>
                          <p style="margin: 8px 0 0; color: #64748b; font-size: 16px; font-weight: 600;">Meeting</p>
                          <p style="margin: 4px 0 0; color: #425cc7; font-size: 16px; font-weight: 600;">${data.subject}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; color: #64748b; font-size: 16px; font-weight: 600;">Room</p>
                          <p style="margin: 4px 0 0; color: #19226d; font-size: 16px; font-weight: 500;">${cleanLocationName(data.roomName)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 16px;">
                          <p style="margin: 0; color: #64748b; font-size: 16px; font-weight: 600;">Series Details</p>
                          ${seriesInfo}
                          ${seriesDateRange}
                          <p style="margin: 4px 0 0; color: #19226d; font-size: 16px; font-weight: 500;">Time: ${data.startTime} - ${data.endTime} (${timezoneDisplay})</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                Please check the conflicting dates above and consider rebooking them for a different room or time through Outlook.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">
                This is an automated message from the Aditum Bio Room Booking System.<br>
                Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

// Render a declined email specifically for series conflicts - lists ALL conflicts in main card
// Uses light theme to match the accepted email template
export function renderSeriesDeclinedEmail(data: EmailTemplateData): string {
  const logoUrl = data.logoUrl || process.env.LOGO_URL || "https://ai-booking-notifications-system.onrender.com/images/aditum-logo-horizontal.png"
  const timezoneDisplay = getTimezoneDisplayName(data.timeZone)

  // Build conflict list showing organizer and time for each conflict
  let conflictListHtml = ""
  if (data.conflictDates && data.conflictDates.length > 0) {
    conflictListHtml = data.conflictDates.map(conflict => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="color: #334155; font-size: 15px; font-weight: 500;">${conflict.organizerName || data.organizerName}</span>
          <span style="color: #64748b; font-size: 15px;"> - </span>
          <span style="color: #334155; font-size: 15px; font-weight: 500;">${conflict.date} ${conflict.startTime}</span>
          <span style="color: #64748b; font-size: 15px;"> to </span>
          <span style="color: #334155; font-size: 15px; font-weight: 500;">${conflict.date} ${conflict.endTime}</span>
        </td>
      </tr>
    `).join("")
  }

  // Series badge section - single consolidated badge
  const seriesBadges = data.isSeries ? `
    <div style="margin: 16px 0;">
      <span style="display: inline-block;  background-color: #dbeafe; color: #425cc7; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Recurring Meeting Series</span>
    </div>
  ` : ""

  const seriesInfo = data.isSeries && data.recurrencePattern ? `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
        ${seriesBadges}
        <p style="margin: 0; color: #334155; font-size: 15px; font-weight: 500;">${data.recurrencePattern}</p>
        ${data.seriesStartDate && data.seriesEndDate
      ? `<p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">${data.seriesStartDate} - ${data.seriesEndDate}</p>`
      : ""}
      </td>
    </tr>
  ` : ""

  const reasonText = data.conflictDates && data.conflictDates.length > 1
    ? `These ${data.conflictDates.length} instances were declined because there are conflicts.`
    : "This instance was declined because there are conflicts."

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Room Unavailable</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #f1f5f9;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 20px 24px; border-bottom: 1px solid #e2e8f0;" bgcolor="#ffffff">
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;" valign="middle" width="100">
                    <img src="${logoUrl}" alt="Aditum Bio" style="height: 48px; display: block;" height="48">
                  </td>
                  <td style="vertical-align: middle; text-align: center;" valign="middle" align="center">
                    <h1 style="margin: 0; color: #b91c1c; font-size: 20px; font-weight: 600; white-space: nowrap;">Room Unavailable</h1>
                  </td>
                  <td style="vertical-align: middle;" valign="middle" width="100">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 24px 20px;">
              <p style="margin: 0 0 16px; color: #334155; font-size: 15px; line-height: 1.6;">
                Hi ${data.organizerName},
              </p>
              
              <p style="margin: 0 0 24px; color: #334155; font-size: 15px; line-height: 1.6;">
                Unfortunately, your room booking request could not be confirmed.
              </p>
              
              <!-- Reason Banner -->
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #fef2f2; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 24px;">
                    <p style="margin: 0; color: #991b1b; font-size: 15px; font-weight: 500;">
                      <strong>Reason:</strong> ${reasonText}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Conflicts Card - Main card showing all conflicts -->
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                      <!-- Meeting Title -->
                      <tr>
                        <td style="padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; color: #64748b; font-size: 13px; font-weight: 600;">Declined Instances</p>
                          <p style="margin: 4px 0 0; color: #334155; font-size: 15px; font-weight: 600;">${data.subject}</p>
                        </td>
                      </tr>
                      
                      <!-- Room -->
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                            <tr>
                              <td width="70%">
                                <p style="margin: 0; color: #64748b; font-size: 13px; font-weight: 600;">Room</p>
                                <p style="margin: 4px 0 0; color: #334155; font-size: 15px; font-weight: 500;">${cleanLocationName(data.roomName)}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      
                      <!-- Conflicts List Header - Red Badge Pill -->
                      <tr>
                        <td style="padding: 16px 0 12px 0;">
                          <p style="margin: 0;">
                            <span style="display: inline-block; color: #b91c1c; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">The Conflicts Are</span>
                          </p>
                          <p style="margin: 12px 0 0; color: #64748b; font-size: 15px; font-weight: 600;">
                            Organizer and Time of Conflicting Meeting
                          </p>
                        </td>
                      </tr>
                      
                      <!-- Conflicts List -->
                      <tr>
                        <td>
                          <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                            ${conflictListHtml}
                          </table>
                        </td>
                      </tr>
                      
                      ${seriesInfo}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- What You Can Do Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; color: #1e40af; font-size: 15px; font-weight: 600;">What you can do:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 15px; line-height: 1.8;">
                      <li>Check for available time slots in Outlook</li>
                      <li>Try booking a different room</li>
                      <li>Contact the current room holder to negotiate</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">
                This is an automated message from the Aditum Bio Room Booking System.<br>
                Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

export function getEmailSubject(type: "accepted" | "declined", data: EmailTemplateData): string {
  // Use custom template subject if available
  const customTemplate = customTemplatesCache[type]
  const template = customTemplate?.subject ||
    (type === "accepted" ? defaultTemplates.accepted.subject : defaultTemplates.declined.subject)
  return replaceTemplateVariables(template, data)
}
