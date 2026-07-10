import express from 'express'
import { buildGraphPayload, getInitialValues } from './calculations.js'
import {
  findNowgoalMatchIdForFlashscoreRecord,
  getCacheInfo,
  getFlashscoreMatchUrl,
  getNowgoalMatchUrl,
  listLeagueOptions,
  listSharedMatchOptions,
  loadFlashscoreRecord,
  loadSelectedNowgoalRecord,
  syncFlashscoreLeagues,
  syncNowgoalLeagues,
  tryLoadFlashscoreRecord,
} from './cache.js'
import { LEAGUE_CONFIG } from './leagueConfig.js'
import { downloadAndExportNowgoalGames } from './nowgoalScraper.js'

const router = express.Router()

function getDefaultSinceDate() {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - 13)
  return date.toISOString().slice(0, 10)
}

function expandLeagueValues(values) {
  const selected = Array.isArray(values) ? values : []
  const expanded = []
  for (const value of selected) {
    if (value === '__group_jja__') {
      expanded.push(...LEAGUE_CONFIG.jja)
    } else if (value === '__group_ned__') {
      expanded.push(...LEAGUE_CONFIG.ned)
    } else {
      expanded.push(String(value))
    }
  }
  return [...new Set(expanded)].filter(Boolean)
}

function formatFlashscoreSummary(record, nowgoalGameId) {
  const score = `${record.team1_full_time_gls}-${record.team2_full_time_gls}`
  return {
    source: 'flashscore',
    gameId: String(record.game_id),
    team1: record.team1,
    team2: record.team2,
    score,
    halftimeScore: `HT ${record.team1_half_time_gls}-${record.team2_half_time_gls}`,
    matchDate: record.match_start_date,
    flashscoreUrl: getFlashscoreMatchUrl(record.game_id),
    nowgoalUrl: nowgoalGameId ? getNowgoalMatchUrl(nowgoalGameId) : null,
  }
}

function formatNowgoalSummary(record) {
  return {
    source: 'nowgoal',
    gameId: String(record.game_id),
    team1: record.team1,
    team2: record.team2,
    score: `${record.team1_score || ''}-${record.team2_score || ''}`,
    halftimeScore: 'Nowgoal only',
    matchDate: record.match_start_date,
    flashscoreUrl: null,
    nowgoalUrl: getNowgoalMatchUrl(record.game_id),
  }
}

router.get('/config', (_req, res) => {
  res.json({
    leagues: LEAGUE_CONFIG,
    defaultSinceDate: getDefaultSinceDate(),
    cache: getCacheInfo(),
  })
})

router.get('/leagues', async (_req, res, next) => {
  try {
    res.json({ leagues: await listLeagueOptions() })
  } catch (error) {
    next(error)
  }
})

router.get('/matches', async (req, res, next) => {
  try {
    res.json({ matches: await listSharedMatchOptions(req.query.league) })
  } catch (error) {
    next(error)
  }
})

router.get('/match', async (req, res, next) => {
  try {
    const { league, matchId } = req.query
    const { flashscoreRecord, nowgoalRecord, nowgoalGameId } = await loadSelectedNowgoalRecord(league, matchId)
    const initialValues = getInitialValues(nowgoalRecord)
    const effectiveFlashscoreRecord = flashscoreRecord || (await tryLoadFlashscoreRecord(league, matchId))
    const summary = effectiveFlashscoreRecord
      ? formatFlashscoreSummary(effectiveFlashscoreRecord, nowgoalGameId)
      : formatNowgoalSummary(nowgoalRecord)

    res.json({
      summary,
      nowgoalRecord,
      flashscoreRecord: effectiveFlashscoreRecord,
      nowgoalGameId,
      initialValues,
      graphs: buildGraphPayload(nowgoalRecord, initialValues.sup, initialValues.gls),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/graphs', async (req, res, next) => {
  try {
    const { league, matchId, sup, gls } = req.query
    const { nowgoalRecord } = await loadSelectedNowgoalRecord(league, matchId)
    res.json({
      graphs: buildGraphPayload(
        nowgoalRecord,
        sup === undefined || sup === '' ? null : Number(sup),
        gls === undefined || gls === '' ? null : Number(gls),
      ),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/flashscore', async (req, res, next) => {
  try {
    const record = await loadFlashscoreRecord(req.query.league, req.query.matchId)
    res.json({ record })
  } catch (error) {
    next(error)
  }
})

router.post('/sync', async (req, res, next) => {
  try {
    const selectedLeagues = expandLeagueValues(req.body.leagues)
    const sources = Array.isArray(req.body.sources) ? req.body.sources : []
    const sinceDates = req.body.sinceDates || {}
    const cache = getCacheInfo()

    if (selectedLeagues.length === 0) {
      return res.status(400).json({ error: 'Select at least one league to sync.' })
    }
    if (sources.length === 0) {
      return res.status(400).json({ error: 'Select at least one data source to sync.' })
    }
    if (sources.includes('nowgoal') && !cache.nowgoalBucket) {
      return res.status(400).json({ error: 'NOWGOAL_GCS_BUCKET is not set in your env.' })
    }
    if (sources.includes('flashscore') && !cache.flashscoreBucket) {
      return res.status(400).json({ error: 'NOWGOAL_GCS_BUCKET or FLASHSCORE_GCS_BUCKET is not set in your env.' })
    }

    const leagueSinceMap = Object.fromEntries(
      selectedLeagues.map((league) => [league, sinceDates[league] || getDefaultSinceDate()]),
    )
    const lines = [
      `Bucket: ${cache.nowgoalBucket || cache.flashscoreBucket}`,
      `Nowgoal Prefix: ${cache.nowgoalPrefix || '(bucket root)'}`,
      `Flashscore Prefix: ${cache.flashscorePrefix || '(bucket root)'}`,
      `Sources: ${sources.join(', ')}`,
      '',
    ]

    const response = { status: '', nowgoal: null, flashscore: null, leagues: await listLeagueOptions() }

    if (sources.includes('nowgoal')) {
      try {
        const result = await syncNowgoalLeagues({
          bucketName: cache.nowgoalBucket,
          prefix: cache.nowgoalPrefix,
          leagueSinceMap,
        })
        response.nowgoal = result
        lines.push('Nowgoal')
        for (const league of selectedLeagues) {
          const leagueResult = result.leagues[league] || {}
          lines.push(
            `${league}: ${leagueResult.status || 'unknown'} since ${leagueSinceMap[league]} ` +
              `(${leagueResult.downloaded_files || 0} files downloaded)`,
          )
        }
        lines.push(`Nowgoal total files downloaded: ${result.downloaded_files || 0}`)
        lines.push('')
      } catch (error) {
        lines.push(`Nowgoal sync failed: ${error.message}`)
        lines.push('')
      }
    }

    if (sources.includes('flashscore')) {
      try {
        const result = await syncFlashscoreLeagues({
          bucketName: cache.flashscoreBucket,
          prefix: cache.flashscorePrefix,
          leagueSinceMap,
        })
        response.flashscore = result
        lines.push('Flashscore')
        for (const league of selectedLeagues) {
          const leagueResult = result.leagues[league] || {}
          lines.push(
            `${league}: ${leagueResult.status || 'unknown'} since ${leagueSinceMap[league]} ` +
              `(${leagueResult.downloaded_files || 0} files downloaded)`,
          )
        }
        lines.push(`Flashscore total files downloaded: ${result.downloaded_files || 0}`)
      } catch (error) {
        lines.push(`Flashscore sync failed: ${error.message}`)
      }
    }

    response.status = lines.join('\n')
    response.leagues = await listLeagueOptions()
    return res.json(response)
  } catch (error) {
    next(error)
  }
})

router.post('/individual-downloads', async (req, res, next) => {
  try {
    const results = await downloadAndExportNowgoalGames(req.body.gameIds)
    const downloaded = results.filter((result) => result.record && !result.error).length
    const lines = [`Requested ${results.length} game(s); downloaded ${downloaded}.`]
    for (const result of results) {
      if (result.error || !result.record) {
        lines.push(`${result.gameId}: failed - ${result.error}`)
      } else {
        lines.push(`${result.gameId}: downloaded ${result.record.team1} v ${result.record.team2} on ${result.record.match_start_date}`)
      }
    }
    res.json({
      status: lines.join('\n'),
      results,
      leagues: await listLeagueOptions(),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/links', async (req, res, next) => {
  try {
    const flashscoreRecord = await tryLoadFlashscoreRecord(req.query.league, req.query.matchId)
    const nowgoalGameId = flashscoreRecord
      ? await findNowgoalMatchIdForFlashscoreRecord(req.query.league, flashscoreRecord)
      : req.query.matchId
    res.json({
      flashscoreUrl: flashscoreRecord ? getFlashscoreMatchUrl(flashscoreRecord.game_id) : null,
      nowgoalUrl: nowgoalGameId ? getNowgoalMatchUrl(nowgoalGameId) : null,
    })
  } catch (error) {
    next(error)
  }
})

export default router
