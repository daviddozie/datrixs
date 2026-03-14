import { createTool } from "@mastra/core/tools"
import { z } from "zod"

export const mergeDatasetsTool = createTool({
    id: "merge-datasets",
    description:
        "Merge multiple uploaded datasets into a single unified dataset. Use this when the user has uploaded multiple files and wants to analyze them together or compare data across files.",
    inputSchema: z.object({
        sessionId: z.string().describe("The session ID"),
    }),
    execute: async ({ sessionId }) => {
        try {
            const fastapiUrl = process.env.FASTAPI_URL || "http://localhost:8000"
            const response = await fetch(`${fastapiUrl}/merge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId }),
            })
            if (!response.ok) {
                return { error: "Failed to merge datasets" }
            }
            return await response.json()
        } catch (error) {
            return { error: "FastAPI service unavailable" }
        }
    },
})