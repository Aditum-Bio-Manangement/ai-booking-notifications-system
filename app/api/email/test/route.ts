import { NextRequest, NextResponse } from 'next/server'
import { sendTestEmail, getEmailConfig, verifySmtpConnection, type EmailConfig } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, html, variables, smtpConfig } = body

    if (!to) {
      return NextResponse.json(
        { error: 'Recipient email address is required' },
        { status: 400 }
      )
    }

    if (!subject || !html) {
      return NextResponse.json(
        { error: 'Email subject and HTML content are required' },
        { status: 400 }
      )
    }

    // Use provided SMTP config or fall back to environment variables
    let config: EmailConfig | null = null
    
    if (smtpConfig) {
      config = {
        host: smtpConfig.host,
        port: parseInt(smtpConfig.port, 10),
        secure: parseInt(smtpConfig.port, 10) === 465,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass,
        },
        from: smtpConfig.from,
      }
    } else {
      config = getEmailConfig()
    }

    if (!config) {
      return NextResponse.json(
        { 
          error: 'SMTP not configured',
          message: 'Please configure SMTP settings in System Settings or set SMTP environment variables.',
        },
        { status: 503 }
      )
    }

    const result = await sendTestEmail(
      to,
      subject,
      html,
      variables || {},
      config
    )

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send email', message: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: `Test email sent successfully to ${to}`,
    })
  } catch (error) {
    console.error('Error sending test email:', error)
    return NextResponse.json(
      { error: 'Failed to send test email', message: String(error) },
      { status: 500 }
    )
  }
}

// Verify SMTP connection
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { smtpConfig } = body

    if (!smtpConfig) {
      const config = getEmailConfig()
      if (!config) {
        return NextResponse.json(
          { error: 'SMTP not configured' },
          { status: 503 }
        )
      }
      
      const result = await verifySmtpConnection(config)
      return NextResponse.json(result)
    }

    const config: EmailConfig = {
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port, 10),
      secure: parseInt(smtpConfig.port, 10) === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      from: smtpConfig.from,
    }

    const result = await verifySmtpConnection(config)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error verifying SMTP:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
