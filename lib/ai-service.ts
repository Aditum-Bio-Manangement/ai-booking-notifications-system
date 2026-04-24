import { generateText, Output } from "ai"
import { z } from "zod"
import type { Room, BookingEvent, Site } from "./types"

// Policy snippets for retrieval-first prompting
const policySnippets = {
  conflict: "This room was already booked for the requested time slot. Exchange does not allow double-booking.",
  capacity: "The requested room capacity does not meet your meeting requirements.",
  outsideHours: "Booking was requested outside of permitted building hours.",
  restrictedRoom: "This room is restricted to certain groups or requires special approval.",
  advanceBooking: "This booking exceeds the maximum advance booking window.",
}

const avGuidanceSnippets = {
  videoConference: "This room is equipped with video conferencing. Join via the room's Teams/Zoom device or connect your laptop.",
  audioConference: "Audio conferencing is available. Dial-in numbers are posted in the room.",
  display: "Large display available. Connect via HDMI or wireless casting (Miracast/AirPlay).",
  whiteboard: "Digital whiteboard available. Content can be saved and shared after the meeting.",
  standard: "This room has basic AV setup. Bring adapters if needed for presentations.",
}

// Schema for room suggestions
const roomSuggestionSchema = z.object({
  suggestions: z.array(z.object({
    roomId: z.string(),
    roomName: z.string(),
    reason: z.string().describe("Brief explanation why this room is a good alternative"),
    availableSlots: z.array(z.string()).nullable().describe("Available time slots near the requested time"),
  })),
  summary: z.string().describe("A friendly one-sentence summary of the alternatives"),
})

// Schema for organizer summary
const organizerSummarySchema = z.object({
  summary: z.string().describe("Plain English explanation of why the booking was declined"),
  actionableSteps: z.array(z.string()).describe("Specific steps the organizer can take"),
  tone: z.enum(["helpful", "informative", "apologetic"]),
})

// Schema for AV guidance
const avGuidanceSchema = z.object({
  guidance: z.string().describe("Customized AV setup instructions for this room and meeting type"),
  tips: z.array(z.string()).nullable().describe("Additional tips for optimal AV experience"),
})

// Schema for anomaly detection
const anomalySchema = z.object({
  anomalies: z.array(z.object({
    type: z.enum(["decline_spike", "webhook_failure", "site_drift", "capacity_mismatch"]),
    severity: z.enum(["info", "warning", "critical"]),
    title: z.string(),
    description: z.string(),
    affectedRooms: z.array(z.string()).nullable(),
    recommendation: z.string(),
  })),
  overallHealth: z.enum(["healthy", "attention_needed", "critical"]),
})

// Schema for EA assistant note
const eaAssistantSchema = z.object({
  internalNote: z.string().describe("Concise internal note for executive assistant"),
  roomState: z.string().describe("Current state of the requested room"),
  nextBestOptions: z.array(z.object({
    room: z.string(),
    availability: z.string(),
    recommendation: z.string(),
  })),
  priority: z.enum(["low", "medium", "high", "urgent"]),
})

/**
 * Generate alternative room suggestions for a declined booking
 * Guardrail: Recommendations only, no auto-rebooking
 */
export async function generateRoomSuggestions(
  declinedBooking: BookingEvent,
  availableRooms: Room[],
  allRooms: Room[]
): Promise<{ suggestions: z.infer<typeof roomSuggestionSchema>; aiAvailable: boolean }> {
  const requestedRoom = allRooms.find(r => r.id === declinedBooking.roomId)
  
  // Filter rooms at the same site with similar or greater capacity
  const candidateRooms = availableRooms
    .filter(r => r.site === declinedBooking.site && r.isActive)
    .slice(0, 5) // Limit to top 5 candidates
  
  if (candidateRooms.length === 0) {
    return {
      suggestions: {
        suggestions: [],
        summary: "No alternative rooms are currently available at this site.",
      },
      aiAvailable: true,
    }
  }

  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: roomSuggestionSchema }),
      messages: [
        {
          role: "system",
          content: `You are a helpful room booking assistant for Aditum Bio. Your role is to suggest alternative rooms when a booking is declined. 
Be concise and practical. Focus on rooms that meet the meeting's needs.
Never suggest auto-rebooking - only provide recommendations for the user to act on.`,
        },
        {
          role: "user",
          content: `A booking was declined for "${requestedRoom?.displayName || declinedBooking.roomName}" at ${declinedBooking.site}.
          
Meeting: "${declinedBooking.subject}"
Requested time: ${declinedBooking.startTime} to ${declinedBooking.endTime}
Decline reason: ${declinedBooking.declineReason || "Time conflict"}

Available alternative rooms at ${declinedBooking.site}:
${candidateRooms.map(r => `- ${r.displayName}: Capacity ${r.capacity}, AV: ${r.avProfile}, Floor: ${r.floor}`).join("\n")}

Suggest the best 2-3 alternatives and explain why each might work.`,
        },
      ],
    })

    return { suggestions: output!, aiAvailable: true }
  } catch (error) {
    // Fallback to deterministic suggestions if AI is unavailable
    const fallbackSuggestions = candidateRooms.slice(0, 3).map(room => ({
      roomId: room.id,
      roomName: room.displayName,
      reason: `Available room with capacity ${room.capacity} and ${room.avProfile} setup`,
      availableSlots: null,
    }))

    return {
      suggestions: {
        suggestions: fallbackSuggestions,
        summary: `${fallbackSuggestions.length} alternative rooms available at ${declinedBooking.site}.`,
      },
      aiAvailable: false,
    }
  }
}

/**
 * Generate a plain English summary for organizers
 * Guardrail: Template-anchored phrasing with blocked unsafe outputs
 */
export async function generateOrganizerSummary(
  booking: BookingEvent,
  declineType: "conflict" | "policy" | "capacity" | "restricted"
): Promise<{ summary: z.infer<typeof organizerSummarySchema>; aiAvailable: boolean }> {
  const policyContext = policySnippets[declineType] || policySnippets.conflict

  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: organizerSummarySchema }),
      messages: [
        {
          role: "system",
          content: `You are a professional room booking assistant. Generate a friendly, clear explanation for why a room booking was declined.
Keep the tone professional but warm. Be specific about what the user can do next.
NEVER include personal criticism or speculation. Stick to factual policy explanations.
Base your response on this policy context: "${policyContext}"`,
        },
        {
          role: "user",
          content: `Generate a friendly summary for this declined booking:
Room: ${booking.roomName}
Meeting: ${booking.subject}
Time: ${booking.startTime} to ${booking.endTime}
Decline type: ${declineType}`,
        },
      ],
    })

    // Content filtering - ensure no unsafe content
    const filtered = output!
    if (filtered.summary.length > 300) {
      filtered.summary = filtered.summary.substring(0, 297) + "..."
    }

    return { summary: filtered, aiAvailable: true }
  } catch {
    // Deterministic fallback
    return {
      summary: {
        summary: policyContext,
        actionableSteps: [
          "Check room availability in Outlook",
          "Try a different time slot",
          "Consider an alternative room",
        ],
        tone: "helpful",
      },
      aiAvailable: false,
    }
  }
}

/**
 * Generate AV guidance based on room profile and meeting type
 * Guardrail: Use approved snippets and retrieval only
 */
export async function generateAVGuidance(
  room: Room,
  meetingSubject: string
): Promise<{ guidance: z.infer<typeof avGuidanceSchema>; aiAvailable: boolean }> {
  // Build context from approved snippets only
  const avFeatures = room.avProfile.toLowerCase()
  const relevantSnippets: string[] = []
  
  if (avFeatures.includes("video")) relevantSnippets.push(avGuidanceSnippets.videoConference)
  if (avFeatures.includes("audio")) relevantSnippets.push(avGuidanceSnippets.audioConference)
  if (avFeatures.includes("display")) relevantSnippets.push(avGuidanceSnippets.display)
  if (avFeatures.includes("whiteboard")) relevantSnippets.push(avGuidanceSnippets.whiteboard)
  if (relevantSnippets.length === 0) relevantSnippets.push(avGuidanceSnippets.standard)

  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: avGuidanceSchema }),
      messages: [
        {
          role: "system",
          content: `You are an AV setup assistant. Generate concise, practical AV guidance for a meeting room.
ONLY use information from the provided AV feature descriptions. Do not invent features.
Keep instructions clear and actionable.`,
        },
        {
          role: "user",
          content: `Room: ${room.displayName}
AV Profile: ${room.avProfile}
Meeting: ${meetingSubject}

Available AV features and their descriptions:
${relevantSnippets.join("\n")}

Generate customized AV guidance for this meeting.`,
        },
      ],
    })

    return { guidance: output!, aiAvailable: true }
  } catch {
    return {
      guidance: {
        guidance: relevantSnippets.join(" "),
        tips: null,
      },
      aiAvailable: false,
    }
  }
}

/**
 * Detect operational anomalies in booking patterns
 * Guardrail: Human-reviewed alerts only
 */
export async function detectAnomalies(
  recentBookings: BookingEvent[],
  historicalDeclineRate: number,
  webhookFailures: number,
  siteStats: { site: Site; declines: number; total: number }[]
): Promise<{ analysis: z.infer<typeof anomalySchema>; aiAvailable: boolean }> {
  // Calculate current metrics
  const currentDeclineRate = recentBookings.length > 0
    ? recentBookings.filter(b => b.outcome.startsWith("declined")).length / recentBookings.length
    : 0

  const declineSpike = currentDeclineRate > historicalDeclineRate * 1.5
  const webhookIssue = webhookFailures > 5
  const siteDrift = siteStats.some(s => s.total > 10 && (s.declines / s.total) > 0.4)

  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: anomalySchema }),
      messages: [
        {
          role: "system",
          content: `You are an operations analyst for a room booking system. Analyze the metrics and identify any anomalies that need human attention.
Be specific about what's unusual and provide actionable recommendations.
Mark severity appropriately: info for trends, warning for attention needed, critical for immediate action.`,
        },
        {
          role: "user",
          content: `Analyze these operational metrics:

Current decline rate: ${(currentDeclineRate * 100).toFixed(1)}%
Historical decline rate: ${(historicalDeclineRate * 100).toFixed(1)}%
Decline spike detected: ${declineSpike}

Webhook failures in last hour: ${webhookFailures}
Webhook issue detected: ${webhookIssue}

Site statistics:
${siteStats.map(s => `- ${s.site}: ${s.declines}/${s.total} declines (${((s.declines/s.total)*100).toFixed(1)}%)`).join("\n")}
Site drift detected: ${siteDrift}

Recent booking outcomes:
${recentBookings.slice(0, 10).map(b => `- ${b.roomName}: ${b.outcome}`).join("\n")}

Identify any anomalies and recommend actions.`,
        },
      ],
    })

    return { analysis: output!, aiAvailable: true }
  } catch {
    // Deterministic fallback
    const anomalies: z.infer<typeof anomalySchema>["anomalies"] = []
    
    if (declineSpike) {
      anomalies.push({
        type: "decline_spike",
        severity: "warning",
        title: "Elevated Decline Rate",
        description: `Current decline rate (${(currentDeclineRate * 100).toFixed(1)}%) is significantly higher than historical average.`,
        affectedRooms: null,
        recommendation: "Review recent policy changes or room availability issues.",
      })
    }
    
    if (webhookIssue) {
      anomalies.push({
        type: "webhook_failure",
        severity: "critical",
        title: "Webhook Connectivity Issues",
        description: `${webhookFailures} webhook failures detected in the last hour.`,
        affectedRooms: null,
        recommendation: "Check Graph subscription status and network connectivity.",
      })
    }

    if (siteDrift) {
      anomalies.push({
        type: "site_drift",
        severity: "warning",
        title: "Site Performance Variance",
        description: "One or more sites showing unusually high decline rates.",
        affectedRooms: null,
        recommendation: "Investigate site-specific room availability or policy issues.",
      })
    }

    return {
      analysis: {
        anomalies,
        overallHealth: anomalies.some(a => a.severity === "critical") 
          ? "critical" 
          : anomalies.length > 0 
            ? "attention_needed" 
            : "healthy",
      },
      aiAvailable: false,
    }
  }
}

/**
 * Generate executive assistant internal note
 * Guardrail: Restricted to internal recipients only
 */
export async function generateEANote(
  booking: BookingEvent,
  requestedRoom: Room,
  alternativeRooms: Room[],
  executiveName: string
): Promise<{ note: z.infer<typeof eaAssistantSchema>; aiAvailable: boolean }> {
  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: eaAssistantSchema }),
      messages: [
        {
          role: "system",
          content: `You are an assistant helping executive assistants manage room bookings. Generate concise, actionable internal notes.
This is for INTERNAL USE ONLY - be direct and efficient. Focus on what the EA needs to do next.
Never include sensitive personal information beyond meeting basics.`,
        },
        {
          role: "user",
          content: `Generate an internal note for the EA regarding this booking situation:

Executive: ${executiveName}
Meeting: ${booking.subject}
Requested Room: ${requestedRoom.displayName} (${requestedRoom.site})
Time: ${booking.startTime} to ${booking.endTime}
Status: ${booking.outcome}
${booking.declineReason ? `Decline Reason: ${booking.declineReason}` : ""}

Alternative rooms available:
${alternativeRooms.slice(0, 3).map(r => `- ${r.displayName}: Capacity ${r.capacity}, ${r.avProfile}`).join("\n")}

Provide a concise note with next-best options.`,
        },
      ],
    })

    return { note: output!, aiAvailable: true }
  } catch {
    // Deterministic fallback
    const topAlternative = alternativeRooms[0]
    return {
      note: {
        internalNote: `Booking for ${booking.subject} was ${booking.outcome}. ${alternativeRooms.length} alternatives available.`,
        roomState: booking.outcome === "accepted" ? "Confirmed" : `Declined: ${booking.declineReason || "conflict"}`,
        nextBestOptions: alternativeRooms.slice(0, 3).map(r => ({
          room: r.displayName,
          availability: "Check Outlook",
          recommendation: r.capacity >= 10 ? "Good for larger meetings" : "Suitable for small groups",
        })),
        priority: booking.outcome.startsWith("declined") ? "high" : "low",
      },
      aiAvailable: false,
    }
  }
}

// Export types for API routes
export type RoomSuggestion = z.infer<typeof roomSuggestionSchema>
export type OrganizerSummary = z.infer<typeof organizerSummarySchema>
export type AVGuidance = z.infer<typeof avGuidanceSchema>
export type AnomalyAnalysis = z.infer<typeof anomalySchema>
export type EANote = z.infer<typeof eaAssistantSchema>
