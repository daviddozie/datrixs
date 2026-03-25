"use client"

import { useState, useCallback } from "react"
import { useStore } from "@/lib/stores"
import { Session } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SearchIcon,
  MoreHorizontalIcon,
  TrashIcon,
  PinIcon,
  PinOffIcon,
  MessageSquareIcon,
  PanelLeftCloseIcon,
  BrainCircuitIcon,
  PlusIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { pinSession } from "@/lib/api"
import { toast } from "sonner"

type AppSidebarProps = {
  sessions: Session[]
  activeSessionId: string | null
  onCreateSession: (name: string) => void
  onDeleteSession: (id: string) => void
  onSelectSession: (id: string | null) => void
}

export function AppSidebar({
  sessions,
  activeSessionId,
  onCreateSession,
  onDeleteSession,
  onSelectSession,
}: AppSidebarProps) {
  const { isSidebarOpen, setIsSidebarOpen, setSessions } = useStore()
  const [search, setSearch] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const handleNewSession = async () => {
    const activeSession = sessions.find((s) => s.id === activeSessionId)
    if (activeSession && activeSession.name === "New chat") {
      onSelectSession(activeSession.id)
      return
    }
    setIsCreating(true)
    const name = `New chat`
    await onCreateSession(name)
    setIsCreating(false)
  }

  const handlePin = useCallback(
    async (session: Session) => {
      try {
        const response = await pinSession(session.id, !session.isPinned)
        if (response.success && response.data) {
          const updated = sessions.map((s) =>
            s.id === session.id ? { ...s, isPinned: !s.isPinned } : s
          )
          setSessions(updated)
          toast.success(session.isPinned ? "Chat unpinned" : "Chat pinned")
        }
      } catch {
        toast.error("Failed to update pin")
      }
    },
    [sessions]
  )

  // Filter by search
  const filtered = sessions.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  // Separate pinned and unpinned
  const pinned = filtered.filter((s) => s.isPinned)
  const unpinned = filtered.filter((s) => !s.isPinned)

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-30 flex h-screen flex-col",
          "bg-[#171717] dark:bg-[#171717] light:bg-white",
          "bg-sidebar text-sidebar-foreground",
          "transition-all duration-300 ease-in-out",
          isSidebarOpen ? "w-64" : "w-0 overflow-hidden",
          "md:relative md:z-auto"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-1 shrink-0">
          <div className="flex items-center gap-2">
            <BrainCircuitIcon className="h-5 w-5 text-sidebar-foreground" />
            <span className="text-sm font-semibold text-sidebar-foreground">Datrixs</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <PanelLeftCloseIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* New chat button */}
        <div className="px-3 py-2 shrink-0">
          <button
            onClick={handleNewSession}
            disabled={isCreating}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg",
              "text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground",
              "hover:bg-sidebar-accent transition-colors duration-150",
              "border border-sidebar-border cursor-pointer"
            )}
          >
            <PlusIcon className="h-4 w-4" />
            {isCreating ? "Creating..." : "New chat"}
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2 shrink-0">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-sidebar-foreground/40" />
            <Input
              placeholder="Search chats"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-sidebar-accent border-0 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-0 rounded-lg"
            />
          </div>
        </div>

        {/* Scrollable sessions list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {/* Pinned */}
          {pinned.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1.5 text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider">
                Pinned
              </p>
              {pinned.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onSelect={() => onSelectSession(session.id)}
                  onDelete={() => onDeleteSession(session.id)}
                  onPin={() => handlePin(session)}
                />
              ))}
            </div>
          )}

          {/* Recent */}
          {unpinned.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <p className="px-2 py-1.5 text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider">
                  Recent
                </p>
              )}
              {unpinned.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onSelect={() => onSelectSession(session.id)}
                  onDelete={() => onDeleteSession(session.id)}
                  onPin={() => handlePin(session)}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquareIcon className="h-6 w-6 text-sidebar-foreground/20 mb-2" />
              <p className="text-xs text-sidebar-foreground/40">
                {search ? "No chats found" : "No chats yet"}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

// ============================================
// SessionItem
// ============================================
type SessionItemProps = {
  session: Session
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onPin: () => void
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  onPin,
}: SessionItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  // Generate a preview name from session name
  // If it's "New chat" show the date instead
  const displayName = session.name === "New chat"
    ? `Chat ${formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}`
    : session.name

  return (
    <div
      className={cn(
        "group relative flex items-center rounded-lg px-2 py-2 cursor-pointer",
        "hover:bg-sidebar-accent transition-colors duration-150",
        isActive && "bg-sidebar-accent",
        menuOpen && "bg-sidebar-accent"
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      aria-selected={isActive}
    >
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-sidebar-foreground/90 truncate leading-tight">
          {displayName}
        </p>
        <p className="text-[11px] text-sidebar-foreground/40 mt-0.5 truncate">
          {formatDistanceToNow(new Date(session.createdAt), {
            addSuffix: true,
          })}
          {session.fileCount > 0 && ` · ${session.fileCount} file${session.fileCount > 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Pin indicator */}
      {session.isPinned && !menuOpen && (
        <PinIcon className="h-3 w-3 text-sidebar-foreground/30 shrink-0 rotate-45 mr-1" />
      )}

      {/* More options */}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground",
              "hover:bg-sidebar-accent transition-all rounded-md",
              menuOpen
                ? "opacity-100 bg-sidebar-accent"
                : "opacity-0 group-hover:opacity-100"
            )}
            onClick={(e) => e.stopPropagation()}
            aria-label="Chat options"
          >
            <MoreHorizontalIcon className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-40"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem
            className="gap-2 text-sm cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              onPin()
              setMenuOpen(false)
            }}
          >
            {session.isPinned ? (
              <>
                <PinOffIcon className="h-3.5 w-3.5" />
                Unpin chat
              </>
            ) : (
              <>
                <PinIcon className="h-3.5 w-3.5" />
                Pin chat
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 text-sm text-destructive focus:text-destructive cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
              setMenuOpen(false)
            }}
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Delete chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}