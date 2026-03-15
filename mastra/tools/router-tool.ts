import { createTool } from "@mastra/core/tools"
import { z } from "zod"

export const routerTool = createTool({
    id: "router",
    description: `Analyzes the user's question and determines exactly which 
tool to call and what parameters to use. Always call this tool FIRST 
before any other tool. It will tell you exactly what to do next.`,
    inputSchema: z.object({
        sessionId: z.string().describe("The current session ID"),
        query: z.string().describe("The user's question exactly as asked"),
    }),
    execute: async ({ sessionId, query }) => {
        // Fetch actual dataset info
        // This makes the router dynamic — it knows the real
        // columns before deciding what to do
        let datasetColumns: string[] = []
        let numericColumns: string[] = []
        let categoricalColumns: string[] = []
        let hasData = false

        try {
            const fastapiUrl = process.env.FASTAPI_URL || "http://localhost:8000"
            const response = await fetch(
                `${fastapiUrl}/dataset-info/${sessionId}`
            )
            if (response.ok) {
                const info = await response.json()
                datasetColumns = info.columns || []
                numericColumns = info.numericColumns || []
                categoricalColumns = info.categoricalColumns || []
                hasData = info.rowCount > 0
            }
        } catch (error) {
            // FastAPI unavailable — fall back to intent detection only
        }

        // If no data, tell agent immediately
        if (!hasData && datasetColumns.length === 0) {
            return {
                tool: "get-dataset-info",
                reason: "No dataset found — checking what data is available",
                params: { sessionId },
                nextStep: "Call get-dataset-info to check if any data has been uploaded",
                datasetInfo: { columns: [], numericColumns: [], categoricalColumns: [] }
            }
        }

        const q = query.toLowerCase()

        // Detect user intent

        // Merge intent — user wants multiple files combined
        const isMerge =
            /merge|combine|join|both files|all files|across files|multiple files/i.test(q)

        // Overview intent — user wants to understand the data
        const isOverview =
            /what (columns?|data|fields?|information)|show me|describe|overview|structure|preview|what do (you|we) have|summarize the (data|file|document)|what is in|tell me about/i.test(q)

        // Statistics intent — user wants calculations
        const isStats =
            /average|mean|median|total|sum|count|minimum|maximum|min|max|std|standard deviation|distribution|correlation|variance|how many|percentage|percent|ratio|range/i.test(q)

        // Ranking intent — user wants top/bottom items
        const isRanking =
            /top|bottom|highest|lowest|best|worst|most|least|rank|leading|largest|smallest|\d+\s*(products?|items?|rows?|records?|entries?)/i.test(q)

        // Grouping intent — user wants data grouped
        const isGroupBy =
            /by (each|every|group|type|status|category|region|department|location|month|year|quarter)|per |group by|breakdown|split by|segment/i.test(q)

        // Trend intent — user wants time-based analysis
        const isTrend =
            /trend|over time|by month|by year|by date|monthly|yearly|quarterly|growth|change over|time series|historical|pattern/i.test(q)

        // Filter intent — user wants a specific subset
        const isFilter =
            /where|filter|only|show (me )?(rows?|records?|entries?)|find (all )?rows?|with status|whose|that (are|have|is)/i.test(q)

        // Comparison intent — user wants to compare things
        const isComparison =
            /compare|vs\.?|versus|difference between|which is (better|higher|lower|more|less)|contrast|how does .+ compare/i.test(q)

        // Match query to actual columns
        // Find which real columns the user is asking about
        const mentionedColumns = datasetColumns.filter(col => {
            const colLower = col.toLowerCase().replace(/_/g, " ")
            return q.includes(colLower) || q.includes(col.toLowerCase())
        })

        const mentionedNumeric = numericColumns.filter(col => {
            const colLower = col.toLowerCase().replace(/_/g, " ")
            return q.includes(colLower) || q.includes(col.toLowerCase())
        })

        // Route to correct tool

        if (isMerge) {
            return {
                tool: "merge-datasets",
                reason: "User wants to combine multiple uploaded files",
                params: { sessionId },
                nextStep: "Call merge-datasets with the sessionId, then answer based on merged result",
                datasetInfo: { columns: datasetColumns, numericColumns, categoricalColumns }
            }
        }

        if (isOverview && !isStats && !isRanking && !isGroupBy) {
            return {
                tool: "get-dataset-info",
                reason: "User wants to understand the dataset structure",
                params: { sessionId },
                nextStep: "Call get-dataset-info with the sessionId, then describe the dataset clearly including all columns and their types",
                datasetInfo: { columns: datasetColumns, numericColumns, categoricalColumns }
            }
        }

        if (isStats && !isGroupBy && !isRanking) {
            return {
                tool: "run-statistics",
                reason: "User wants statistical calculations",
                params: {
                    sessionId,
                    columns: mentionedNumeric.length > 0 ? mentionedNumeric : []
                },
                nextStep: `Call run-statistics with sessionId${mentionedNumeric.length > 0 ? ` and columns: ${mentionedNumeric.join(", ")}` : " (all numeric columns)"}. Then explain the statistics clearly with context.`,
                datasetInfo: { columns: datasetColumns, numericColumns, categoricalColumns }
            }
        }

        if (isRanking || isGroupBy || isTrend || isFilter || isComparison) {
            return {
                tool: "analyze-data",
                reason: `User wants ${isRanking ? "ranking" : isGroupBy ? "groupby" : isTrend ? "trend" : isFilter ? "filtering" : "comparison"} analysis`,
                params: {
                    sessionId,
                    query: query
                },
                nextStep: `Call analyze-data with sessionId and the exact user query. Available columns are: ${datasetColumns.join(", ")}. Then explain the results clearly.`,
                datasetInfo: { columns: datasetColumns, numericColumns, categoricalColumns }
            }
        }

        // ── Default: analyze-data handles general questions ─
        return {
            tool: "analyze-data",
            reason: "General data question — running analysis",
            params: {
                sessionId,
                query: query
            },
            nextStep: `Call analyze-data with sessionId and the user's query. Available columns: ${datasetColumns.join(", ")}. Explain results in plain English.`,
            datasetInfo: { columns: datasetColumns, numericColumns, categoricalColumns }
        }
    },
})