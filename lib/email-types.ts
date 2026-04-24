// Client-safe email types and constants - DO NOT import nodemailer here

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  from: string
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export interface TestVariable {
  key: string
  value: string
  description?: string
}

// Default test variables for email templates
export const defaultTestVariables: TestVariable[] = [
  { key: 'organizerName', value: 'John Smith', description: 'Name of the meeting organizer' },
  { key: 'roomName', value: 'Board Room - Cambridge', description: 'Name of the conference room' },
  { key: 'subject', value: 'Q1 Planning Meeting', description: 'Meeting subject/title' },
  { key: 'date', value: 'Monday, March 27, 2026', description: 'Meeting date' },
  { key: 'startTime', value: '10:00 AM', description: 'Meeting start time' },
  { key: 'endTime', value: '11:30 AM', description: 'Meeting end time' },
  { key: 'timeZone', value: 'EST', description: 'Time zone' },
  { key: 'reason', value: 'The room has a scheduling conflict with an existing booking.', description: 'Decline reason' },
  { key: 'logoUrl', value: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Aditum%20Logo%20Horizontal%201536x1024-5t69K1LQrBFk3K8lGSV6y6nHkWuYrG.png', description: 'Company logo URL' },
  { key: 'organizerEmail', value: 'john.smith@aditumbio.com', description: 'Organizer email address' },
  { key: 'attendees', value: '5', description: 'Number of attendees' },
  { key: 'site', value: 'Cambridge', description: 'Office location' },
]

// Replace template variables with actual values (client-safe)
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(regex, value)
  }
  return result
}
