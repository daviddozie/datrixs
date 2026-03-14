'use client'

import { useStore } from "@/lib/stores"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { ChatArea } from "@/components/chat/chat-area"
import { useSessions } from "@/lib/hooks"
import { cn } from "@/lib/utils"

export function AppLayout() {
    const { isSidebarOpen } = useStore()
    const { sessions, activeSessionId, handleCreateSession,
        handleDeleteSession, setActiveSessionId } = useSessions()

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            {/* Sidebar */}
            <AppSidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                onCreateSession={handleCreateSession}
                onDeleteSession={handleDeleteSession}
                onSelectSession={setActiveSessionId}
            />

            {/* Main chat area */}
            <main
                className={cn(
                    "flex flex-1 flex-col overflow-hidden transition-all duration-300",
                    isSidebarOpen ? "ml-0" : "ml-0"
                )}
            >
                <ChatArea sessionId={activeSessionId} />
            </main>
        </div>
    )
}