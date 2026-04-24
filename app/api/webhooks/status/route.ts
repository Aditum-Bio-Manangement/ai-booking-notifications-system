import { NextResponse } from "next/server"

export async function GET() {
  const webhookUrl = process.env.WEBHOOK_URL
  const vercelUrl = process.env.VERCEL_URL
  const notificationMailbox = process.env.NOTIFICATION_MAILBOX
  
  // Determine the effective webhook URL
  let effectiveUrl = webhookUrl
  if (!effectiveUrl && vercelUrl) {
    effectiveUrl = `https://${vercelUrl}/api/webhooks/graph`
  }
  if (!effectiveUrl) {
    effectiveUrl = "http://localhost:3000/api/webhooks/graph"
  }
  
  // Check if URL is publicly accessible (not localhost)
  const isPublicUrl = effectiveUrl.startsWith("https://") && !effectiveUrl.includes("localhost")
  
  // Check if notification mailbox is configured
  const hasNotificationMailbox = !!notificationMailbox
  
  return NextResponse.json({
    webhookUrl: effectiveUrl,
    isConfigured: !!webhookUrl,
    isPublicUrl,
    hasNotificationMailbox,
    notificationMailbox: notificationMailbox || null,
    vercelUrl: vercelUrl || null,
    issues: [
      !webhookUrl && "WEBHOOK_URL environment variable not set",
      !isPublicUrl && "Webhook URL must be a public HTTPS URL for Microsoft Graph to send notifications",
      !hasNotificationMailbox && "NOTIFICATION_MAILBOX not configured - custom emails cannot be sent",
    ].filter(Boolean),
  })
}
