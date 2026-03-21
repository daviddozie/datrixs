import { createTool } from "@mastra/core/tools"
import { z } from "zod"

export const visualizeTool = createTool({
    id: "visualize-data",
    description: `Generate a visualization (bar chart, line chart, or pie chart) 
of the dataset. Use this when the user asks for a chart, graph, plot, 
visualization, or wants to "see" the data visually.`,
    inputSchema: z.object({
        sessionId: z.string().describe("The current session ID"),
        query: z.string().describe("What to visualize — e.g. 'revenue by product'"),
        chartType: z.enum(["auto", "bar", "line", "pie"]).optional().describe(
            "Chart type — auto detects from query"
        ),
    }),
    execute: async ({ sessionId, query, chartType = "auto" }) => {
        try {
            const fastapiUrl = process.env.FASTAPI_URL || "http://localhost:8000"
            const response = await fetch(`${fastapiUrl}/visualize`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, query, chartType }),
            })

            if (!response.ok) {
                return { error: "Failed to generate visualization" }
            }

            const data = await response.json()
            return data
        } catch {
            return { error: "Visualization service unavailable" }
        }
    },
})