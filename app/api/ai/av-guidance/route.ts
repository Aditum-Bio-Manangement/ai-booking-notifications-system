import { NextResponse } from "next/server"
import { generateAVGuidance } from "@/lib/ai-service"
import type { Room } from "@/lib/types"

export async function POST(req: Request) {
  try {
    const { room, meetingSubject } = await req.json() as {
      room: Room
      meetingSubject: string
    }

    if (!room || !meetingSubject) {
      return NextResponse.json(
        { error: "Missing required fields: room, meetingSubject" },
        { status: 400 }
      )
    }

    const result = await generateAVGuidance(room, meetingSubject)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("AI AV guidance error:", error)
    return NextResponse.json(
      { 
        error: "Failed to generate AV guidance",
        aiAvailable: false,
        guidance: {
          guidance: "Please check the room for available AV equipment.",
          tips: null
        }
      },
      { status: 500 }
    )
  }
}
