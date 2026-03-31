'use client'

import { useState, useEffect, useCallback } from "react"
import { useStore } from "@/lib/stores"
import {
    getSessions,
    createSession,
    deleteSession,
    getMessages,
    sendMessage,
    uploadFile,
    getSessionFiles,
} from "@/lib/api"
import { Message, UploadedFile } from "@/lib/types"
import { toast } from "sonner"

// useSessions — manages all session operations
export const useSessions = () => {
    const {
        sessions,
        activeSessionId,
        setSessions,
        setActiveSessionId,
        addSession,
        setSessionsLoaded,
    } = useStore()
    const [isLoading, setIsLoading] = useState(false)

    // Fetch all sessions from the API
    const fetchSessions = useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await getSessions()
            if (response.success && response.data) {
                setSessions(response.data)
                // Auto-select the first session if none is active
                if (!activeSessionId && response.data.length > 0) {
                    setActiveSessionId(response.data[0].id)
                }
            }
        } catch (error) {
            toast.error("Failed to load sessions")
        } finally {
            setIsLoading(false)
            setSessionsLoaded(true)
        }
    }, [activeSessionId])

    // Create a new session
    const handleCreateSession = useCallback(async (name: string) => {
        try {
            const response = await createSession(name)
            if (response.success && response.data) {
                addSession(response.data)
                setActiveSessionId(response.data.id)
                toast.success("New session created")
                return response.data
            }
        } catch (error) {
            toast.error("Failed to create session")
        }
    }, [])

    // Delete a session
    const handleDeleteSession = useCallback(
        async (id: string) => {
            try {
                const response = await deleteSession(id)
                if (response.success) {
                    // Remove from store
                    const remaining = sessions.filter((s) => s.id !== id)
                    setSessions(remaining)
                    // If we deleted the active session, switch to the first remaining
                    if (activeSessionId === id) {
                        setActiveSessionId(remaining[0]?.id || null)
                    }
                    toast.success("Session deleted")
                }
            } catch (error) {
                toast.error("Failed to delete session")
            }
        },
        [sessions, activeSessionId]
    )

    // Load sessions on mount
    useEffect(() => {
        fetchSessions()
    }, [])

    return {
        sessions,
        activeSessionId,
        isLoading,
        fetchSessions,
        handleCreateSession,
        handleDeleteSession,
        setActiveSessionId,
    }
}

// useChat — manages messages and agent queries

export const useChat = (sessionId: string | null) => {
    const {
        messages,
        setMessages,
        addMessage,
        updateLastMessage,
        setLastMessageChart,
    } = useStore()
    const {
        pendingAttachment,
        clearPendingAttachment,
    } = useFileUpload(sessionId)
    const [isLoading, setIsLoading] = useState(false)
    const [messagesLoading, setMessagesLoading] = useState(false)

    const fetchMessages = useCallback(async () => {
        if (!sessionId) return
        setMessagesLoading(true)
        try {
            const response = await getMessages(sessionId)
            if (response.success && response.data) {
                setMessages(response.data)
            }
        } catch (error) {
            toast.error("Failed to load messages")
        } finally {
            setMessagesLoading(false)
        }
    }, [sessionId])

    const handleSendMessage = useCallback(
        async (content: string) => {
            if (!sessionId) return
            if (!content.trim() && !pendingAttachment) return

            const userMessage: Message = {
                id: crypto.randomUUID(),
                sessionId,
                role: "user",
                content,
                createdAt: new Date().toISOString(),
                attachment: pendingAttachment
                    ? {
                        fileName: pendingAttachment.file.name,
                        fileType: getFileType(pendingAttachment.file.name),
                        fileSize: pendingAttachment.file.size,
                        status: pendingAttachment.status,
                        progress: pendingAttachment.progress,
                    }
                    : undefined,
            }
            addMessage(userMessage)

            if (pendingAttachment) {
                clearPendingAttachment()
            }

            const loadingMessage: Message = {
                id: crypto.randomUUID(),
                sessionId,
                role: "assistant",
                content: "",
                createdAt: new Date().toISOString(),
                isLoading: true,
            }
            addMessage(loadingMessage)
            setIsLoading(true)

            const messageContent = pendingAttachment
                ? `[File uploaded: ${pendingAttachment.file.name}]\n${content}`
                : content

            await sendMessage(
                sessionId,
                messageContent,
                (chunk: string) => {
                    updateLastMessage((prev: string) => prev + chunk)
                },
                (chartData: any) => {
                    setLastMessageChart(chartData)
                },
                () => {
                    setIsLoading(false)
                },
                (error: string) => {
                    updateLastMessage(
                        () => "Sorry, something went wrong. Please try again."
                    )
                    setIsLoading(false)
                    toast.error(error)
                }
            )
        },
        [sessionId, pendingAttachment]
    )

    useEffect(() => {
        if (sessionId) fetchMessages()
    }, [sessionId])

    return {
        messages,
        isLoading,
        messagesLoading,
        handleSendMessage,
        fetchMessages,
    }
}

// useFileUpload — manages file upload operations
export const useFileUpload = (sessionId: string | null) => {
    const {
        uploadedFiles,
        setUploadedFiles,
        addUploadedFile,
        updateFileStatus,
        pendingAttachment,
        setPendingAttachment,
        updateAttachmentProgress,
        updateAttachmentStatus,
        clearPendingAttachment,
    } = useStore()

    // Fetch files for the active session
    const fetchFiles = useCallback(async () => {
        if (!sessionId) return
        try {
            const response = await getSessionFiles(sessionId)
            if (response.success && response.data) {
                setUploadedFiles(response.data)
            }
        } catch (error) {
            toast.error("Failed to load files")
        }
    }, [sessionId])

    // Select a file for upload — shows preview
    // but doesn't upload yet until user sends
    const handleSelectFile = useCallback(
        async (file: File) => {
            if (!sessionId) {
                toast.error("Please select or create a session first")
                return
            }

            // Generate preview URL for images
            let preview: string | null = null
            if (file.type.startsWith("image/")) {
                preview = URL.createObjectURL(file)
            }

            // Set as pending attachment immediately
            setPendingAttachment({
                file,
                preview,
                progress: 0,
                status: "uploading",
                uploadedFileId: null,
            })

            // Start uploading in background
            try {
                const response = await uploadFile(
                    sessionId,
                    file,
                    (progress) => {
                        updateAttachmentProgress(progress)
                    }
                )

                if (response.success && response.data) {
                    updateAttachmentStatus("processing", response.data.id)
                    // Add to uploaded files list
                    addUploadedFile(response.data)

                    // Poll for ready status
                    pollFileStatus(response.data.id)
                } else {
                    updateAttachmentStatus("error")
                    toast.error(response.error || `Failed to upload ${file.name}`)
                }
            } catch (error) {
                updateAttachmentStatus("error")
                toast.error(`Failed to upload ${file.name}. Please try again.`)
            }
        },
        [sessionId]
    )

    // Poll file status until ready
    const pollFileStatus = useCallback(
        async (fileId: string) => {
            const maxAttempts = 20
            let attempts = 0

            const poll = async () => {
                if (attempts >= maxAttempts) {
                    updateAttachmentStatus("error")
                    return
                }
                attempts++

                try {
                    const response = await getSessionFiles(sessionId!)
                    if (response.success && response.data) {
                        const file = response.data.find((f) => f.id === fileId)
                        if (file?.status === "ready") {
                            updateAttachmentStatus("ready", fileId)
                            updateFileStatus(fileId, "ready")
                            return
                        } else if (file?.status === "error") {
                            const errMsg = file.errorMessage
                                || "Failed to process file. Please try a different file."
                            updateAttachmentStatus("error", undefined, errMsg)
                            toast.error(errMsg)
                            return
                        }
                    }
                } catch (error) {
                    // Continue polling
                }

                // Poll every 2 seconds
                setTimeout(poll, 2000)
            }

            setTimeout(poll, 2000)
        },
        [sessionId]
    )

    // Fetch files when session changes
    useEffect(() => {
        if (sessionId) fetchFiles()
    }, [sessionId])

    return {
        uploadedFiles,
        pendingAttachment,
        handleSelectFile,
        clearPendingAttachment,
        fetchFiles,
    }
}

// Helper
const getFileType = (fileName: string): "csv" | "xlsx" | "pdf" | "image" => {
    const ext = fileName.split(".").pop()?.toLowerCase()
    if (ext === "csv") return "csv"
    if (ext === "xlsx" || ext === "xls") return "xlsx"
    if (ext === "pdf") return "pdf"
    return "image"
}