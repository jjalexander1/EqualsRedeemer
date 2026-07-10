function isFiniteNumber(value) {
  return Number.isFinite(Number(value))
}

export function getScoreFromCurrentMinute(mins, homeGoalMinutes, awayGoalMinutes) {
  const homeGoals = homeGoalMinutes.filter((minute) => minute <= mins).length
  const awayGoals = awayGoalMinutes.filter((minute) => minute <= mins).length
  return { homeGoals, awayGoals }
}

export function getMarketDrawAdjustment(
  gameMins,
  homeGoalMins,
  awayGoalMins,
  homeGoalAdjusts,
  awayGoalAdjusts,
) {
  if (gameMins >= 85) {
    return 0
  }

  const homeAdjust = homeGoalMins
    .map((goalMins, index) =>
      goalMins <= gameMins ? (Number(homeGoalAdjusts[index] || 0) * (90 - gameMins)) / (90 - goalMins) : 0,
    )
    .reduce((sum, value) => sum + value, 0)

  const awayAdjust = awayGoalMins
    .map((goalMins, index) =>
      goalMins <= gameMins ? (Number(awayGoalAdjusts[index] || 0) * (90 - gameMins)) / (90 - goalMins) : 0,
    )
    .reduce((sum, value) => sum + value, 0)

  return homeAdjust - awayAdjust
}

export function linearDecayWithMarketDrawAdjust(
  initialValue,
  mins,
  homeGoalMins,
  awayGoalMins,
  homeGoalAdjusts,
  awayGoalAdjusts,
) {
  const rawDecay = (Number(initialValue) * (90 - Number(mins))) / 90
  const drawAdjust = getMarketDrawAdjustment(
    Number(mins),
    homeGoalMins,
    awayGoalMins,
    homeGoalAdjusts,
    awayGoalAdjusts,
  )
  return rawDecay + drawAdjust
}

export function linearDecayWithMarketDrawAdjustGls(initialValue, mins, homeGoalMins, awayGoalMins) {
  const rawDecay = (Number(initialValue) * (90 - Number(mins))) / 90
  const goalsSoFar = [...homeGoalMins, ...awayGoalMins].filter((goalMinute) => goalMinute <= mins).length
  return rawDecay + goalsSoFar
}

function marketRows(record, key) {
  const rows = key === 'sup' ? record.base_sup : record.base_gls
  return (rows || [])
    .map(([mins, value, handicap]) => ({
      mins: Number(mins),
      value: Number(value),
      handicap: Number(handicap),
    }))
    .filter((row) => isFiniteNumber(row.mins) && isFiniteNumber(row.value))
}

export function buildGraphPayload(record, supValue, glsValue) {
  const homeGoals = (record.team1_gls_mins || []).filter(isFiniteNumber).map(Number)
  const awayGoals = (record.team2_gls_mins || []).filter(isFiniteNumber).map(Number)
  const homeAdjusts = (record.team1_sup_adjusts || []).map(Number)
  const awayAdjusts = (record.team2_sup_adjusts || []).map(Number)

  const supSeries = marketRows(record, 'sup').map((row) => ({
    mins: row.mins,
    market: row.value,
    our:
      supValue === null || supValue === undefined || supValue === ''
        ? null
        : linearDecayWithMarketDrawAdjust(Number(supValue), row.mins, homeGoals, awayGoals, homeAdjusts, awayAdjusts),
  }))

  const glsSeries = marketRows(record, 'gls').map((row) => ({
    mins: row.mins,
    market: row.value,
    our:
      glsValue === null || glsValue === undefined || glsValue === ''
        ? null
        : linearDecayWithMarketDrawAdjustGls(Number(glsValue), row.mins, homeGoals, awayGoals),
  }))

  return {
    sup: {
      label: 'SUP',
      series: supSeries,
      yRange: getYAxisRange(supSeries),
    },
    gls: {
      label: 'GLS',
      series: glsSeries,
      yRange: getYAxisRange(glsSeries),
    },
    goals: {
      home: homeGoals,
      away: awayGoals,
    },
  }
}

export function getInitialValues(record) {
  const sup = marketRows(record, 'sup').find((row) => row.mins >= 0)
  const gls = marketRows(record, 'gls').find((row) => row.mins >= 0)
  return {
    sup: sup ? Number(sup.value.toFixed(2)) : null,
    gls: gls ? Number(gls.value.toFixed(2)) : null,
  }
}

function getYAxisRange(series, buffer = 0.3) {
  const marketValues = series
    .filter((row) => row.mins >= 0 && row.mins <= 30)
    .map((row) => row.market)
    .filter(isFiniteNumber)

  if (!marketValues.length) {
    return [-1, 1]
  }

  const minValue = Math.min(...marketValues)
  const maxValue = Math.max(...marketValues)
  return [Math.min(minValue - buffer, 0), Math.max(maxValue + buffer, 0)]
}

