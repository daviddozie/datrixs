"use client"

import { useState } from "react"
import { useStore } from "@/lib/stores"
import { Session } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    PlusIcon,
    MessageSquareIcon,
    TrashIcon,
    MoreHorizontalIcon,
    PanelLeftCloseIcon,
    PanelLeftOpenIcon,
    DatabaseIcon,
    BrainCircuitIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

type AppSidebarProps = {
    sessions: Session[]
    activeSessionId: string | null
    onCreateSession: (name: string) => void
    onDeleteSession: (id: string) => void
    onSelectSession: (id: string) => void
}

export function AppSidebar({
    sessions,
    activeSessionId,
    onCreateSession,
    onDeleteSession,
    onSelectSession,
}: AppSidebarProps) {
    const { isSidebarOpen, setIsSidebarOpen } = useStore()
    const [isCreating, setIsCreating] = useState(false)

    const handleNewSession = async () => {
        setIsCreating(true)
        const name = `Session ${new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })}`
        await onCreateSession(name)
        setIsCreating(false)
    }

    return (
        <>
            {/* Mobile overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-background/80 backdrop-blur-sm md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed left-0 top-0 z-30 flex h-full flex-col border-r bg-background/95 backdrop-blur",
                    "transition-all duration-300 ease-in-out",
                    isSidebarOpen ? "w-72" : "w-0 overflow-hidden",
                    "md:relative md:z-auto"
                )}
            >
                {/* Header */}
                <div className="flex h-14 items-center justify-between px-4 border-b">
                    <div className="flex items-center gap-2">
                        <BrainCircuitIcon className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-sm tracking-tight">
                            Datrixs
                        </span>
                    </div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setIsSidebarOpen(false)}
                                >
                                    <PanelLeftCloseIcon className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Close sidebar</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                {/* New Session Button */}
                <div className="p-3">
                    <Button
                        className="w-full justify-start gap-2"
                        onClick={handleNewSession}
                        disabled={isCreating}
                    >
                        <PlusIcon className="h-4 w-4" />
                        {isCreating ? "Creating..." : "New Session"}
                    </Button>
                </div>

                <Separator />

                {/* Sessions List */}
                <div className="flex-1 overflow-hidden">
                    <div className="px-3 py-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Sessions
                        </p>
                    </div>
                    <ScrollArea className="h-full px-2">
                        {sessions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                                <DatabaseIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
                                <p className="text-sm text-muted-foreground">
                                    No sessions yet
                                </p>
                                <p className="text-xs text-muted-foreground/70 mt-1">
                                    Create a new session to get started
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-1 pb-4">
                                {sessions.map((session) => (
                                    <SessionItem
                                        key={session.id}
                                        session={session}
                                        isActive={session.id === activeSessionId}
                                        onSelect={() => onSelectSession(session.id)}
                                        onDelete={() => onDeleteSession(session.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </aside>

            {/* Toggle button when sidebar is closed */}
            {!isSidebarOpen && (
                <div className="fixed left-3 top-3 z-30">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 shadow-sm"
                                    onClick={() => setIsSidebarOpen(true)}
                                >
                                    <PanelLeftOpenIcon className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open sidebar</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}
        </>
    )
}

// ============================================
// SessionItem — individual session in the list
// ============================================
type SessionItemProps = {
    session: Session
    isActive: boolean
    onSelect: () => void
    onDelete: () => void
}

function SessionItem({
    session,
    isActive,
    onSelect,
    onDelete,
}: SessionItemProps) {
    return (
        <div
            className={cn(
                "group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer",
                "hover:bg-accent transition-colors duration-150",
                isActive && "bg-accent"
            )}
            onClick={onSelect}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onSelect()}
            aria-selected={isActive}
            aria-label={`Select session: ${session.name}`}
        >
            <MessageSquareIcon className="h-4 w-4 shrink-0 text-muted-foreground" />

            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{session.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(session.createdAt), {
                            addSuffix: true,
                        })}
                    </p>
                    {session.fileCount > 0 && (
                        <Badge variant="secondary" className="h-4 text-xs px-1">
                            {session.fileCount} file{session.fileCount > 1 ? "s" : ""}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Delete button */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Session options"
                    >
                        <MoreHorizontalIcon className="h-3.5 w-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive gap-2"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete()
                        }}
                    >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}