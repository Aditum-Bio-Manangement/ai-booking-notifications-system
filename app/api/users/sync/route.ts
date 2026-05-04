import { NextResponse } from "next/server"
import { getUsers, getUserPhoto } from "@/lib/microsoft-graph"
import { createAdminClient } from "@/lib/supabase/admin"
import { createAuditLog } from "@/lib/audit"

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
      let authUserId: string | null = null

      // First, check if auth user already exists by listing users with this email
      const { data: existingAuthUsers } = await supabase.auth.admin.listUsers()
      const existingAuthUser = existingAuthUsers?.users?.find(u => u.email === user.email)

      if (existingAuthUser) {
        authUserId = existingAuthUser.id
      } else {
        // Create new auth user
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          email_confirm: true,
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
        authUserId = authUser?.user?.id || null
      }

      if (!authUserId) {
        console.error(`[SYNC] No auth user ID for ${user.email}`)
        continue
      }

      // Upsert profile with M365 data
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert({
          id: authUserId,
          email: user.email,
          name: user.name,
          role: "viewer",
          department: user.department,
          title: user.title,
          phone: user.phone,
          avatar_url: user.avatarUrl,
          microsoft_id: user.microsoftId,
          status: "active",
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "id",
          ignoreDuplicates: false,
        })

      if (upsertError) {
        console.error(`[SYNC] Failed to upsert profile for ${user.email}:`, upsertError)
      }
    }

    // Log to audit log with actor info
    await createAuditLog({
      action: "users.synced",
      actorId: actorId || undefined,
      actorEmail: actorEmail || undefined,
      resourceType: "users",
      resourceId: undefined,
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
