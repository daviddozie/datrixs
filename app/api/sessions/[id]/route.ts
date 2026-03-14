
// Handles operations on a specific
// session — DELETE, and GET single session
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/utils/db"
import { ApiResponse, Session } from "@/lib/types"

// Returns a single session by ID
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<Session>>> {
    try {
        const { id } = await params

        const session = await db.session.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        files: true,
                        messages: true,
                    },
                },
            },
        })

        if (!session) {
            return NextResponse.json(
                { success: false, error: "Session not found" },
                { status: 404 }
            )
        }

        const mapped: Session = {
            id: session.id,
            name: session.name,
            createdAt: session.createdAt.toISOString(),
            updatedAt: session.updatedAt.toISOString(),
            fileCount: session._count.files,
            messageCount: session._count.messages,
        }

        return NextResponse.json({ success: true, data: mapped })
    } catch (error) {
        console.error("[GET /api/sessions/[id]]", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch session" },
            { status: 500 }
        )
    }
}

// Deletes a session and all its files and messages
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<null>>> {
    try {
        const { id } = await params

        // Check session exists first
        const session = await db.session.findUnique({ where: { id } })
        if (!session) {
            return NextResponse.json(
                { success: false, error: "Session not found" },
                { status: 404 }
            )
        }

        await db.session.delete({ where: { id } })

        return NextResponse.json({ success: true, data: null })
    } catch (error) {
        console.error("[DELETE /api/sessions/[id]]", error)
        return NextResponse.json(
            { success: false, error: "Failed to delete session" },
            { status: 500 }
        )
    }
}