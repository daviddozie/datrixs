import { createTool } from "@mastra/core/tools"
import { z } from "zod"

export const getDatasetInfoTool = createTool({
    id: "get-dataset-info",
    description:
        "Get information about the uploaded dataset including column names, row count, and a preview of the data. Always call this first before analyzing data.",
    inputSchema: z.object({
        sessionId: z
            .string()
            .describe("The session ID to get dataset info for"),
    }),
    execute: async ({ sessionId }) => {
        try {
            const fastapiUrl = process.env.FASTAPI_URL || "http://localhost:8000"
            const response = await fetch(
                `${fastapiUrl}/dataset-info/${sessionId}`
            )
            if (!response.ok) {
                return { error: "Failed to fetch dataset info" }
            }
            return await response.json()
        } catch (error) {
            return { error: "FastAPI service unavailable" }
        }
    },
})