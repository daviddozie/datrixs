import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/utils/db"
import { datrixsAgent } from "@/mastra/agent/agent"

type ChartData = {
    chartType: "bar" | "line" | "pie"
    data: {
        labels: string[]
        values: number[]
        percentages?: number[]
        xLabel: string
        yLabel: string
        title: string
        isCurrency?: boolean
    }
    query: string
} | null

async function autoRenameSession(sessionId: string, content: string) {
    try {
        const session = await db.session.findUnique({ where: { id: sessionId } })
        if (!session || session.name !== "New chat") return

        // Strip [File uploaded: ...] prefix if present
        const cleaned = content.replace(/^\[File uploaded:[^\]]*\]\s*/i, "").trim()
        if (!cleaned) return

        const name = cleaned.length > 50 ? cleaned.slice(0, 50) + "..." : cleaned
        await db.session.update({ where: { id: sessionId }, data: { name } })
    } catch {
        
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { sessionId, content } = body

        if (!sessionId || !content) {
            return NextResponse.json(
                { success: false, error: "sessionId and content are required" },
                { status: 400 }
            )
        }

        const session = await db.session.findUnique({
            where: { id: sessionId },
        })
        if (!session) {
            return NextResponse.json(
                { success: false, error: "Session not found" },
                { status: 404 }
            )
        }

        // Fetch last 20 messages for context
        const history = await db.message.findMany({
            where: { sessionId },
            orderBy: { createdAt: "asc" },
            take: 20,
        })

        // Save user message
        await db.message.create({
            data: { sessionId, role: "user", content },
        })

        await autoRenameSession(sessionId, content)

        // Format history
        const historyText = history
            .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n")

        const systemContext = `SYSTEM CONTEXT (not visible to user):
- Current Session ID: ${sessionId}
- Always use exactly this Session ID when calling ANY tool: ${sessionId}
- Never use filenames or any other value as the session ID`

        const fullPrompt = historyText
            ? `${systemContext}\n\nPrevious conversation:\n${historyText}\n\nUser: ${content}`
            : `${systemContext}\n\nUser: ${content}`

        const streamResult = await datrixsAgent.stream(fullPrompt, {
            maxSteps: 5,
        })

        let fullResponse = ""
        let chartData: ChartData = null

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of streamResult.textStream) {
                        fullResponse += chunk
                        controller.enqueue(new TextEncoder().encode(chunk))
                    }

                    // Check for chart data markers
                    const chartMatch = fullResponse.match(
                        /\[CHART_DATA\]([\s\S]*?)\[\/CHART_DATA\]/
                    )
                    if (chartMatch) {
                        try {
                            chartData = JSON.parse(chartMatch[1])
                            fullResponse = fullResponse
                                .replace(/\[CHART_DATA\][\s\S]*?\[\/CHART_DATA\]/, "")
                                .trim()
                        } catch {
                            // Invalid JSON — ignore
                        }
                    }

                    // Save complete response to DB including chart data
                    await db.message.create({
                        data: {
                            sessionId,
                            role: "assistant",
                            content: fullResponse,
                            chartData: chartData ? JSON.stringify(chartData) : null,
                        },
                    })

                    // Send chart as final chunk if present
                    if (chartData) {
                        const chartChunk = `\n[CHART]:${JSON.stringify(chartData)}`
                        controller.enqueue(new TextEncoder().encode(chartChunk))
                    }

                    controller.close()
                } catch (error) {
                    controller.error(error)
                }
            },
        })

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Transfer-Encoding": "chunked",
                "X-Content-Type-Options": "nosniff",
            },
        })
    } catch (error) {
        console.error("[POST /api/agent]", error)
        return NextResponse.json(
            { success: false, error: "Failed to process message" },
            { status: 500 }
        )
    }
}