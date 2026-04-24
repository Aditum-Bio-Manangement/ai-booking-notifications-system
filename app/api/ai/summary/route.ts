import { NextResponse } from "next/server"
import { generateOrganizerSummary } from "@/lib/ai-service"
import type { BookingEvent } from "@/lib/types"

export async function POST(req: Request) {
  try {
    const { booking, declineType } = await req.json() as {
      booking: BookingEvent
      declineType: "conflict" | "policy" | "capacity" | "restricted"
    }

    if (!booking || !declineType) {
      return NextResponse.json(
        { error: "Missing required fields: booking, declineType" },
        { status: 400 }
      )
    }

    const result = await generateOrganizerSummary(booking, declineType)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("AI summary error:", error)
    return NextResponse.json(
      { 
        error: "Failed to generate summary",
        aiAvailable: false,
        summary: {
          summary: "Your booking request could not be completed at this time.",
          actionableSteps: ["Check room availability in Outlook", "Try a different time slot"],
          tone: "helpful"
        }
      },
      { status: 500 }
    )
  }
}
