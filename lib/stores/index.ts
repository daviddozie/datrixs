import { create } from "zustand"
import { Session, Message, UploadedFile } from "@/lib/types"

// --- Shape of our global store ---
type Store = {
    // --- Sessions ---
    sessions: Session[]
    activeSessionId: string | null
    setSessions: (sessions: Session[]) => void
    setActiveSessionId: (id: string | null) => void
    addSession: (session: Session) => void

    // --- Messages ---
    messages: Message[]
    setMessages: (messages: Message[]) => void
    addMessage: (message: Message) => void
    updateLastMessage: (updater: string | ((prev: string) => string)) => void

    // --- Uploaded Files ---
    uploadedFiles: UploadedFile[]
    setUploadedFiles: (files: UploadedFile[]) => void
    addUploadedFile: (file: UploadedFile) => void
    updateFileStatus: (id: string, status: UploadedFile["status"]) => void

    // --- UI State ---
    isSidebarOpen: boolean
    isUploading: boolean
    setIsSidebarOpen: (open: boolean) => void
    setIsUploading: (uploading: boolean) => void

    pendingAttachment: {
        file: File
        preview: string | null
        progress: number
        status: UploadedFile["status"]
        uploadedFileId: string | null
    } | null
    setPendingAttachment: (attachment: Store["pendingAttachment"]) => void
    updateAttachmentProgress: (progress: number) => void
    updateAttachmentStatus: (
        status: UploadedFile["status"],
        fileId?: string
    ) => void
    clearPendingAttachment: () => void
}

export const useStore = create<Store>((set) => ({
    // --- Sessions initial state ---
    sessions: [],
    activeSessionId: null,
    setSessions: (sessions) => set({ sessions }),
    setActiveSessionId: (id) => set({ activeSessionId: id }),
    addSession: (session) =>
        set((state) => ({ sessions: [session, ...state.sessions] })),

    // --- Messages initial state ---
    messages: [],
    setMessages: (messages) => set({ messages }),
    addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
    // Used for streaming — updates the last assistant message as it streams in
    updateLastMessage: (updater) =>
        set((state) => {
            const messages = [...state.messages]
            const last = messages[messages.length - 1]
            if (last && last.role === "assistant") {
                const newContent =
                    typeof updater === "function"
                        ? updater(last.content)
                        : updater
                messages[messages.length - 1] = { ...last, content: newContent, isLoading: false }
            }
            return { messages }
        }),

    // --- Uploaded Files initial state ---
    uploadedFiles: [],
    setUploadedFiles: (files) => set({ uploadedFiles: files }),
    addUploadedFile: (file) =>
        set((state) => ({ uploadedFiles: [file, ...state.uploadedFiles] })),
    updateFileStatus: (id, status) =>
        set((state) => ({
            uploadedFiles: state.uploadedFiles.map((f) =>
                f.id === id ? { ...f, status } : f
            ),
        })),

    // --- UI State initial state ---
    isSidebarOpen: true,
    isUploading: false,
    setIsSidebarOpen: (open) => set({ isSidebarOpen: open }),
    setIsUploading: (uploading) => set({ isUploading: uploading }),

    pendingAttachment: null,
    setPendingAttachment: (attachment) =>
        set({ pendingAttachment: attachment }),
    updateAttachmentProgress: (progress) =>
        set((state) => ({
            pendingAttachment: state.pendingAttachment
                ? { ...state.pendingAttachment, progress }
                : null,
        })),
    updateAttachmentStatus: (status, fileId) =>
        set((state) => ({
            pendingAttachment: state.pendingAttachment
                ? {
                    ...state.pendingAttachment,
                    status,
                    uploadedFileId: fileId || state.pendingAttachment.uploadedFileId,
                }
                : null,
        })),
    clearPendingAttachment: () => set({ pendingAttachment: null }),
}))