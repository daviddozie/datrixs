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
        isTable?: boolean
    }
    query: string
}

type ChartMessageProps = {
    chartData: ChartData
}

export function ChartMessage({ chartData }: ChartMessageProps) {
    const { chartType, data } = chartData

    if (!data || !data.labels || !data.values) return null

    return (
        <div className="rounded-2xl border bg-card overflow-hidden w-full max-w-125">
            {/* Chart title */}
            <div className="px-4 py-3 border-b bg-muted/30">
                <p className="text-sm font-medium">{data.title}</p>
            </div>

            {/* Chart */}
            <div className="p-4">
                {chartType === "bar" && <BarChart data={data} />}
                {chartType === "line" && <LineChart data={data} />}
                {chartType === "pie" && <PieChart data={data} />}
            </div>
        </div>
    )
}


function BarChart({ data }: { data: ChartData["data"] }) {
    const maxValue = Math.max(...data.values)
    const formatValue = (v: number) =>
        data.isCurrency
            ? `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
            : v.toLocaleString("en-US", { maximumFractionDigits: 1 })

    const colors = [
        "#6366f1", "#8b5cf6", "#a78bfa",
        "#c4b5fd", "#7c3aed", "#4f46e5",
        "#818cf8", "#a5b4fc", "#e879f9", "#f0abfc"
    ]

    return (
        <div className="space-y-2">
            {data.labels.map((label, i) => (
                <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate max-w-35">
                            {label}
                        </span>
                        <span className="font-medium tabular-nums ml-2">
                            {formatValue(data.values[i])}
                        </span>
                    </div>
                    <div className="h-6 w-full rounded-sm bg-muted overflow-hidden">
                        <div
                            className="h-full rounded-sm transition-all duration-500"
                            style={{
                                width: `${(data.values[i] / maxValue) * 100}%`,
                                backgroundColor: colors[i % colors.length],
                            }}
                        />
                    </div>
                </div>
            ))}
            <p className="text-xs text-muted-foreground mt-3 text-center">
                {data.yLabel.replace(/_/g, " ")} by {data.xLabel.replace(/_/g, " ")}
            </p>
        </div>
    )
}


function LineChart({ data }: { data: ChartData["data"] }) {
    const width = 460
    const height = 200
    const padding = { top: 20, right: 20, bottom: 40, left: 60 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const maxValue = Math.max(...data.values)
    const minValue = Math.min(...data.values)
    const valueRange = maxValue - minValue || 1

    const formatValue = (v: number) =>
        data.isCurrency
            ? `$${(v / 1000).toFixed(1)}k`
            : v.toFixed(1)

    // Calculate points
    const points = data.values.map((v, i) => ({
        x: padding.left + (i / (data.values.length - 1)) * chartWidth,
        y: padding.top + chartHeight - ((v - minValue) / valueRange) * chartHeight,
    }))

    const pathD = points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
        .join(" ")

    // Area fill path
    const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`

    return (
        <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
                const y = padding.top + chartHeight * (1 - t)
                const val = minValue + valueRange * t
                return (
                    <g key={i}>
                        <line
                            x1={padding.left}
                            y1={y}
                            x2={width - padding.right}
                            y2={y}
                            stroke="currentColor"
                            strokeOpacity={0.1}
                            strokeWidth={1}
                        />
                        <text
                            x={padding.left - 8}
                            y={y}
                            textAnchor="end"
                            dominantBaseline="central"
                            fontSize={10}
                            fill="currentColor"
                            fillOpacity={0.5}
                        >
                            {formatValue(val)}
                        </text>
                    </g>
                )
            })}

            {/* Area fill */}
            <path d={areaD} fill="#6366f1" fillOpacity={0.1} />

            {/* Line */}
            <path
                d={pathD}
                fill="none"
                stroke="#6366f1"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Data points */}
            {points.map((p, i) => (
                <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={3}
                    fill="#6366f1"
                    stroke="white"
                    strokeWidth={1.5}
                />
            ))}

            {/* X axis labels */}
            {data.labels.map((label, i) => {
                if (data.labels.length > 6 && i % 2 !== 0) return null
                const x = padding.left + (i / (data.values.length - 1)) * chartWidth
                return (
                    <text
                        key={i}
                        x={x}
                        y={height - 8}
                        textAnchor="middle"
                        fontSize={9}
                        fill="currentColor"
                        fillOpacity={0.5}
                    >
                        {label.length > 7 ? label.slice(0, 7) : label}
                    </text>
                )
            })}
        </svg>
    )
}

function PieChart({ data }: { data: ChartData["data"] }) {
    const size = 200
    const cx = size / 2
    const cy = size / 2
    const radius = 75
    const innerRadius = 40

    const colors = [
        "#6366f1", "#8b5cf6", "#a78bfa",
        "#c4b5fd", "#7c3aed", "#4f46e5",
        "#818cf8", "#a5b4fc"
    ]

    const total = data.values.reduce((a, b) => a + b, 0)

    // Calculate slices
    let currentAngle = -Math.PI / 2
    const slices = data.values.map((value, i) => {
        const angle = (value / total) * 2 * Math.PI
        const startAngle = currentAngle
        const endAngle = currentAngle + angle
        currentAngle = endAngle

        const x1 = cx + radius * Math.cos(startAngle)
        const y1 = cy + radius * Math.sin(startAngle)
        const x2 = cx + radius * Math.cos(endAngle)
        const y2 = cy + radius * Math.sin(endAngle)
        const ix1 = cx + innerRadius * Math.cos(startAngle)
        const iy1 = cy + innerRadius * Math.sin(startAngle)
        const ix2 = cx + innerRadius * Math.cos(endAngle)
        const iy2 = cy + innerRadius * Math.sin(endAngle)

        const largeArc = angle > Math.PI ? 1 : 0

        const d = [
            `M ${ix1} ${iy1}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            `L ${ix2} ${iy2}`,
            `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
            "Z"
        ].join(" ")

        return { d, color: colors[i % colors.length], angle, startAngle, endAngle }
    })

    const formatValue = (v: number) =>
        data.isCurrency
            ? `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
            : v.toLocaleString()

    return (
        <div className="flex gap-4 items-center">
            {/* Donut chart */}
            <svg width={size} height={size} className="shrink-0">
                {slices.map((slice, i) => (
                    <path
                        key={i}
                        d={slice.d}
                        fill={slice.color}
                        stroke="var(--background)"
                        strokeWidth={2}
                    />
                ))}
                {/* Center text */}
                <text
                    x={cx}
                    y={cy - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fill="currentColor"
                    fillOpacity={0.6}
                >
                    Total
                </text>
                <text
                    x={cx}
                    y={cy + 10}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight="600"
                    fill="currentColor"
                >
                    {data.isCurrency
                        ? `$${(total / 1000).toFixed(0)}k`
                        : total.toLocaleString()}
                </text>
            </svg>

            {/* Legend */}
            <div className="space-y-1.5 flex-1 min-w-0">
                {data.labels.map((label, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: colors[i % colors.length] }}
                        />
                        <span className="text-xs text-muted-foreground truncate flex-1">
                            {label}
                        </span>
                        <span className="text-xs font-medium tabular-nums">
                            {data.percentages?.[i]}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}