import { NextResponse } from "next/server"
import { generateRoomSuggestions } from "@/lib/ai-service"
import type { BookingEvent, Room } from "@/lib/types"

export async function POST(req: Request) {
  try {
    const { booking, availableRooms, allRooms } = await req.json() as {
      booking: BookingEvent
      availableRooms: Room[]
      allRooms: Room[]
    }

    if (!booking || !availableRooms || !allRooms) {
      return NextResponse.json(
        { error: "Missing required fields: booking, availableRooms, allRooms" },
        { status: 400 }
      )
    }

    const result = await generateRoomSuggestions(booking, availableRooms, allRooms)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("AI suggestions error:", error)
    return NextResponse.json(
      { 
        error: "Failed to generate suggestions",
        aiAvailable: false,
        suggestions: { suggestions: [], summary: "AI service temporarily unavailable." }
      },
      { status: 500 }
    )
  }
}
