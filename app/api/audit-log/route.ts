import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export interface AuditLogEntry {
  id: string
  user_id: string | null
  user_email: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

// GET - Fetch audit log entries with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      // Return empty data instead of error so UI doesn't break
      return NextResponse.json({ entries: [], total: 0, limit: 50, offset: 0 }, { status: 200 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")
    const action = searchParams.get("action")
    const resourceType = searchParams.get("resourceType")
    const userEmail = searchParams.get("userEmail")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    let query = supabase
      .from("audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (action) {
      query = query.eq("action", action)
    }
    if (resourceType) {
      query = query.eq("resource_type", resourceType)
    }
    if (userEmail) {
      query = query.ilike("user_email", `%${userEmail}%`)
    }
    if (startDate) {
      query = query.gte("created_at", startDate)
    }
    if (endDate) {
      query = query.lte("created_at", endDate)
    }

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching audit log:", error)
      // Return empty data on error so UI can show "no entries" gracefully
      return NextResponse.json({ entries: [], total: 0, limit, offset, error: error.message }, { status: 200 })
    }

    return NextResponse.json({ 
      entries: data || [], 
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error in audit log GET:", error)
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 })
  }
}

// POST - Create a new audit log entry
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const body = await request.json()
    const { user_id, user_email, action, resource_type, resource_id, details } = body

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("audit_log")
      .insert({
        user_id: user_id || null,
        user_email: user_email || null,
        action,
        resource_type: resource_type || null,
        resource_id: resource_id || null,
        details: details || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating audit log entry:", error)
      return NextResponse.json({ error: "Failed to create audit log entry" }, { status: 500 })
    }

    return NextResponse.json({ entry: data })
  } catch (error) {
    console.error("Error in audit log POST:", error)
    return NextResponse.json({ error: "Failed to create audit log entry" }, { status: 500 })
  }
}
