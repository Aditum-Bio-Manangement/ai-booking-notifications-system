import { NextResponse } from "next/server"
import { getAccessToken, getRoomMailboxes } from "@/lib/microsoft-graph"

export async function GET() {
  const results = {
    envVars: {
      AZURE_TENANT_ID: !!process.env.AZURE_TENANT_ID,
      AZURE_CLIENT_ID: !!process.env.AZURE_CLIENT_ID,
      AZURE_CLIENT_SECRET: !!process.env.AZURE_CLIENT_SECRET,
      NOTIFICATION_MAILBOX: process.env.NOTIFICATION_MAILBOX || "Not set",
    },
    tokenAcquisition: { success: false, error: null as string | null },
    graphApiAccess: { success: false, error: null as string | null, roomCount: 0 },
  }

  // Test 1: Token acquisition
  try {
    await getAccessToken()
    results.tokenAcquisition.success = true
  } catch (error) {
    results.tokenAcquisition.error = error instanceof Error ? error.message : "Unknown error"
  }

  // Test 2: Graph API access (only if token succeeded)
  if (results.tokenAcquisition.success) {
    try {
      const rooms = await getRoomMailboxes()
      results.graphApiAccess.success = true
      results.graphApiAccess.roomCount = rooms.length
    } catch (error) {
      results.graphApiAccess.error = error instanceof Error ? error.message : "Unknown error"
    }
  }

  const allPassed = results.tokenAcquisition.success && results.graphApiAccess.success

  return NextResponse.json({
    status: allPassed ? "connected" : "error",
    message: allPassed
      ? `Successfully connected to Microsoft Graph. Found ${results.graphApiAccess.roomCount} room mailboxes.`
      : "Connection test failed. See details below.",
    details: results,
    troubleshooting: !allPassed ? [
      "1. Verify the AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET are correct",
      "2. Ensure the app registration has the following Application permissions:",
      "   - Calendars.Read",
      "   - Place.Read.All",
      "   - Mail.Send",
      "   - User.Read.All",
      "3. Grant admin consent: Azure Portal → App registrations → Your app → API permissions → Grant admin consent",
      "4. If using Application Access Policies, ensure the app is allowed to access room mailboxes",
    ] : undefined,
  })
}
