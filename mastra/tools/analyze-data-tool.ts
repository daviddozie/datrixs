import { createTool } from "@mastra/core/tools"
import { z } from "zod"

export const analyzeDataTool = createTool({
    id: "analyze-data",
    description:
        "Run a specific analysis on the dataset. Use this for filtering, grouping, sorting, comparisons, trends, and custom queries. Describe what analysis to run in plain English.",
    inputSchema: z.object({
        sessionId: z.string().describe("The session ID"),
        query: z
            .string()
            .describe(
                "Plain English description of the analysis to run. E.g. 'group sales by region and sum totals', 'find top 10 customers by revenue', 'filter rows where status is active'"
            ),
    }),
    execute: async ({ sessionId, query }) => {
        try {
            const fastapiUrl = process.env.FASTAPI_URL || "http://localhost:8000"
            const response = await fetch(`${fastapiUrl}/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId,
                    query,
                }),
            })
            if (!response.ok) {
                return { error: "Failed to run analysis" }
            }
            return await response.json()
        } catch (error) {
            return { error: "FastAPI service unavailable" }
        }
    },
})