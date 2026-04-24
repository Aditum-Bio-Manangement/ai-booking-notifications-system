import { NextResponse } from "next/server"
import { generateEANote } from "@/lib/ai-service"
import type { BookingEvent, Room } from "@/lib/types"

export async function POST(req: Request) {
  try {
    const { 
      booking, 
      requestedRoom, 
      alternativeRooms, 
      executiveName 
    } = await req.json() as {
      booking: BookingEvent
      requestedRoom: Room
      alternativeRooms: Room[]
      executiveName: string
    }

    if (!booking || !requestedRoom || !alternativeRooms || !executiveName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const result = await generateEANote(
      booking,
      requestedRoom,
      alternativeRooms,
      executiveName
    )

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("AI EA note error:", error)
    return NextResponse.json(
      { 
        error: "Failed to generate EA note",
        aiAvailable: false,
        note: {
          internalNote: "Unable to generate AI note at this time.",
          roomState: "Unknown",
          nextBestOptions: [],
          priority: "medium"
        }
      },
      { status: 500 }
    )
  }
}
