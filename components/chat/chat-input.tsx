"use client"

import { useState, useRef, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { useFileUpload } from "@/lib/hooks"
import { useStore } from "@/lib/stores"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    SendIcon,
    PaperclipIcon,
    XIcon,
    FileTextIcon,
    ImageIcon,
    FileSpreadsheetIcon,
    FileIcon,
    Loader2Icon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ChatInputProps = {
    sessionId: string
    onSendMessage: (content: string) => void
    isLoading: boolean
}

export function ChatInput({
    sessionId,
    onSendMessage,
    isLoading,
}: ChatInputProps) {
    const [input, setInput] = useState("")
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const { pendingAttachment, handleSelectFile, clearPendingAttachment } =
        useFileUpload(sessionId)
    const { isUploading } = useStore()

    // Handle send — includes attachment if pending
    const handleSend = useCallback(() => {
        if ((!input.trim() && !pendingAttachment) || isLoading) return

        if (
            pendingAttachment &&
            pendingAttachment.status !== "ready" &&
            pendingAttachment.status !== "error"
        ) {
            return
        }

        onSendMessage(input.trim())
        setInput("")
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto"
        }
    }, [input, isLoading, onSendMessage, pendingAttachment])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value)
        const textarea = e.target
        textarea.style.height = "auto"
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: async (files) => {
            if (files[0]) await handleSelectFile(files[0])
        },
        accept: {
            "text/csv": [".csv"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
            "application/vnd.ms-excel": [".xls"],
            "application/pdf": [".pdf"],
            "image/png": [".png"],
            "image/jpeg": [".jpg", ".jpeg"],
            "image/webp": [".webp"],
        },
        noClick: true,
        noKeyboard: true,
        maxFiles: 1,
    })

    const isAttachmentReady =
        pendingAttachment?.status === "ready"
    const isAttachmentLoading =
        pendingAttachment &&
        pendingAttachment.status !== "ready" &&
        pendingAttachment.status !== "error"
    const canSend =
        (input.trim() || isAttachmentReady) &&
        !isLoading &&
        !isAttachmentLoading

    return (
        <div className="space-y-2">
            {/* File preview above input */}
            {pendingAttachment && (
                <FilePreview
                    attachment={pendingAttachment}
                    onRemove={clearPendingAttachment}
                />
            )}

            {/* Input box */}
            <div
                {...getRootProps()}
                className={cn(
                    "relative rounded-2xl border bg-background shadow-sm",
                    "transition-colors duration-150",
                    isDragActive && "border-primary bg-primary/5"
                )}
            >
                <input {...getInputProps()} />

                {isDragActive && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-primary/5 border-2 border-dashed border-primary z-10">
                        <p className="text-sm font-medium text-primary">
                            Drop file here to upload
                        </p>
                    </div>
                )}

                <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder={
                        pendingAttachment
                            ? "Add a message about this file..."
                            : "Ask a question about your data..."
                    }
                    className={cn(
                        "min-h-[52px] max-h-[200px] resize-none border-0 shadow-none",
                        "focus-visible:ring-0 pr-24 py-4 px-4",
                        "text-sm leading-relaxed"
                    )}
                    disabled={isLoading}
                    aria-label="Message input"
                />

                <div className="absolute bottom-3 right-3 flex items-center gap-1">
                    {/* Upload button */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={open}
                                    disabled={!!pendingAttachment || isUploading}
                                    aria-label="Upload file"
                                    type="button"
                                >
                                    <PaperclipIcon className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                Upload file (CSV, XLSX, PDF, Image)
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Send button */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={handleSend}
                                    disabled={!canSend}
                                    aria-label="Send message"
                                    type="button"
                                >
                                    {isLoading || isAttachmentLoading ? (
                                        <Loader2Icon className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <SendIcon className="h-4 w-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Send message (Enter)</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
                Press{" "}
                <kbd className="rounded border px-1 py-0.5 text-xs font-mono">
                    Enter
                </kbd>{" "}
                to send,{" "}
                <kbd className="rounded border px-1 py-0.5 text-xs font-mono">
                    Shift+Enter
                </kbd>{" "}
                for new line
            </p>
        </div>
    )
}

function FilePreview({
    attachment,
    onRemove,
}: {
    attachment: NonNullable<ReturnType<typeof useFileUpload>["pendingAttachment"]>
    onRemove: () => void
}) {
    const isLoading =
        attachment.status === "uploading" ||
        attachment.status === "processing"
    const isReady = attachment.status === "ready"
    const isError = attachment.status === "error"
    const progress = attachment.progress

    return (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
            {/* File thumbnail or icon */}
            <div className="relative shrink-0">
                {/* Circular progress ring */}
                <div className="relative h-12 w-12">
                    {isLoading && (
                        <svg
                            className="absolute inset-0 -rotate-90"
                            viewBox="0 0 48 48"
                        >
                            {/* Background ring */}
                            <circle
                                cx="24"
                                cy="24"
                                r="20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                className="text-muted-foreground/20"
                            />
                            {/* Progress ring */}
                            <circle
                                cx="24"
                                cy="24"
                                r="20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeDasharray={`${2 * Math.PI * 20}`}
                                strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)
                                    }`}
                                strokeLinecap="round"
                                className="text-primary transition-all duration-300"
                            />
                        </svg>
                    )}

                    {/* File icon or image preview */}
                    <div
                        className={cn(
                            "absolute inset-1.5 flex items-center justify-center rounded-lg overflow-hidden",
                            isLoading ? "bg-background" : "bg-muted"
                        )}
                    >
                        {attachment.preview ? (
                            <img
                                src={attachment.preview}
                                alt="Preview"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <FileTypeIcon
                                fileType={getFileType(attachment.file.name)}
                                className="h-5 w-5 text-muted-foreground"
                            />
                        )}
                    </div>

                    {/* Ready checkmark */}
                    {isReady && (
                        <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white">
                            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
                                <path
                                    d="M2 6l3 3 5-5"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                />
                            </svg>
                        </div>
                    )}

                    {/* Error indicator */}
                    {isError && (
                        <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                            !
                        </div>
                    )}
                </div>
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                    {attachment.file.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {isLoading && attachment.status === "uploading" &&
                        `Uploading... ${progress}%`}
                    {isLoading && attachment.status === "processing" &&
                        "Processing..."}
                    {isReady && "Ready to send"}
                    {isError && "Upload failed"}
                    {" · "}
                    {formatFileSize(attachment.file.size)}
                </p>
            </div>

            {/* Remove button */}
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={onRemove}
                aria-label="Remove file"
                type="button"
            >
                <XIcon className="h-4 w-4" />
            </Button>
        </div>
    )
}

function FileTypeIcon({
    fileType,
    className,
}: {
    fileType: string
    className?: string
}) {
    switch (fileType) {
        case "csv":
        case "xlsx":
            return <FileSpreadsheetIcon className={className} />
        case "pdf":
            return <FileTextIcon className={className} />
        case "image":
            return <ImageIcon className={className} />
        default:
            return <FileIcon className={className} />
    }
}

function getFileType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase()
    if (ext === "csv") return "csv"
    if (ext === "xlsx" || ext === "xls") return "xlsx"
    if (ext === "pdf") return "pdf"
    if (["png", "jpg", "jpeg", "webp"].includes(ext || "")) return "image"
    return "file"
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}