"use client"

import { Message } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
    BrainCircuitIcon,
    UserIcon,
    FileTextIcon,
    FileSpreadsheetIcon,
    ImageIcon,
    FileIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ChartMessage } from "@/components/chat/chart-message"

type ChatMessageProps = {
    message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user"
    const isLoading = message.isLoading
    const isEmpty = message.content === "" && !isLoading && !message.attachment

    if (isEmpty) return null

    return (
        <div
            className={cn(
                "flex gap-3 w-full",
                isUser ? "flex-row-reverse" : "flex-row"
            )}
            role="article"
            aria-label={`${isUser ? "Your" : "Datrixs"} message`}
        >
            {/* Avatar */}
            <div className="shrink-0 mt-0.5">
                {isUser ? (
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            <UserIcon className="h-4 w-4" />
                        </AvatarFallback>
                    </Avatar>
                ) : (
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                            <BrainCircuitIcon className="h-4 w-4" />
                        </AvatarFallback>
                    </Avatar>
                )}
            </div>

            {/* Message content */}
            <div
                className={cn(
                    "flex flex-col gap-1 max-w-[80%]",
                    isUser ? "items-end" : "items-start"
                )}
            >
                {/* Role label */}
                <span className="text-xs text-muted-foreground px-1">
                    {isUser ? "You" : "Datrixs"}
                </span>

                {/* File attachment bubble */}
                {message.attachment && (
                    <FileAttachmentBubble
                        attachment={message.attachment}
                        isUser={isUser}
                    />
                )}

                {message.chartData && (
                    <ChartMessage chartData={message.chartData} />
                )}

                {/* Text bubble — only show if has content */}
                {(message.content || isLoading) && (
                    <div
                        className={cn(
                            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                            isUser
                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                : "bg-muted text-foreground rounded-tl-sm"
                        )}
                    >
                        {isLoading && message.content === "" ? (
                            <ThinkingDots />
                        ) : (
                            <>
                                <MessageContent content={message.content} />
                                {isLoading && message.content !== "" && (
                                    <StreamingCursor />
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

function FileAttachmentBubble({
    attachment,
    isUser,
}: {
    attachment: NonNullable<Message["attachment"]>
    isUser: boolean
}) {
    const icon = getFileIcon(attachment.fileType)

    return (
        <div
            className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 min-w-[200px]",
                isUser
                    ? "bg-primary/80 text-primary-foreground rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm"
            )}
        >
            {/* File icon */}
            <div
                className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    isUser ? "bg-primary-foreground/20" : "bg-background"
                )}
            >
                {icon}
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                    {attachment.fileName}
                </p>
                <p
                    className={cn(
                        "text-xs mt-0.5",
                        isUser
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                    )}
                >
                    {formatFileSize(attachment.fileSize)} ·{" "}
                    {attachment.fileType.toUpperCase()}
                </p>
            </div>

            {/* Status indicator */}
            <div className="shrink-0">
                {attachment.status === "ready" && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                        <svg viewBox="0 0 12 12" className="h-3 w-3 text-white">
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
                {attachment.status === "processing" && (
                    <div className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin opacity-70" />
                )}
                {attachment.status === "error" && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                        !
                    </div>
                )}
            </div>
        </div>
    )
}

function ThinkingDots() {
    return (
        <div
            className="flex items-center gap-1 py-1"
            aria-label="Datrixs is thinking"
            role="status"
        >
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="h-2 w-2 rounded-full bg-current opacity-60 animate-bounce"
                    style={{
                        animationDelay: `${i * 0.15}s`,
                        animationDuration: "0.8s",
                    }}
                />
            ))}
        </div>
    )
}

// ============================================
// StreamingCursor
// ============================================
function StreamingCursor() {
    return (
        <span
            className="inline-block w-0.5 h-4 bg-current ml-0.5 align-middle animate-pulse"
            aria-hidden="true"
        />
    )
}

function MessageContent({ content }: { content: string }) {
    // Strip file upload prefix — shown as attachment bubble instead
    const cleanContent = content
        .replace(/^\[File uploaded:.*?\]\n?/gm, "")
        .replace(/\[CHART_DATA\][\s\S]*?\[\/CHART_DATA\]/g, "")
        .replace(/\[CHART_DATA\]/g, "")
        .replace(/\[\/CHART_DATA\]/g, "")
        .trim()

    if (!cleanContent) return null

    const lines = cleanContent.split("\n")

    return (
        <div className="space-y-1.5">
            {lines.map((line, i) => {
                if (line.trim() === "") return <div key={i} className="h-1" />

                if (line.startsWith("- ") || line.startsWith("• ")) {
                    return (
                        <div key={i} className="flex gap-2">
                            <span className="shrink-0 mt-1 text-xs">•</span>
                            <span>{renderInline(line.slice(2))}</span>
                        </div>
                    )
                }

                if (/^\d+\.\s/.test(line)) {
                    return (
                        <div key={i} className="flex gap-2">
                            <span className="shrink-0 text-muted-foreground text-xs">
                                {line.match(/^\d+/)?.[0]}.
                            </span>
                            <span>{renderInline(line.replace(/^\d+\.\s/, ""))}</span>
                        </div>
                    )
                }

                return <p key={i}>{renderInline(line)}</p>
            })}
        </div>
    )
}

function renderInline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g)

    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                    return <strong key={i}>{part.slice(2, -2)}</strong>
                }
                if (part.startsWith("*") && part.endsWith("*")) {
                    return <strong key={i}>{part.slice(1, -1)}</strong>
                }
                if (part.startsWith("`") && part.endsWith("`")) {
                    return (
                        <code
                            key={i}
                            className="rounded bg-background/50 px-1 py-0.5 text-xs font-mono"
                        >
                            {part.slice(1, -1)}
                        </code>
                    )
                }
                return <span key={i}>{part}</span>
            })}
        </>
    )
}

function getFileIcon(fileType: string) {
    const className = "h-5 w-5"
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

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}