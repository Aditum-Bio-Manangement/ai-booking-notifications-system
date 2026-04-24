import { NextRequest, NextResponse } from "next/server"
import { getUserProfile } from "@/lib/microsoft-graph"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Fetch profile from Microsoft Graph (without photo to avoid large payloads)
    const graphProfile = await getUserProfile(email)

    // Use API endpoint for photo instead of storing base64 data
    // This prevents cookies from becoming too large (431 error)
    const photoUrl = `/api/profile/photo?email=${encodeURIComponent(email)}`

    // If Supabase is configured, update the profile in the database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseKey) {
      const supabase = await createClient()

      // Get current session to get user ID
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        await supabase
          .from("profiles")
          .upsert({
            id: session.user.id,
            email: graphProfile.mail || email,
            name: graphProfile.displayName,
            department: graphProfile.department || null,
            title: graphProfile.jobTitle || null,
            phone: graphProfile.mobilePhone || graphProfile.businessPhones?.[0] || null,
            avatar_url: photoUrl,
            microsoft_id: graphProfile.id,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "id"
          })
      }
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: graphProfile.id,
        name: graphProfile.displayName,
        email: graphProfile.mail || email,
        department: graphProfile.department || "",
        title: graphProfile.jobTitle || "",
        phone: graphProfile.mobilePhone || graphProfile.businessPhones?.[0] || "",
        avatarUrl: photoUrl,
        officeLocation: graphProfile.officeLocation || "",
      }
    })
  } catch (error) {
    console.error("Profile sync error:", error)
    const message = error instanceof Error ? error.message : "Failed to sync profile"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
