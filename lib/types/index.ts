// --- Session ---
// Represents a single user working session
export type Session = {
    id: string
    name: string
    createdAt: string
    updatedAt: string
    fileCount: number
    messageCount: number
    isPinned?: boolean
}

// --- Uploaded File ---
// Represents a file the user has uploaded
export type UploadedFile = {
    id: string
    sessionId: string
    fileName: string
    fileType: "csv" | "xlsx" | "pdf" | "image"
    fileSize: number
    uploadedAt: string
    status: "uploading" | "processing" | "ready" | "error"
    errorMessage?: string
    rowCount?: number
    columnCount?: number
    columns?: string[]
}

// --- Message ---
// Represents a single chat message
export type Message = {
    id: string
    sessionId: string
    role: "user" | "assistant"
    content: string
    createdAt: string
    isLoading?: boolean
    attachment?: {
        fileName: string
        fileType: UploadedFile["fileType"]
        fileSize: number
        status: UploadedFile["status"]
        progress?: number
    }
    // Chart visualization data
    chartData?: {
        chartType: "bar" | "line" | "pie"
        data: {
            labels: string[]
            values: number[]
            percentages?: number[]
            xLabel: string
            yLabel: string
            title: string
            isCurrency?: boolean
        }
        query: string
    }
}

// --- Dataset ---
// Represents the normalized unified dataset after processing
export type Dataset = {
    sessionId: string
    columns: string[]
    rowCount: number
    preview: Record<string, unknown>[]
}

// --- API Response wrapper ---
// The shape for all API responses from our backend
export type ApiResponse<T> = {
    success: boolean
    data?: T
    error?: string
}