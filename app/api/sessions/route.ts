// Handles GET (list all sessions)
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/utils/db"
import { ApiResponse, Session } from "@/lib/types"

// Returns all sessions ordered by most recent first
export async function GET(): Promise<NextResponse<ApiResponse<Session[]>>> {
  try {
    const sessions = await db.session.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            files: true,
            messages: true,
          },
        },
      },
    })

    // Map database shape to our Session type
    const mapped: Session[] = sessions.map((s: typeof sessions[number]) => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      fileCount: s._count.files,
      messageCount: s._count.messages,
      isPinned: s.isPinned,
    }))

    return NextResponse.json({ success: true, data: mapped })
  } catch (error) {
    console.error("[GET /api/sessions]", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch sessions" },
      { status: 500 }
    )
  }
}

// Creates a new session with the given name
export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<Session>>> {
  try {
    const body = await req.json()
    const { name } = body

    // Validate input
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Session name is required" },
        { status: 400 }
      )
    }

    const session = await db.session.create({
      data: { name: name.trim() },
      include: {
        _count: {
          select: {
            files: true,
            messages: true,
          },
        },
      },
    })

    const mapped: Session = {
      id: session.id,
      name: session.name,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      fileCount: session._count.files,
      messageCount: session._count.messages,
      isPinned: session.isPinned,
    }

    return NextResponse.json(
      { success: true, data: mapped },
      { status: 201 }
    )
  } catch (error) {
    console.error("[POST /api/sessions]", error)
    return NextResponse.json(
      { success: false, error: "Failed to create session" },
      { status: 500 }
    )
  }
}

