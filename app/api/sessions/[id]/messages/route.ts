
// Handles GET (list all messages)
// for a specific session
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/utils/db"
import { ApiResponse, Message } from "@/lib/types"

// Returns all messages for a session ordered
// oldest first (so chat renders top to bottom)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<Message[]>>> {
    try {
        const { id } = await params

        const session = await db.session.findUnique({ where: { id } })
        if (!session) {
            return NextResponse.json(
                { success: false, error: "Session not found" },
                { status: 404 }
            )
        }

        const messages = await db.message.findMany({
            where: { sessionId: id },
            orderBy: { createdAt: "asc" },
        })

        const mapped: Message[] = messages.map((m) => ({
            id: m.id,
            sessionId: m.sessionId,
            role: m.role as "user" | "assistant",
            content: m.content,
            createdAt: m.createdAt.toISOString(),
            chartData: m.chartData ? JSON.parse(m.chartData) : undefined,
        }))

        return NextResponse.json({ success: true, data: mapped })
    } catch (error) {
        console.error("[GET /api/sessions/[id]/messages]", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch messages" },
            { status: 500 }
        )
    }
}

// Saves a single message to the database
// Used internally by the agent route
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<Message>>> {
    try {
        const { id } = await params
        const body = await req.json()
        const { role, content } = body

        if (!role || !content) {
            return NextResponse.json(
                { success: false, error: "Role and content are required" },
                { status: 400 }
            )
        }

        if (role !== "user" && role !== "assistant") {
            return NextResponse.json(
                { success: false, error: "Role must be user or assistant" },
                { status: 400 }
            )
        }

        const session = await db.session.findUnique({ where: { id } })
        if (!session) {
            return NextResponse.json(
                { success: false, error: "Session not found" },
                { status: 404 }
            )
        }

        const message = await db.message.create({
            data: {
                sessionId: id,
                role,
                content,
            },
        })

        const mapped: Message = {
            id: message.id,
            sessionId: message.sessionId,
            role: message.role as "user" | "assistant",
            content: message.content,
            createdAt: message.createdAt.toISOString(),
        }

        return NextResponse.json(
            { success: true, data: mapped },
            { status: 201 }
        )
    } catch (error) {
        console.error("[POST /api/sessions/[id]/messages]", error)
        return NextResponse.json(
            { success: false, error: "Failed to save message" },
            { status: 500 }
        )
    }
}