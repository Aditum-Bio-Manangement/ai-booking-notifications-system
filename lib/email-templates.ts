import { format } from "date-fns"

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
            <td style="background: linear-gradient(135deg, #4169E1 0%, #3DD6D0 100%); padding: 32px; text-align: center;" bgcolor="#4169E1">
              <!--[if mso]>
              <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:140px;">
              <v:fill type="gradient" color="#3DD6D0" color2="#4169E1" angle="135"/>
              <v:textbox inset="0,0,0,0">
              <![endif]-->
              <div style="background: linear-gradient(135deg, #4169E1 0%, #3DD6D0 100%); padding: 32px; text-align: center;">
                <img src="{{logoUrl}}" alt="Aditum Bio" style="height: 60px; margin-bottom: 16px;" height="60">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Room Booking Confirmed</h1>
              </div>
              <!--[if mso]>
              </v:textbox>
              </v:rect>
              <![endif]-->
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #1E3A5F; font-size: 16px; line-height: 1.6;">
                Hi {{organizerName}},
              </p>
              
              <p style="margin: 0 0 24px; color: #1E3A5F; font-size: 16px; line-height: 1.6;">
                Great news! Your room booking has been confirmed.
              </p>
              
              <!-- Booking Details Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                      <tr>
                        <td style="padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Meeting</p>
                          <p style="margin: 4px 0 0; color: #1E3A5F; font-size: 18px; font-weight: 600;">{{subject}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                            <tr>
                              <td width="50%" style="vertical-align: top;">
                                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Room</p>
                                <p style="margin: 4px 0 0; color: #1E3A5F; font-size: 16px; font-weight: 500;">{{roomName}}</p>
                              </td>
                              <td width="50%" style="vertical-align: top;">
                                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Date</p>
                                <p style="margin: 4px 0 0; color: #1E3A5F; font-size: 16px; font-weight: 500;">{{date}}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 16px;">
                          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Time</p>
                          <p style="margin: 4px 0 0; color: #1E3A5F; font-size: 16px; font-weight: 500;">{{startTime}} - {{endTime}} ({{timeZone}})</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
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
            <td style="background: linear-gradient(135deg, #1E3A5F 0%, #4169E1 100%); padding: 32px; text-align: center;" bgcolor="#1E3A5F">
              <!--[if mso]>
              <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:140px;">
              <v:fill type="gradient" color="#4169E1" color2="#1E3A5F" angle="135"/>
              <v:textbox inset="0,0,0,0">
              <![endif]-->
              <div style="background: linear-gradient(135deg, #1E3A5F 0%, #4169E1 100%); padding: 32px; text-align: center;">
                <img src="{{logoUrl}}" alt="Aditum Bio" style="height: 60px; margin-bottom: 16px;" height="60">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Room Unavailable</h1>
              </div>
              <!--[if mso]>
              </v:textbox>
              </v:rect>
              <![endif]-->
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #1E3A5F; font-size: 16px; line-height: 1.6;">
                Hi {{organizerName}},
              </p>
              
              <p style="margin: 0 0 24px; color: #1E3A5F; font-size: 16px; line-height: 1.6;">
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
                  <td style="padding: 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                      <tr>
                        <td style="padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Requested Meeting</p>
                          <p style="margin: 4px 0 0; color: #1E3A5F; font-size: 18px; font-weight: 600;">{{subject}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                            <tr>
                              <td width="50%" style="vertical-align: top;">
                                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Room</p>
                                <p style="margin: 4px 0 0; color: #1E3A5F; font-size: 16px; font-weight: 500;">{{roomName}}</p>
                              </td>
                              <td width="50%" style="vertical-align: top;">
                                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Date</p>
                                <p style="margin: 4px 0 0; color: #1E3A5F; font-size: 16px; font-weight: 500;">{{date}}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 16px;">
                          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Time</p>
                          <p style="margin: 4px 0 0; color: #1E3A5F; font-size: 16px; font-weight: 500;">{{startTime}} - {{endTime}} ({{timeZone}})</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Suggestions -->
              <div style="margin-top: 24px; padding: 20px; background-color: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                <p style="margin: 0 0 12px; color: #1e40af; font-size: 14px; font-weight: 600;">What you can do:</p>
                <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px; line-height: 1.8;">
                  <li>Check for available time slots in Outlook</li>
                  <li>Try booking a different room</li>
                  <li>Contact the current room holder to negotiate</li>
                </ul>
              </div>
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
  roomName: string
  subject: string
  startTime: string
  endTime: string
  timeZone: string
  reason?: string
  logoUrl?: string
}

function formatDateTime(isoString: string, timeZone: string) {
  const date = new Date(isoString)
  return {
    date: format(date, "EEEE, MMMM d, yyyy"),
    time: format(date, "h:mm a"),
  }
}

function replaceTemplateVariables(template: string, data: EmailTemplateData): string {
  const start = formatDateTime(data.startTime, data.timeZone)
  const end = formatDateTime(data.endTime, data.timeZone)
  
  const logoUrl = data.logoUrl || process.env.LOGO_URL || "https://aditumbio.com/logo.png"
  
  return template
    .replace(/\{\{organizerName\}\}/g, data.organizerName)
    .replace(/\{\{roomName\}\}/g, data.roomName)
    .replace(/\{\{subject\}\}/g, data.subject)
    .replace(/\{\{date\}\}/g, start.date)
    .replace(/\{\{startTime\}\}/g, start.time)
    .replace(/\{\{endTime\}\}/g, end.time)
    .replace(/\{\{timeZone\}\}/g, data.timeZone)
    .replace(/\{\{reason\}\}/g, data.reason || "")
    .replace(/\{\{logoUrl\}\}/g, logoUrl)
}

export function renderAcceptedEmail(data: EmailTemplateData): string {
  return replaceTemplateVariables(defaultTemplates.accepted.body, data)
}

export function renderDeclinedEmail(data: EmailTemplateData): string {
  return replaceTemplateVariables(defaultTemplates.declined.body, data)
}

export function getEmailSubject(type: "accepted" | "declined", data: EmailTemplateData): string {
  const template = type === "accepted" ? defaultTemplates.accepted.subject : defaultTemplates.declined.subject
  return replaceTemplateVariables(template, data)
}
