"use client"

import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/stores"
import { useSessions } from "@/lib/hooks"
import {
    BrainCircuitIcon,
    UploadIcon,
    MessageSquareIcon,
    BarChart3Icon,
    FileSearchIcon,
    TrendingUpIcon,
} from "lucide-react"

type EmptyStateProps = {
    title: string
    description: string
    showNewSessionButton?: boolean
    showUploadHint?: boolean
}

export function EmptyState({
    title,
    description,
    showNewSessionButton,
    showUploadHint,
}: EmptyStateProps) {
    const { handleCreateSession } = useSessions()
    const { setIsSidebarOpen } = useStore()

    const handleNewSession = async () => {
        const name = `Session ${new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })}`
        await handleCreateSession(name)
        setIsSidebarOpen(true)
    }

    return (
        <div className="flex flex-col items-center justify-center h-full px-4 py-12">
            <div className="flex flex-col items-center text-center max-w-md">

                {/* Icon */}
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
                    <BrainCircuitIcon className="h-8 w-8 text-primary" />
                </div>

                {/* Title and description */}
                <h1 className="text-2xl font-semibold tracking-tight mb-2">
                    {title}
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                    {description}
                </p>

                {/* New session button */}
                {showNewSessionButton && (
                    <Button onClick={handleNewSession} className="gap-2 mb-12">
                        <MessageSquareIcon className="h-4 w-4" />
                        New Session
                    </Button>
                )}

                {/* Upload hint */}
                {showUploadHint && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-12">
                        <UploadIcon className="h-4 w-4" />
                        <span>Click the upload button to add your data files</span>
                    </div>
                )}

                {/* Feature hints */}
                <div className="grid grid-cols-1 gap-3 w-full">
                    {features.map((feature) => (
                        <div
                            key={feature.title}
                            className="flex items-start gap-3 rounded-xl border bg-card p-4 text-left"
                        >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                <feature.icon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">{feature.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

const features = [
    {
        icon: UploadIcon,
        title: "Upload any file format",
        description: "CSV, Excel, PDF tables, and scanned images",
    },
    {
        icon: BarChart3Icon,
        title: "Instant statistics",
        description: "Averages, distributions, correlations and more",
    },
    {
        icon: FileSearchIcon,
        title: "Natural language queries",
        description: "Ask questions about your data in plain English",
    },
    {
        icon: TrendingUpIcon,
        title: "Trend analysis",
        description: "Spot patterns and trends across your datasets",
    },
]