import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export interface ProfileUser {
    id: string
    email: string
    name: string
    role: "admin" | "operator" | "viewer"
    status: "active" | "invited" | "disabled"
    avatar_url?: string
    department?: string
    title?: string
    phone?: string
    last_login?: string
    created_at: string
}

// GET - Fetch all profiles
export async function GET() {
    try {
        const supabase = createAdminClient()
        if (!supabase) {
            return NextResponse.json({ users: [], error: "Database not configured" }, { status: 200 })
        }

        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: false })

        if (error) {
            console.error("Error fetching profiles:", error)
            return NextResponse.json({ users: [], error: error.message }, { status: 200 })
        }

        const users: ProfileUser[] = (data || []).map((p) => ({
            id: p.id,
            email: p.email || "",
            name: p.name || p.email?.split("@")[0] || "Unknown",
            role: p.role || "viewer",
            status: p.status || "active",
            avatar_url: p.avatar_url,
            department: p.department,
            title: p.title,
            phone: p.phone,
            last_login: p.last_login,
            created_at: p.created_at,
        }))

        return NextResponse.json({ users })
    } catch (error) {
        console.error("Error in profiles GET:", error)
        return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 })
    }
}

// POST - Create a new profile (invite user)
export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        if (!supabase) {
            return NextResponse.json({ error: "Database not configured" }, { status: 500 })
        }

        const body = await request.json()
        const { email, name, role } = body

        if (!email || !name) {
            return NextResponse.json({ error: "Email and name are required" }, { status: 400 })
        }

        // Check if user already exists
        const { data: existing } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", email)
            .single()

        if (existing) {
            return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
        }

        // Create a new profile with invited status
        const { data, error } = await supabase
            .from("profiles")
            .insert({
                id: crypto.randomUUID(),
                email,
                name,
                role: role || "viewer",
                status: "invited",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (error) {
            console.error("Error creating profile:", error)
            return NextResponse.json({ error: "Failed to create profile" }, { status: 500 })
        }

        return NextResponse.json({ user: data })
    } catch (error) {
        console.error("Error in profiles POST:", error)
        return NextResponse.json({ error: "Failed to create profile" }, { status: 500 })
    }
}

// PATCH - Update a profile
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        if (!supabase) {
            return NextResponse.json({ error: "Database not configured" }, { status: 500 })
        }

        const body = await request.json()
        const { id, ...updates } = body

        if (!id) {
            return NextResponse.json({ error: "Profile ID is required" }, { status: 400 })
        }

        const { data, error } = await supabase
            .from("profiles")
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .select()
            .single()

        if (error) {
            console.error("Error updating profile:", error)
            return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
        }

        return NextResponse.json({ user: data })
    } catch (error) {
        console.error("Error in profiles PATCH:", error)
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
    }
}

// DELETE - Remove a profile
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        if (!supabase) {
            return NextResponse.json({ error: "Database not configured" }, { status: 500 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get("id")

        if (!id) {
            return NextResponse.json({ error: "Profile ID is required" }, { status: 400 })
        }

        const { error } = await supabase
            .from("profiles")
            .delete()
            .eq("id", id)

        if (error) {
            console.error("Error deleting profile:", error)
            return NextResponse.json({ error: "Failed to delete profile" }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error in profiles DELETE:", error)
        return NextResponse.json({ error: "Failed to delete profile" }, { status: 500 })
    }
}
