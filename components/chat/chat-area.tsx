"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"
import { useChat, useSessions } from "@/lib/hooks"
import { useStore } from "@/lib/stores"
import { ChatMessage } from "@/components/chat/chat-message"
import { ChatInput } from "@/components/chat/chat-input"
import { EmptyState } from "@/components/chat/empty-state"
import { BrainCircuitIcon, PanelLeftOpenIcon, SunIcon, MoonIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

type ChatAreaProps = {
    sessionId: string | null
}

export function ChatArea({ sessionId }: ChatAreaProps) {
    const { messages, isLoading, handleSendMessage } = useChat(sessionId)
    const { isSidebarOpen, setIsSidebarOpen, sessions, sessionsLoaded } = useStore()
    const { fetchSessions, handleCreateSession } = useSessions()
    const { resolvedTheme, setTheme } = useTheme()

    useEffect(() => {
        if (sessionsLoaded && sessions.length === 0) {
            handleCreateSession("New chat")
        }
    }, [sessionsLoaded, sessions.length])

    const handleSend = async (message: string) => {
        await handleSendMessage(message)
        setTimeout(() => fetchSessions(), 1000)
    }
    const bottomRef = useRef<HTMLDivElement>(null)

    // Auto scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <header className="flex h-14 items-center gap-3 border-b px-4 shrink-0">
                {!isSidebarOpen && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setIsSidebarOpen(true)}
                        aria-label="Open sidebar"
                    >
                        <PanelLeftOpenIcon className="h-4 w-4" />
                    </Button>
                )}
                <div className="flex items-center gap-2">
                    <BrainCircuitIcon className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-sm">Datrixs</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {sessionId && (
                        <span className="text-xs text-muted-foreground">
                            AI Data Analyst
                        </span>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                        aria-label="Toggle theme"
                        suppressHydrationWarning
                    >
                        <SunIcon className="h-4 w-4 hidden dark:block" />
                        <MoonIcon className="h-4 w-4 block dark:hidden" />
                    </Button>
                </div>
            </header>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto">
                {messages.length === 0 ? (
                    <EmptyState
                        title="Start a conversation"
                        description="Upload a file and ask questions about your data in plain English"
                        showUploadHint
                    />
                ) : (
                    // Show messages
                    <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
                        {messages.map((message) => (
                            <ChatMessage key={message.id} message={message} />
                        ))}
                        {/* Scroll anchor */}
                        <div ref={bottomRef} />
                    </div>
                )}
            </div>

            {/* Input area */}
            <div className="shrink-0 border-t bg-background/95 backdrop-blur">
                <div className="max-w-3xl mx-auto w-full px-4 py-4">
                    <ChatInput
                        sessionId={sessionId ?? ""}
                        onSendMessage={handleSend}
                        isLoading={isLoading || !sessionId}
                    />
                </div>
            </div>
        </div>
    )
}