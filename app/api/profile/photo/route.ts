import { NextRequest, NextResponse } from "next/server"
import { getAccessToken } from "@/lib/microsoft-graph"

// GET - Fetch user photo from Microsoft Graph on-demand
// This avoids storing large base64 data in cookies/database
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const email = searchParams.get("email")

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 })
        }

        const accessToken = await getAccessToken()

        // Fetch photo from Microsoft Graph
        const photoResponse = await fetch(
            `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/photo/$value`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        )

        if (!photoResponse.ok) {
            // Return a default avatar or 404
            return NextResponse.json({ error: "Photo not found" }, { status: 404 })
        }

        const photoBuffer = await photoResponse.arrayBuffer()
        const contentType = photoResponse.headers.get("content-type") || "image/jpeg"

        // Return the image directly with caching headers
        return new NextResponse(photoBuffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=3600, s-maxage=3600", // Cache for 1 hour
            },
        })
    } catch (error) {
        console.error("Photo fetch error:", error)
        return NextResponse.json({ error: "Failed to fetch photo" }, { status: 500 })
    }
}
