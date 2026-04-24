import "server-only"
// Server-only email utilities (uses nodemailer)
import nodemailer from 'nodemailer'
import type { EmailConfig, SendEmailOptions } from './email-types'

// Re-export types for convenience in server code
export type { EmailConfig, SendEmailOptions }
export { defaultTestVariables, replaceTemplateVariables } from './email-types'

// Get email configuration from environment or database
export function getEmailConfig(): EmailConfig | null {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD
  const from = process.env.SMTP_FROM

  if (!host || !port || !user || !pass || !from) {
    return null
  }

  return {
    host,
    port: parseInt(port, 10),
    secure: parseInt(port, 10) === 465,
    auth: { user, pass },
    from,
  }
}

// Create nodemailer transporter
export function createTransporter(config: EmailConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  })
}

// Send email using nodemailer
export async function sendEmail(
  options: SendEmailOptions,
  config?: EmailConfig
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const emailConfig = config || getEmailConfig()

  if (!emailConfig) {
    return {
      success: false,
      error: 'Email configuration not found. Please configure SMTP settings.',
    }
  }

  try {
    const transporter = createTransporter(emailConfig)

    const result = await transporter.sendMail({
      from: emailConfig.from,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })

    return {
      success: true,
      messageId: result.messageId,
    }
  } catch (error) {
    console.error('Failed to send email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Verify SMTP connection
export async function verifySmtpConnection(
  config: EmailConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter(config)
    await transporter.verify()
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Send test email with variable preview
export async function sendTestEmail(
  to: string,
  templateSubject: string,
  templateHtml: string,
  variables: Record<string, string>,
  config?: EmailConfig
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { replaceTemplateVariables } = await import('./email-types')
  const subject = replaceTemplateVariables(templateSubject, variables)
  const html = replaceTemplateVariables(templateHtml, variables)

  return sendEmail({ to, subject, html }, config)
}
