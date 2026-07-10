import { formatNumber } from './api'

function pointsToPath(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

function clampRange([min, max]) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [-1, 1]
  }
  return [min, max]
}

export function MarketChart({ title, chart, goals }) {
  const series = chart?.series || []
  const [yMin, yMax] = clampRange(chart?.yRange || [-1, 1])
  const xValues = series.map((row) => Number(row.mins)).filter(Number.isFinite)
  const xMin = xValues.length ? Math.min(...xValues) : 0
  const xMax = xValues.length ? Math.max(...xValues) : 90
  const width = 920
  const height = 320
  const padding = { top: 26, right: 18, bottom: 34, left: 48 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const xScale = (value) => {
    if (xMax === xMin) {
      return padding.left + plotWidth / 2
    }
    return padding.left + ((Number(value) - xMin) / (xMax - xMin)) * plotWidth
  }
  const yScale = (value) => padding.top + ((yMax - Number(value)) / (yMax - yMin)) * plotHeight

  const marketPoints = series
    .filter((row) => Number.isFinite(Number(row.market)))
    .map((row) => ({ x: xScale(row.mins), y: yScale(row.market) }))
  const ourPoints = series
    .filter((row) => Number.isFinite(Number(row.our)))
    .map((row) => ({ x: xScale(row.mins), y: yScale(row.our) }))
  const ticks = Array.from({ length: 5 }, (_, index) => yMin + ((yMax - yMin) * index) / 4)

  if (!series.length) {
    return (
      <section className="chart-panel">
        <div className="chart-title">{title}</div>
        <div className="empty-state">No Nowgoal data</div>
      </section>
    )
  }

  return (
    <section className="chart-panel">
      <div className="chart-toolbar">
        <div className="chart-title">{title}</div>
        <div className="chart-legend">
          <span className="legend-dot legend-dot--market" /> Market
          <span className="legend-dot legend-dot--our" /> Our
        </div>
      </div>
      <svg className="market-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} chart`}>
        <rect x="0" y="0" width={width} height={height} rx="0" className="chart-background" />
        {ticks.map((tick) => {
          const y = yScale(tick)
          return (
            <g key={tick}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="chart-grid" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="chart-tick">
                {formatNumber(tick, 1)}
              </text>
            </g>
          )
        })}
        {[0, 15, 30, 45, 60, 75, 90]
          .filter((tick) => tick >= xMin && tick <= xMax)
          .map((tick) => (
            <g key={tick}>
              <line x1={xScale(tick)} y1={padding.top} x2={xScale(tick)} y2={height - padding.bottom} className="chart-grid chart-grid--x" />
              <text x={xScale(tick)} y={height - 12} textAnchor="middle" className="chart-tick">
                {tick}
              </text>
            </g>
          ))}
        {(goals?.home || []).map((minute) => (
          <line key={`home-${minute}`} x1={xScale(minute)} y1={padding.top} x2={xScale(minute)} y2={height - padding.bottom} className="goal-line goal-line--home" />
        ))}
        {(goals?.away || []).map((minute) => (
          <line key={`away-${minute}`} x1={xScale(minute)} y1={padding.top} x2={xScale(minute)} y2={height - padding.bottom} className="goal-line goal-line--away" />
        ))}
        {marketPoints.length > 0 && <path d={pointsToPath(marketPoints)} className="chart-line chart-line--market" />}
        {ourPoints.length > 0 && <path d={pointsToPath(ourPoints)} className="chart-line chart-line--our" />}
        {marketPoints.map((point, index) => (
          <circle key={`m-${index}`} cx={point.x} cy={point.y} r="3.5" className="chart-point chart-point--market" />
        ))}
        {ourPoints.map((point, index) => (
          <circle key={`o-${index}`} cx={point.x} cy={point.y} r="3.5" className="chart-point chart-point--our" />
        ))}
      </svg>
    </section>
  )
}

