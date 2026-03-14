// Handles GET (list all files)
// for a specific session
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/utils/db"
import { ApiResponse, UploadedFile } from "@/lib/types"

// Returns all uploaded files for a session
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<UploadedFile[]>>> {
    try {
        const { id } = await params

        const session = await db.session.findUnique({ where: { id } })
        if (!session) {
            return NextResponse.json(
                { success: false, error: "Session not found" },
                { status: 404 }
            )
        }

        const files = await db.uploadedFile.findMany({
            where: { sessionId: id },
            orderBy: { uploadedAt: "desc" },
        })

        const mapped: UploadedFile[] = files.map((f) => ({
            id: f.id,
            sessionId: f.sessionId,
            fileName: f.fileName,
            fileType: f.fileType as UploadedFile["fileType"],
            fileSize: f.fileSize,
            uploadedAt: f.uploadedAt.toISOString(),
            status: f.status as UploadedFile["status"],
            rowCount: f.rowCount ?? undefined,
            columnCount: f.columnCount ?? undefined,
            columns: f.columns ? JSON.parse(f.columns) : undefined,
        }))

        return NextResponse.json({ success: true, data: mapped })
    } catch (error) {
        console.error("[GET /api/sessions/[id]/files]", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch files" },
            { status: 500 }
        )
    }
}