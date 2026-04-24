import { NextResponse } from "next/server"
import { detectAnomalies } from "@/lib/ai-service"
import type { BookingEvent, Site } from "@/lib/types"

export async function POST(req: Request) {
  try {
    const { 
      recentBookings, 
      historicalDeclineRate, 
      webhookFailures, 
      siteStats 
    } = await req.json() as {
      recentBookings: BookingEvent[]
      historicalDeclineRate: number
      webhookFailures: number
      siteStats: { site: Site; declines: number; total: number }[]
    }

    if (!recentBookings) {
      return NextResponse.json(
        { error: "Missing required field: recentBookings" },
        { status: 400 }
      )
    }

    const result = await detectAnomalies(
      recentBookings,
      historicalDeclineRate || 0.15,
      webhookFailures || 0,
      siteStats || []
    )

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("AI anomaly detection error:", error)
    return NextResponse.json(
      { 
        error: "Failed to detect anomalies",
        aiAvailable: false,
        analysis: {
          anomalies: [],
          overallHealth: "healthy"
        }
      },
      { status: 500 }
    )
  }
}
