import * as cheerio from 'cheerio'
import { INDIVIDUAL_DOWNLOAD_LEAGUE } from './leagueConfig.js'
import { upsertNowgoalRecord } from './cache.js'

const GLS_LOOKUPS = {
  '0.50': 0.693,
  '0.75': 0.895,
  '1.00': 1.146,
  '1.25': 1.417,
  '1.50': 1.678,
  '1.75': 1.93,
  '2.00': 2.155,
  '2.25': 2.382,
  '2.50': 2.664,
  '2.75': 2.903,
  '3.00': 3.161,
  '3.25': 3.382,
  '3.50': 3.695,
  '3.75': 3.885,
  '4.00': 4.17,
  '4.25': 4.417,
  '4.50': 4.671,
  '4.75': 4.911,
  '5.00': 5.162,
  '5.25': 5.417,
  '5.50': 5.67,
  '5.75': 5.912,
  '6.00': 6.167,
  '6.25': 6.417,
  '6.50': 6.667,
  '6.75': 6.917,
  '7.00': 7.167,
  '7.25': 7.417,
  '7.50': 7.667,
  '7.75': 7.917,
  '8.00': 8.167,
  '8.25': 8.417,
  '8.50': 8.667,
  '8.75': 8.917,
  '9.00': 9.167,
  '9.25': 9.417,
  '9.50': 9.667,
  '9.75': 9.917,
  '10.00': 10.167,
  '10.25': 10.417,
  '10.50': 10.667,
  '10.75': 10.917,
  '11.00': 11.167,
  '11.25': 11.417,
  '11.50': 11.667,
  '11.75': 11.917,
  '12.00': 12.167,
  '12.25': 12.417,
  '12.50': 12.667,
  '12.75': 12.917,
  '13.00': 13.167,
  '13.25': 13.417,
  '13.50': 13.667,
  '13.75': 13.917,
  '14.00': 14.167,
  '14.25': 14.417,
  '14.50': 14.667,
  '14.75': 14.917,
  '15.00': 15.167,
}

const SUP_LOOKUPS = {
  '-15.00': 15.58,
  '-14.75': 15.32,
  '-14.50': 15.06,
  '-14.25': 14.8,
  '-14.00': 14.54,
  '-13.75': 14.28,
  '-13.50': 14.02,
  '-13.25': 13.76,
  '-13.00': 13.5,
  '-12.75': 13.24,
  '-12.50': 12.98,
  '-12.25': 12.72,
  '-12.00': 12.46,
  '-11.75': 12.2,
  '-11.50': 11.94,
  '-11.25': 11.68,
  '-11.00': 11.42,
  '-10.75': 11.16,
  '-10.50': 10.9,
  '-10.25': 10.64,
  '-10.00': 10.38,
  '-9.75': 10.12,
  '-9.50': 9.86,
  '-9.25': 9.6,
  '-9.00': 9.34,
  '-8.75': 9.08,
  '-8.50': 8.82,
  '-8.25': 8.56,
  '-8.00': 8.3,
  '-7.75': 8.04,
  '-7.50': 7.78,
  '-7.25': 7.52,
  '-7.00': 7.26,
  '-6.75': 7,
  '-6.50': 6.74,
  '-6.25': 6.48,
  '-6.00': 6.22,
  '-5.75': 5.96,
  '-5.50': 5.7,
  '-5.25': 5.44,
  '-5.00': 5.18,
  '-4.75': 4.92,
  '-4.50': 4.66,
  '-4.25': 4.4,
  '-4.00': 4.14,
  '-3.75': 3.88,
  '-3.50': 3.63,
  '-3.25': 3.36,
  '-3.00': 3.1,
  '-2.75': 2.84,
  '-2.50': 2.6,
  '-2.25': 2.34,
  '-2.00': 2.07,
  '-1.75': 1.8,
  '-1.50': 1.56,
  '-1.25': 1.31,
  '-1.00': 1.06,
  '-0.75': 0.81,
  '-0.50': 0.59,
  '-0.25': 0.3,
  '0.00': 0,
  '0.25': -0.3,
  '0.50': -0.59,
  '0.75': -0.81,
  '1.00': -1.06,
  '1.25': -1.31,
  '1.50': -1.56,
  '1.75': -1.8,
  '2.00': -2.07,
  '2.25': -2.34,
  '2.50': -2.6,
  '2.75': -2.84,
  '3.00': -3.1,
  '3.25': -3.36,
  '3.50': -3.63,
  '3.75': -3.88,
  '4.00': -4.14,
  '4.25': -4.4,
  '4.50': -4.66,
  '4.75': -4.92,
  '5.00': -5.18,
  '5.25': -5.44,
  '5.50': -5.7,
  '5.75': -5.96,
  '6.00': -6.22,
  '6.25': -6.48,
  '6.50': -6.74,
  '6.75': -7,
  '7.00': -7.26,
  '7.25': -7.52,
  '7.50': -7.78,
  '7.75': -8.04,
  '8.00': -8.3,
  '8.25': -8.56,
  '8.50': -8.82,
  '8.75': -9.08,
  '9.00': -9.34,
  '9.25': -9.6,
  '9.50': -9.86,
  '9.75': -10.12,
  '10.00': -10.38,
  '10.25': -10.64,
  '10.50': -10.9,
  '10.75': -11.16,
  '11.00': -11.42,
  '11.25': -11.68,
  '11.50': -11.94,
  '11.75': -12.2,
  '12.00': -12.46,
  '12.25': -12.7,
  '12.50': -12.98,
  '12.75': -13.24,
  '13.00': -13.5,
  '13.25': -13.76,
  '13.50': -14.02,
  '13.75': -14.28,
  '14.00': -14.54,
  '14.25': -14.8,
  '14.50': -15.06,
  '14.75': -15.32,
  '15.00': -15.58,
}

export function parseIndividualDownloadGameIds(rawValue) {
  return [
    ...new Set(
      String(rawValue || '')
        .split(/[\s,]+/)
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => {
          if (!/^\d{7}$/.test(token)) {
            throw new Error(`Invalid nowgoal game id ${token}`)
          }
          return String(Number(token))
        }),
    ),
  ]
}

function processHandicap(rawHandicap) {
  const stripped = String(rawHandicap || '').trim()
  const direct = Number(stripped)
  if (Number.isFinite(direct)) {
    return direct
  }

  const [upperRaw, lowerRaw] = stripped.split('/')
  if (!upperRaw || !lowerRaw) {
    throw new Error(`Invalid handicap value: ${rawHandicap}`)
  }
  const lower = upperRaw.includes('-') && !lowerRaw.includes('-') ? `-${lowerRaw}` : lowerRaw
  return (Number(upperRaw) + Number(lower)) / 2
}

function processScore(score) {
  const stripped = String(score || '').trim()
  if (!stripped) {
    return [null, null]
  }
  const [home, away] = stripped.split('-')
  return [Number(home), Number(away)]
}

function processTime(value) {
  const text = String(value || '').trim()
  if (/^\d+$/.test(text)) {
    return Number(text)
  }
  if (text.toLowerCase() === 'ht') {
    return 45
  }
  if (text.endsWith("'")) {
    return Number(text.slice(0, -1))
  }
  throw new Error(`Invalid time value: ${value}`)
}

function parseNowgoalDate(value) {
  const match = String(value || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) {
    throw new Error('Could not parse Nowgoal match start date.')
  }
  const [, month, day, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function lookup(map, key, label) {
  if (!(key in map)) {
    throw new Error(`Missing ${label} lookup for handicap ${key}`)
  }
  return map[key]
}

function formatLookupKey(value) {
  return Number(value || 0).toFixed(2)
}

function scrapeNowgoalTable($, selector) {
  const rows = []
  $(`${selector} tr`).each((_index, row) => {
    const cells = $(row)
      .find('td')
      .toArray()
      .map((cell) => $(cell).text().trim())

    if (cells.length < 5 || cells[2].toLowerCase().includes('closed')) {
      return
    }

    const oddsType = cells[0] === 'Live' ? 'prematch' : 'inplay'
    const [homeScore, awayScore] = oddsType === 'inplay' ? processScore(cells[1]) : [null, null]
    rows.push({
      t: oddsType === 'inplay' ? processTime(cells[0]) : null,
      home_score: homeScore,
      away_score: awayScore,
      home_odds: Number(cells[2]),
      handicap: processHandicap(cells[3]),
      away_odds: Number(cells[4]),
      real_t: cells[5] || '',
      odds_type: oddsType,
    })
  })
  return rows
}

function constructCompactRecord({ league, gameId, matchStartDate, team1, team2, team1Score, team2Score, supTable, glsTable }) {
  const baseSup = []
  const baseGls = []
  const homeGoalMinutes = []
  const awayGoalMinutes = []
  const homeSupAdjusts = []
  const awaySupAdjusts = []
  const manualAdjustment = 0.15
  let lastSup = null

  for (const row of supTable.filter((item) => item.t !== null).sort((a, b) => a.t - b.t)) {
    const key = formatLookupKey(row.handicap ? -row.handicap : row.handicap)
    const sup = lookup(SUP_LOOKUPS, key, 'SUP') + (row.away_odds - row.home_odds) / 2

    if (!homeGoalMinutes.includes(row.t) && row.home_score !== homeGoalMinutes.length) {
      homeGoalMinutes.push(row.t)
      homeSupAdjusts.push(lastSup === null ? -manualAdjustment : sup - lastSup)
    }
    if (!awayGoalMinutes.includes(row.t) && row.away_score !== awayGoalMinutes.length) {
      awayGoalMinutes.push(row.t)
      awaySupAdjusts.push(lastSup === null ? manualAdjustment : lastSup - sup)
    }

    baseSup.push([row.t, Number(sup.toFixed(4)), Number(row.handicap.toFixed(4))])
    lastSup = sup
  }

  for (const row of glsTable.filter((item) => item.t !== null)) {
    const key = formatLookupKey(row.handicap)
    const gls = lookup(GLS_LOOKUPS, key, 'GLS') + (row.away_odds - row.home_odds) / 2
    baseGls.push([row.t, Number(gls.toFixed(4)), Number(row.handicap.toFixed(4))])
  }

  return {
    league,
    game_id: String(gameId),
    match_start_date: matchStartDate,
    team1,
    team2,
    team1_score: team1Score,
    team2_score: team2Score,
    base_sup: baseSup,
    base_gls: baseGls,
    team1_gls_mins: homeGoalMinutes,
    team2_gls_mins: awayGoalMinutes,
    team1_sup_adjusts: homeSupAdjusts.map((value) => Number(value.toFixed(4))),
    team2_sup_adjusts: awaySupAdjusts.map((value) => Number(value.toFixed(4))),
    source_updated_at: new Date().toISOString(),
  }
}

export async function downloadAndExportNowgoalGame(gameId, league = INDIVIDUAL_DOWNLOAD_LEAGUE) {
  const url = `https://live3.nowgoal29.com/oddscomp/${gameId}`
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })
  if (!response.ok) {
    throw new Error(`Nowgoal returned ${response.status} for ${gameId}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)
  const teams = $('.sclassName')
    .toArray()
    .map((node) => $(node).text().trim())
    .filter(Boolean)
  const scores = $('.score')
    .toArray()
    .map((node) => $(node).text().trim())

  if (teams.length < 2) {
    throw new Error(`Could not parse teams for ${gameId}`)
  }

  const matchStartDate = parseNowgoalDate($('span.time').attr('data-t') || $('span.time').text())
  const record = constructCompactRecord({
    league,
    gameId,
    matchStartDate,
    team1: teams[0],
    team2: teams[1],
    team1Score: scores[0] || '',
    team2Score: scores[1] || '',
    supTable: scrapeNowgoalTable($, '#ahdetail'),
    glsTable: scrapeNowgoalTable($, '#oudetail'),
  })

  if (!record.base_sup.length && !record.base_gls.length) {
    throw new Error(`No Nowgoal odds rows found for ${gameId}`)
  }

  await upsertNowgoalRecord(record)
  return record
}

export async function downloadAndExportNowgoalGames(rawGameIds) {
  const gameIds = parseIndividualDownloadGameIds(rawGameIds)
  if (!gameIds.length) {
    throw new Error('Enter at least one game ID')
  }

  const results = []
  for (const gameId of gameIds) {
    try {
      const record = await downloadAndExportNowgoalGame(gameId)
      results.push({ gameId, record, error: null })
    } catch (error) {
      results.push({ gameId, record: null, error: error.message })
    }
  }
  return results
}

