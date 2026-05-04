import { db } from "@/lib/db"

// Audit action types - comprehensive list of all trackable actions
export type AuditAction =
    // Authentication
    | "user.login"
    | "user.logout"
    | "user.login_failed"
    | "user.created"
    | "user.updated"
    | "user.deleted"
    | "user.role_changed"
    | "users.synced"
    // Subscriptions
    | "subscription.created"
    | "subscription.deleted"
    | "subscription.renewed"
    | "subscription.expired"
    // Settings
    | "settings.updated"
    | "settings.notifications_updated"
    | "settings.smtp_updated"
    | "settings.sso_updated"
    | "settings.general_updated"
    // Email Templates
    | "email.template.updated"
    | "email.template.reset"
    | "email.test_sent"
    // Rooms
    | "room.subscribed"
    | "room.unsubscribed"
    | "room.settings_updated"
    | "room.policy_updated"
    | "room.delegate_changed"
    | "room.notifications.updated"
    | "room.notifications.bulk_updated"
    | "rooms.notifications.suppressed"
    | "rooms.notifications.enabled"
    // Test Notifications
    | "test.notification.sent"
    // Notifications
    | "notification.sent"
    | "notification.failed"
    | "notification.resent"
    | "notification.deleted"
    // Processing Queue
    | "queue.item_deleted"
    | "queue.cleared"
    // Calendar Processing
    | "calendar.event_processed"
    | "calendar.event_accepted"
    | "calendar.event_declined"
    // Booking Actions
    | "booking.deleted"
    | "booking.marked_failed"

export interface AuditLogParams {
    action: AuditAction | string
    actorId?: string | null
    actorEmail?: string | null
    resourceType?: string | null
    resourceId?: string | null
    resourceName?: string | null // Human-readable name (e.g., room name)
    details?: Record<string, unknown> | null
}

/**
 * Create an audit log entry with actor information
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
    const { action, actorId, actorEmail, resourceType, resourceId, resourceName, details } = params

    // Merge resourceName into details if provided
    const mergedDetails = {
        ...details,
        ...(resourceName ? { resourceName } : {}),
    }

    await db.auditLog.create({
        user_id: actorId,
        user_email: actorEmail,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details: Object.keys(mergedDetails).length > 0 ? mergedDetails : null,
    })
}

/**
 * Helper to get audit context from request body
 * Components should send actorEmail and actorId in the request body
 */
export function getAuditContext(body: Record<string, unknown>): { actorId?: string; actorEmail?: string } {
    return {
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        actorEmail: typeof body.actorEmail === "string" ? body.actorEmail : undefined,
    }
}
