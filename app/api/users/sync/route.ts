import { NextResponse } from "next/server"
import { getUsers, getUserPhoto } from "@/lib/microsoft-graph"
import { createClient } from "@/lib/supabase/server"

export interface SyncedUser {
  id: string
  email: string
  name: string
  department?: string
  title?: string
  phone?: string
  avatarUrl?: string
  officeLocation?: string
  microsoftId: string
}

export async function GET() {
  try {
    // Fetch users from Microsoft Graph
    const graphUsers = await getUsers(100)
    
    const users: SyncedUser[] = graphUsers
      .filter(u => u.mail) // Only users with email
      .map(u => ({
        id: u.id,
        microsoftId: u.id,
        email: u.mail,
        name: u.displayName,
        department: u.department || undefined,
        title: u.jobTitle || undefined,
        phone: u.mobilePhone || u.businessPhones?.[0] || undefined,
        officeLocation: u.officeLocation || undefined,
      }))

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Users fetch error:", error)
    const message = error instanceof Error ? error.message : "Failed to fetch users"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userIds } = await request.json()
    
    if (!userIds || !Array.isArray(userIds)) {
      return NextResponse.json({ error: "userIds array is required" }, { status: 400 })
    }

    // Fetch users from Microsoft Graph
    const graphUsers = await getUsers(100)
    const selectedUsers = graphUsers.filter(u => userIds.includes(u.id))
    
    // Fetch photos for selected users
    const usersWithPhotos = await Promise.all(
      selectedUsers.map(async (u) => {
        const photo = await getUserPhoto(u.mail || u.userPrincipalName)
        return {
          microsoftId: u.id,
          email: u.mail || u.userPrincipalName,
          name: u.displayName,
          department: u.department || null,
          title: u.jobTitle || null,
          phone: u.mobilePhone || u.businessPhones?.[0] || null,
          avatarUrl: photo || null,
          officeLocation: u.officeLocation || null,
        }
      })
    )

    // If Supabase is configured, save to database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (supabaseUrl && supabaseKey) {
      const supabase = await createClient()
      
      for (const user of usersWithPhotos) {
        // Check if user exists by email
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", user.email)
          .single()
        
        if (existingUser) {
          // Update existing user
          await supabase
            .from("profiles")
            .update({
              name: user.name,
              department: user.department,
              title: user.title,
              phone: user.phone,
              avatar_url: user.avatarUrl,
              microsoft_id: user.microsoftId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingUser.id)
        } else {
          // Insert new user (they'll need to sign up/login to get a real profile)
          await supabase
            .from("synced_users")
            .upsert({
              microsoft_id: user.microsoftId,
              email: user.email,
              name: user.name,
              department: user.department,
              title: user.title,
              phone: user.phone,
              avatar_url: user.avatarUrl,
              synced_at: new Date().toISOString(),
            }, {
              onConflict: "microsoft_id"
            })
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      syncedCount: usersWithPhotos.length,
      users: usersWithPhotos 
    })
  } catch (error) {
    console.error("Users sync error:", error)
    const message = error instanceof Error ? error.message : "Failed to sync users"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
