import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/utils/db"
import { ApiResponse, UploadedFile } from "@/lib/types"

const ALLOWED_TYPES = [
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
]

const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(
    req: NextRequest
): Promise<NextResponse<ApiResponse<UploadedFile>>> {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File | null
        const sessionId = formData.get("sessionId") as string | null

        if (!file) {
            return NextResponse.json(
                { success: false, error: "No file provided" },
                { status: 400 }
            )
        }

        if (!sessionId) {
            return NextResponse.json(
                { success: false, error: "Session ID is required" },
                { status: 400 }
            )
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "File type not supported. Please upload CSV, XLSX, PDF, or image files",
                },
                { status: 400 }
            )
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                {
                    success: false,
                    error: "File size exceeds 10MB limit",
                },
                { status: 400 }
            )
        }

        const session = await db.session.findUnique({ where: { id: sessionId } })
        if (!session) {
            return NextResponse.json(
                { success: false, error: "Session not found" },
                { status: 404 }
            )
        }

        // Read file bytes into memory — no disk write needed
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Determine file type from mime type
        const fileType = getFileType(file.type)

        // Save file record to database with "processing" status
        // filePath is empty string — we no longer store files on disk
        const uploadedFile = await db.uploadedFile.create({
            data: {
                sessionId,
                fileName: file.name,
                fileType,
                fileSize: file.size,
                filePath: "",
                status: "processing",
            },
        })

        processFileAsync(uploadedFile.id, sessionId, fileType, file.name, buffer)

        const mapped: UploadedFile = {
            id: uploadedFile.id,
            sessionId: uploadedFile.sessionId,
            fileName: uploadedFile.fileName,
            fileType: uploadedFile.fileType as UploadedFile["fileType"],
            fileSize: uploadedFile.fileSize,
            uploadedAt: uploadedFile.uploadedAt.toISOString(),
            status: "processing",
            errorMessage: undefined,
        }

        return NextResponse.json(
            { success: true, data: mapped },
            { status: 201 }
        )
    } catch (error) {
        console.error("[POST /api/upload]", error)
        return NextResponse.json(
            { success: false, error: "Failed to upload file" },
            { status: 500 }
        )
    }
}

async function processFileAsync(
    fileId: string,
    sessionId: string,
    fileType: string,
    fileName: string,
    fileBytes: Buffer
) {
    try {
        const fastapiUrl = process.env.FASTAPI_URL || "http://localhost:8000"

        // Send the file bytes directly — works in both local and cloud deployments
        const form = new FormData()
        form.append("fileId", fileId)
        form.append("sessionId", sessionId)
        form.append("fileType", fileType)
        form.append("file", new Blob([new Uint8Array(fileBytes)]), fileName)

        const response = await fetch(`${fastapiUrl}/ingest`, {
            method: "POST",
            body: form,
        })

        if (response.ok) {
            const result = await response.json()

            // Treat an empty result (no rows extracted) as an error
            if (!result.rowCount || result.rowCount === 0) {
                const msg = fileType === "pdf"
                    ? "No data could be extracted from this PDF. It may be image-only, scanned, or contain no readable tables or text."
                    : "No data could be extracted from this file."
                await db.uploadedFile.update({
                    where: { id: fileId },
                    data: { status: "error", errorMessage: msg },
                })
                return
            }

            await db.uploadedFile.update({
                where: { id: fileId },
                data: {
                    status: "ready",
                    rowCount: result.rowCount,
                    columnCount: result.columnCount,
                    columns: JSON.stringify(result.columns),
                },
            })
        } else {
            let errorMessage = "Failed to process file"
            try {
                const errBody = await response.json()
                if (errBody?.detail) {
                    // FastAPI validation errors return detail as an array of objects
                    errorMessage = Array.isArray(errBody.detail)
                        ? errBody.detail.map((e: { msg?: string }) => e.msg).join(", ")
                        : String(errBody.detail)
                }
            } catch {}
            console.error("[processFileAsync] Python error:", errorMessage)
            await db.uploadedFile.update({
                where: { id: fileId },
                data: { status: "error", errorMessage },
            })
        }
    } catch (error) {
        console.error("[processFileAsync]", error)
        await db.uploadedFile.update({
            where: { id: fileId },
            data: { status: "error", errorMessage: "Could not connect to the processing service" },
        })
    }
}

// Helper — get our file type from mime type
function getFileType(mimeType: string): UploadedFile["fileType"] {
    if (mimeType === "text/csv") return "csv"
    if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        mimeType === "application/vnd.ms-excel"
    )
        return "xlsx"
    if (mimeType === "application/pdf") return "pdf"
    return "image"
}