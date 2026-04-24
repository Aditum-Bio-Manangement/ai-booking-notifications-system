import { NextResponse } from "next/server"
import { getRoomMailboxes } from "@/lib/microsoft-graph"

export async function GET() {
  try {
    // Check if Microsoft Graph is configured
    if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET || !process.env.AZURE_TENANT_ID) {
      return NextResponse.json(
        { error: "Microsoft Graph not configured", configured: false },
        { status: 503 }
      )
    }

    const rooms = await getRoomMailboxes()
    
    // Transform to our room format with office detection
    const transformedRooms = rooms.map((room) => {
      // Extract site from displayName pattern "Room Name - Site" (handles " - ", "- ", "-", " -")
      let site = "Cambridge" // default
      const displayName = room.displayName || ""
      // Match various dash formats: " - ", "- ", " -", "-"
      const dashMatch = displayName.match(/\s*-\s*([^-]+)$/)
      if (dashMatch && dashMatch[1]) {
        const extractedSite = dashMatch[1].trim()
        if (extractedSite) {
          site = extractedSite
        }
      } else if (room.building?.toLowerCase().includes("oakland") ||
                 room.emailAddress?.toLowerCase().includes("oak")) {
        site = "Oakland"
      }
      
      // Build AV profile string from available devices
      const avFeatures: string[] = []
      if (room.videoDeviceName) avFeatures.push("Video")
      if (room.audioDeviceName) avFeatures.push("Audio")
      if (room.displayDeviceName) avFeatures.push("Display")
      const avProfile = avFeatures.length > 0 ? avFeatures.join(", ") : "Standard"
      
      return {
        id: room.id,
        displayName: room.displayName || "Unknown Room",
        roomUpn: room.emailAddress || "",
        capacity: room.capacity || 0,
        site,
        building: room.building || "Main",
        floor: room.floorNumber ? `Floor ${room.floorNumber}` : "Floor 1",
        avProfile,
        accessNotes: room.isWheelChairAccessible ? "Wheelchair accessible" : "Standard access",
        isActive: true,
      }
    })

    return NextResponse.json({ rooms: transformedRooms, configured: true })
  } catch (error) {
    console.error("Error fetching rooms:", error)
    return NextResponse.json(
      { error: "Failed to fetch rooms", message: String(error) },
      { status: 500 }
    )
  }
}
