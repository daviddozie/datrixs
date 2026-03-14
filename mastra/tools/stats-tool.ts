import { createTool } from "@mastra/core/tools"
import { z } from "zod"

export const runStatsTool = createTool({
    id: "run-statistics",
    description:
        "Compute summary statistics on the dataset such as count, mean, median, min, max, standard deviation, and value distributions. Use this when the user asks about averages, totals, distributions, or statistical summaries.",
    inputSchema: z.object({
        sessionId: z.string().describe("The session ID"),
        columns: z
            .array(z.string())
            .optional()
            .describe(
                "Specific columns to analyze. If empty, analyzes all columns"
            ),
    }),
    execute: async ({ sessionId, columns }) => {
        try {
            const fastapiUrl = process.env.FASTAPI_URL || "http://localhost:8000"
            const response = await fetch(`${fastapiUrl}/stats`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId,
                    columns: columns || [],
                }),
            })
            if (!response.ok) {
                return { error: "Failed to compute statistics" }
            }
            return await response.json()
        } catch (error) {
            return { error: "FastAPI service unavailable" }
        }
    },
})