import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/utils/db"
import { datrixsAgent } from "@/mastra/agent/agent"
import { ApiResponse } from "@/lib/types"

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

        const history = await db.message.findMany({
            where: { sessionId },
            orderBy: { createdAt: "asc" },
            take: 20,
        })

        await db.message.create({
            data: { sessionId, role: "user", content },
        })

        const historyText = history
            .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n")

        const fullPrompt = historyText
            ? `Previous conversation:\n${historyText}\n\nUser: ${content}`
            : content

        // Pass sessionId as separate context
        const result = await datrixsAgent.stream(fullPrompt, {
            maxSteps: 5,
            context: [
                {
                    role: "user" as const,
                    content: `Important: The current sessionId is "${sessionId}". Always use this sessionId when calling tools.`,
                },
            ],
        })
        // Stream the agent response
        const streamResult = await datrixsAgent.stream(fullPrompt, {
            maxSteps: 5,
        })

        let fullResponse = ""

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of streamResult.textStream) {
                        fullResponse += chunk
                        controller.enqueue(new TextEncoder().encode(chunk))
                    }

                    await db.message.create({
                        data: {
                            sessionId,
                            role: "assistant",
                            content: fullResponse,
                        },
                    })

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