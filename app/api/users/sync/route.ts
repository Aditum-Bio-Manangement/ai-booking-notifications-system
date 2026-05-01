import { NextResponse } from "next/server"
import { getUsers, getUserPhoto } from "@/lib/microsoft-graph"
import { createAdminClient } from "@/lib/supabase/admin"
import { db } from "@/lib/db"

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
    // Fetch ALL users from Microsoft Graph with @aditumbio.com UPN
    // Uses pagination to get all users, not just the first page
    const graphUsers = await getUsers({
      domain: "aditumbio.com",
      fetchAll: true,
      top: 100  // Page size for each request
    })

    const users: SyncedUser[] = graphUsers
      .filter(u => u.mail || u.userPrincipalName) // Users with email or UPN
      .map(u => ({
        id: u.id,
        microsoftId: u.id,
        email: u.mail || u.userPrincipalName,
        name: u.displayName,
        department: u.department || undefined,
        title: u.jobTitle || undefined,
        phone: u.mobilePhone || u.businessPhones?.[0] || undefined,
        officeLocation: u.officeLocation || undefined,
      }))

    return NextResponse.json({ users, total: users.length })
  } catch (error) {
    console.error("Users fetch error:", error)
    const message = error instanceof Error ? error.message : "Failed to fetch users"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userIds, actorEmail, actorId } = await request.json()

    if (!userIds || !Array.isArray(userIds)) {
      return NextResponse.json({ error: "userIds array is required" }, { status: 400 })
    }

    // Fetch users from Microsoft Graph (all aditumbio.com users)
    const graphUsers = await getUsers({ domain: "aditumbio.com", fetchAll: true })
    const selectedUsers = graphUsers.filter(u => userIds.includes(u.id))

    // Fetch photos for selected users
    const usersWithPhotos = await Promise.all(
      selectedUsers.map(async (u) => {
        let photo: string | null = null
        try {
          photo = await getUserPhoto(u.mail || u.userPrincipalName)
        } catch (e) {
          console.log(`[SYNC] Could not fetch photo for ${u.mail}:`, e)
        }
        return {
          microsoftId: u.id,
          email: u.mail || u.userPrincipalName,
          name: u.displayName,
          department: u.department || null,
          title: u.jobTitle || null,
          phone: u.mobilePhone || u.businessPhones?.[0] || null,
          avatarUrl: photo,
          officeLocation: u.officeLocation || null,
        }
      })
    )

    // Save to profiles table using admin client (bypasses RLS)
    const supabase = createAdminClient()

    if (!supabase) {
      console.error("[SYNC] Supabase admin client not configured - missing SUPABASE_SERVICE_ROLE_KEY")
      return NextResponse.json({
        error: "Database not configured. Please set SUPABASE_SERVICE_ROLE_KEY environment variable."
      }, { status: 500 })
    }

    // Sync each user - create auth user if needed, then create/update profile
    for (const user of usersWithPhotos) {
      // Check if user already exists in profiles
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", user.email)
        .single()

      if (existingProfile) {
        // Update existing profile with M365 data
        const { error: updateError } = await supabase
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
          .eq("id", existingProfile.id)

        if (updateError) {
          console.error(`[SYNC] Failed to update profile for ${user.email}:`, updateError)
        }
      } else {
        // User doesn't exist - create auth user first, then profile
        // Create user in Supabase Auth using admin API
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          email_confirm: true, // Auto-confirm since they're from M365
          user_metadata: {
            name: user.name,
            microsoft_id: user.microsoftId,
            provider: 'azure',
          },
        })

        if (authError) {
          console.error(`[SYNC] Failed to create auth user for ${user.email}:`, authError)
          continue
        }

        if (authUser?.user) {
          // Now create the profile with the auth user's ID
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: authUser.user.id, // Use the auth user's ID
              email: user.email,
              name: user.name,
              role: "viewer", // Default role for synced users
              department: user.department,
              title: user.title,
              phone: user.phone,
              avatar_url: user.avatarUrl,
              microsoft_id: user.microsoftId,
              status: "active",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })

          if (profileError) {
            console.error(`[SYNC] Failed to create profile for ${user.email}:`, profileError)
          }
        }
      }
    }

    // Log to audit log with actor info
    await db.auditLog.create({
      user_id: actorId || null,
      user_email: actorEmail || null,
      action: "users.synced",
      resource_type: "users",
      details: {
        syncedCount: usersWithPhotos.length,
        userEmails: usersWithPhotos.map(u => u.email),
      },
    })

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
