import axios from "axios"
import {
    ApiResponse,
    Session,
    Message,
    UploadedFile,
    Dataset
} from "@/lib/types"

// --- Base axios instance ---
const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    headers: {
        "Content-Type": "application/json",
    },
})

// Get all sessions
export const getSessions = async (): Promise<ApiResponse<Session[]>> => {
    const { data } = await api.get("/api/sessions")
    return data
}

// Create a new session
export const createSession = async (
    name: string
): Promise<ApiResponse<Session>> => {
    const { data } = await api.post("/api/sessions", { name })
    return data
}

// Delete a session
export const deleteSession = async (
    id: string
): Promise<ApiResponse<null>> => {
    const { data } = await api.delete(`/api/sessions/${id}`)
    return data
}

// Get all messages for a session
export const getMessages = async (
    sessionId: string
): Promise<ApiResponse<Message[]>> => {
    const { data } = await api.get(`/api/sessions/${sessionId}/messages`)
    return data
}

// Send a message to the agent with streaming support
export const sendMessage = async (
    sessionId: string,
    content: string,
    onChunk: (chunk: string) => void,
    onChart: (chartData: any) => void,
    onComplete: () => void,
    onError: (error: string) => void
): Promise<void> => {
    try {
        const response = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, content }),
            signal: AbortSignal.timeout(120000),
        })

        if (!response.ok) {
            onError("Failed to send message")
            return
        }

        const reader = response.body?.getReader()
        if (!reader) {
            onError("No response stream")
            return
        }

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            buffer += chunk

            if (buffer.includes("[CHART]:")) {
                const parts = buffer.split("[CHART]:")
                if (parts[0].trim()) onChunk(parts[0])
                try {
                    const chartData = JSON.parse(parts[1])
                    onChart(chartData)
                } catch {

                }
                buffer = ""
                continue
            }

            const cleaned = buffer
                .replace(/\[CHART_DATA\][\s\S]*?\[\/CHART_DATA\]/g, "")
                .replace(/\[CHART_DATA\][\s\S]*/g, "")
                .replace(/\[\/CHART_DATA\]/g, "")
                .trim()

            if (cleaned) {
                onChunk(cleaned)
            }
            buffer = ""
        }
        onComplete()
    } catch (error) {
        onError("Connection error. Please try again.")
    }
}

// Upload a file to a session
export const uploadFile = async (
    sessionId: string,
    file: File,
    onProgress?: (progress: number) => void
): Promise<ApiResponse<UploadedFile>> => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("sessionId", sessionId)

    const { data } = await api.post("/api/upload", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
                const progress = Math.round(
                    (progressEvent.loaded * 100) / progressEvent.total
                )
                onProgress(progress)
            }
        },
    })
    return data
}

// Get all files for a session
export const getSessionFiles = async (
    sessionId: string
): Promise<ApiResponse<UploadedFile[]>> => {
    const { data } = await api.get(`/api/sessions/${sessionId}/files`)
    return data
}

// Get the unified dataset for a session
export const getDataset = async (
    sessionId: string
): Promise<ApiResponse<Dataset>> => {
    const { data } = await api.get(`/api/sessions/${sessionId}/dataset`)
    return data
}

// Pin or unpin a session
export const pinSession = async (
    id: string,
    isPinned: boolean
): Promise<ApiResponse<Session>> => {
    const { data } = await api.patch(`/api/sessions/${id}`, { isPinned })
    return data
}