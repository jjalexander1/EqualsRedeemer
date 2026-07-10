import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { promisify } from 'node:util'
import { Storage } from '@google-cloud/storage'
import { INDIVIDUAL_DOWNLOAD_LEAGUE, INDIVIDUAL_DOWNLOAD_LEAGUE_LABEL } from './leagueConfig.js'

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

const CLOUD_LAYOUT_VERSION = 'v1'
const DEFAULT_NOWGOAL_PREFIX = 'nowgoal-data'
const DEFAULT_FLASHSCORE_PREFIX = 'flashscore-data'
const DEFAULT_CACHE_ROOT = path.join(process.cwd(), 'data', 'cache')

const cacheRoot = process.env.CACHE_DIR || process.env.INPLAY_CACHE_DIR || DEFAULT_CACHE_ROOT
const nowgoalRoot = path.join(cacheRoot, 'nowgoal_cloud')
const flashscoreRoot = path.join(cacheRoot, 'flashscore_cloud')

let storageClient = null

function getStorageClient() {
  if (!storageClient) {
    storageClient = new Storage()
  }
  return storageClient
}

function buildBlobName(relpath, prefix) {
  const cleanPrefix = String(prefix || '').trim().replace(/^\/+|\/+$/g, '')
  return cleanPrefix ? `${cleanPrefix}/${relpath}` : relpath
}

function relpathToLocalPath(root, relpath) {
  return path.join(root, ...String(relpath).split('/'))
}

async function ensureParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

async function writeJson(filePath, payload) {
  await ensureParent(filePath)
  await fs.writeFile(filePath, JSON.stringify(payload), 'utf8')
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback
    }
    throw error
  }
}

async function writeGzipJson(filePath, payload) {
  await ensureParent(filePath)
  const zipped = await gzip(Buffer.from(JSON.stringify(payload), 'utf8'), { level: 6 })
  await fs.writeFile(filePath, zipped)
}

async function readGzipJson(filePath, fallback) {
  try {
    const payload = await gunzip(await fs.readFile(filePath))
    return JSON.parse(payload.toString('utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback
    }
    throw error
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function fileMd5(filePath) {
  const hash = crypto.createHash('md5')
  const stream = fsSync.createReadStream(filePath)
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

async function localFileMatchesMd5(filePath, expectedMd5) {
  if (!expectedMd5 || !(await fileExists(filePath))) {
    return false
  }
  return (await fileMd5(filePath)) === expectedMd5
}

function nowgoalManifestRelpath(league) {
  return `manifest/${CLOUD_LAYOUT_VERSION}/league=${league}.json.gz`
}

function flashscoreManifestRelpath(league) {
  return `manifest/${CLOUD_LAYOUT_VERSION}/league=${league}.json.gz`
}

function globalManifestRelpath() {
  return `manifest/${CLOUD_LAYOUT_VERSION}/index.json`
}

function nowgoalDetailRelpath(league, matchDate) {
  return `detail/${CLOUD_LAYOUT_VERSION}/league=${league}/date=${matchDate}.json.gz`
}

function extractMatchDate(blobName) {
  const match = String(blobName).match(/date=(\d{4}-\d{2}-\d{2})\.json\.gz$/)
  return match ? match[1] : null
}

async function fetchGcsJson(bucketName, relpath, prefix, client = getStorageClient()) {
  const file = client.bucket(bucketName).file(buildBlobName(relpath, prefix))
  const [payload] = await file.download()
  if (relpath.endsWith('.gz')) {
    return JSON.parse((await gunzip(payload)).toString('utf8'))
  }
  return JSON.parse(payload.toString('utf8'))
}

async function downloadGcsFile(bucketName, relpath, localRoot, prefix, client = getStorageClient()) {
  const file = client.bucket(bucketName).file(buildBlobName(relpath, prefix))
  const [payload] = await file.download()
  const localPath = relpathToLocalPath(localRoot, relpath)
  await ensureParent(localPath)
  await fs.writeFile(localPath, payload)
  return localPath
}

async function downloadBlobToRelpath(file, localRoot, relpath) {
  const [payload] = await file.download()
  const localPath = relpathToLocalPath(localRoot, relpath)
  await ensureParent(localPath)
  await fs.writeFile(localPath, payload)
  return localPath
}

function gcsMd5Hex(file) {
  const md5Hash = file?.metadata?.md5Hash
  if (!md5Hash) {
    return null
  }
  try {
    return Buffer.from(md5Hash, 'base64').toString('hex')
  } catch {
    return null
  }
}

async function listGcsDetailBlobsForLeague(bucketName, league, prefix, client = getStorageClient()) {
  const bucket = client.bucket(bucketName)
  const detailPrefix = buildBlobName(`detail/${CLOUD_LAYOUT_VERSION}/league=${league}/`, prefix)
  const [files] = await bucket.getFiles({ prefix: detailPrefix })
  const byDate = new Map()

  for (const file of files) {
    const matchDate = extractMatchDate(file.name)
    if (!matchDate) {
      continue
    }

    const existing = byDate.get(matchDate)
    const updated = new Date(file.metadata?.updated || 0).getTime()
    const existingUpdated = new Date(existing?.metadata?.updated || 0).getTime()
    if (!existing || updated >= existingUpdated) {
      byDate.set(matchDate, file)
    }
  }

  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
}

function parseDate(value) {
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`)
  }
  return parsed
}

function dateGte(left, right) {
  return parseDate(left).getTime() >= parseDate(right).getTime()
}

async function buildNowgoalLeagueManifest(league) {
  const detailDir = relpathToLocalPath(nowgoalRoot, `detail/${CLOUD_LAYOUT_VERSION}/league=${league}`)
  const dates = {}

  try {
    const files = await fs.readdir(detailDir)
    for (const fileName of files.sort()) {
      if (!fileName.endsWith('.json.gz')) {
        continue
      }

      const matchDate = extractMatchDate(fileName)
      if (!matchDate) {
        continue
      }

      const detailRelpath = nowgoalDetailRelpath(league, matchDate)
      const detailPath = relpathToLocalPath(nowgoalRoot, detailRelpath)
      const records = await readGzipJson(detailPath, [])
      dates[matchDate] = {
        detail_path: detailRelpath,
        detail_md5: await fileMd5(detailPath),
        match_count: records.length,
        matches: records.map((record) => ({
          game_id: String(record.game_id),
          team1: String(record.team1 || ''),
          team2: String(record.team2 || ''),
          team1_score: String(record.team1_score || ''),
          team2_score: String(record.team2_score || ''),
        })),
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }

  const manifest = {
    version: 1,
    layout_version: CLOUD_LAYOUT_VERSION,
    league,
    updated_at: new Date().toISOString(),
    dates,
  }
  await writeGzipJson(relpathToLocalPath(nowgoalRoot, nowgoalManifestRelpath(league)), manifest)
  return manifest
}

export async function upsertNowgoalRecord(record) {
  await ensureCacheDirs()
  const league = String(record.league)
  const detailRelpath = nowgoalDetailRelpath(league, record.match_start_date)
  const detailPath = relpathToLocalPath(nowgoalRoot, detailRelpath)
  const existingRecords = await readGzipJson(detailPath, [])
  const merged = new Map(existingRecords.map((item) => [String(item.game_id), item]))
  merged.set(String(record.game_id), record)
  const payload = [...merged.values()].sort((a, b) =>
    [a.match_start_date, a.team1, a.team2, a.game_id]
      .map((value) => String(value || ''))
      .join('::')
      .localeCompare(
        [b.match_start_date, b.team1, b.team2, b.game_id].map((value) => String(value || '')).join('::'),
      ),
  )
  await writeGzipJson(detailPath, payload)
  await buildNowgoalLeagueManifest(league)
  await buildGlobalManifest(nowgoalRoot)
}

async function buildGlobalManifest(root) {
  const manifestDir = relpathToLocalPath(root, `manifest/${CLOUD_LAYOUT_VERSION}`)
  const leagues = []

  try {
    const files = await fs.readdir(manifestDir)
    for (const fileName of files.sort()) {
      if (fileName === 'index.json' || !fileName.endsWith('.json.gz')) {
        continue
      }
      const league = fileName.replace('league=', '').replace('.json.gz', '')
      const manifestPath = `manifest/${CLOUD_LAYOUT_VERSION}/${fileName}`
      const localPath = relpathToLocalPath(root, manifestPath)
      leagues.push({
        league,
        manifest_path: manifestPath,
        manifest_md5: await fileMd5(localPath),
      })
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }

  const payload = {
    version: 1,
    layout_version: CLOUD_LAYOUT_VERSION,
    updated_at: new Date().toISOString(),
    leagues,
  }
  await writeJson(relpathToLocalPath(root, globalManifestRelpath()), payload)
  return payload
}

export function getCacheInfo() {
  return {
    cacheRoot,
    nowgoalRoot,
    flashscoreRoot,
    nowgoalBucket: process.env.NOWGOAL_GCS_BUCKET || '',
    nowgoalPrefix: process.env.NOWGOAL_GCS_PREFIX || DEFAULT_NOWGOAL_PREFIX,
    flashscoreBucket: process.env.FLASHSCORE_GCS_BUCKET || process.env.NOWGOAL_GCS_BUCKET || '',
    flashscorePrefix: process.env.FLASHSCORE_GCS_PREFIX || DEFAULT_FLASHSCORE_PREFIX,
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  }
}

export async function ensureCacheDirs() {
  await fs.mkdir(nowgoalRoot, { recursive: true })
  await fs.mkdir(flashscoreRoot, { recursive: true })
}

export async function syncNowgoalLeagues({ bucketName, prefix, leagueSinceMap }) {
  await ensureCacheDirs()
  const client = getStorageClient()
  const result = { leagues: {}, downloaded_files: 0 }
  let indexPayload = { leagues: [] }

  try {
    indexPayload = await fetchGcsJson(bucketName, globalManifestRelpath(), prefix, client)
  } catch {
    indexPayload = { leagues: [] }
  }

  const availableLeagues = new Set((indexPayload.leagues || []).map((entry) => entry.league))

  for (const [league, sinceDate] of Object.entries(leagueSinceMap || {})) {
    const fallbackBlobs = await listGcsDetailBlobsForLeague(bucketName, league, prefix, client)
    if (!availableLeagues.has(league) && fallbackBlobs.length === 0) {
      result.leagues[league] = { status: 'missing_remote_league', downloaded_files: 0 }
      continue
    }

    let downloadedFiles = 0
    if (fallbackBlobs.length > 0) {
      for (const [matchDate, file] of fallbackBlobs) {
        if (!dateGte(matchDate, sinceDate)) {
          continue
        }
        const relpath = nowgoalDetailRelpath(league, matchDate)
        const localPath = relpathToLocalPath(nowgoalRoot, relpath)
        const expectedMd5 = gcsMd5Hex(file)
        if (await localFileMatchesMd5(localPath, expectedMd5)) {
          continue
        }
        await downloadBlobToRelpath(file, nowgoalRoot, relpath)
        downloadedFiles += 1
      }
    } else {
      const manifest = await fetchGcsJson(bucketName, nowgoalManifestRelpath(league), prefix, client)
      await writeGzipJson(relpathToLocalPath(nowgoalRoot, nowgoalManifestRelpath(league)), manifest)
      for (const [matchDate, entry] of Object.entries(manifest.dates || {})) {
        if (!dateGte(matchDate, sinceDate) || !entry.detail_path) {
          continue
        }
        await downloadGcsFile(bucketName, entry.detail_path, nowgoalRoot, prefix, client)
        downloadedFiles += 1
      }
    }

    await buildNowgoalLeagueManifest(league)
    result.leagues[league] = { status: 'ok', downloaded_files: downloadedFiles }
    result.downloaded_files += downloadedFiles
  }

  await buildGlobalManifest(nowgoalRoot)
  return result
}

export async function syncFlashscoreLeagues({ bucketName, prefix, leagueSinceMap }) {
  await ensureCacheDirs()
  const client = getStorageClient()
  const indexPayload = await fetchGcsJson(bucketName, globalManifestRelpath(), prefix, client)
  const availableLeagues = new Set((indexPayload.leagues || []).map((entry) => entry.league))
  const result = { leagues: {}, downloaded_files: 0 }

  await writeJson(relpathToLocalPath(flashscoreRoot, globalManifestRelpath()), indexPayload)

  for (const [league, sinceDate] of Object.entries(leagueSinceMap || {})) {
    if (!availableLeagues.has(league)) {
      result.leagues[league] = { status: 'missing_remote_league', downloaded_files: 0 }
      continue
    }

    const manifest = await fetchGcsJson(bucketName, flashscoreManifestRelpath(league), prefix, client)
    await writeGzipJson(relpathToLocalPath(flashscoreRoot, flashscoreManifestRelpath(league)), manifest)

    let downloadedFiles = 0
    for (const [matchDate, entry] of Object.entries(manifest.dates || {})) {
      if (!dateGte(matchDate, sinceDate) || !entry.detail_path) {
        continue
      }
      const localPath = relpathToLocalPath(flashscoreRoot, entry.detail_path)
      if (await localFileMatchesMd5(localPath, entry.detail_md5)) {
        continue
      }
      await downloadGcsFile(bucketName, entry.detail_path, flashscoreRoot, prefix, client)
      downloadedFiles += 1
    }

    result.leagues[league] = { status: 'ok', downloaded_files: downloadedFiles }
    result.downloaded_files += downloadedFiles
  }

  return result
}

async function listLocalLeagues(root) {
  const indexPath = relpathToLocalPath(root, globalManifestRelpath())
  const payload = await readJson(indexPath, { leagues: [] })
  const leagues = []
  for (const entry of payload.leagues || []) {
    if (await fileExists(relpathToLocalPath(root, entry.manifest_path))) {
      leagues.push(entry.league)
    }
  }
  return leagues.sort()
}

async function loadLeagueManifest(root, manifestRelpath) {
  const manifest = await readGzipJson(relpathToLocalPath(root, manifestRelpath), {})
  if (!manifest?.dates) {
    return {}
  }

  const dates = {}
  for (const [matchDate, entry] of Object.entries(manifest.dates || {})) {
    if (entry.detail_path && (await fileExists(relpathToLocalPath(root, entry.detail_path)))) {
      dates[matchDate] = entry
    }
  }
  return { ...manifest, dates }
}

async function loadNowgoalLeagueManifest(league) {
  return loadLeagueManifest(nowgoalRoot, nowgoalManifestRelpath(league))
}

async function loadFlashscoreLeagueManifest(league) {
  return loadLeagueManifest(flashscoreRoot, flashscoreManifestRelpath(league))
}

export async function listSharedLocalLeagues() {
  await ensureCacheDirs()
  const seen = new Set()
  const ordered = []
  for (const league of [...(await listLocalLeagues(nowgoalRoot)), ...(await listLocalLeagues(flashscoreRoot))]) {
    if (!seen.has(league)) {
      seen.add(league)
      ordered.push(league)
    }
  }
  return ordered
}

function normalizeTeamName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function matchOptionKey(option) {
  return [
    String(option.match_date || '').trim(),
    normalizeTeamName(option.team1),
    normalizeTeamName(option.team2),
  ].join('::')
}

function formatLeagueLabel(league) {
  return league === INDIVIDUAL_DOWNLOAD_LEAGUE ? INDIVIDUAL_DOWNLOAD_LEAGUE_LABEL : league
}

export async function listLeagueOptions() {
  const leagues = await listSharedLocalLeagues()
  return leagues.map((league) => ({ value: league, label: formatLeagueLabel(league) }))
}

async function listNowgoalMatchOptions(league) {
  const manifest = await loadNowgoalLeagueManifest(league)
  const options = []
  for (const [matchDate, entry] of Object.entries(manifest.dates || {})) {
    for (const match of entry.matches || []) {
      options.push({
        value: String(match.game_id),
        match_date: matchDate,
        team1: String(match.team1 || ''),
        team2: String(match.team2 || ''),
        source: 'nowgoal',
      })
    }
  }
  return options
}

async function listFlashscoreMatchOptions(league) {
  const manifest = await loadFlashscoreLeagueManifest(league)
  const options = []
  for (const [matchDate, entry] of Object.entries(manifest.dates || {})) {
    for (const match of entry.matches || []) {
      options.push({
        value: String(match.game_id),
        match_date: matchDate,
        team1: String(match.team1 || ''),
        team2: String(match.team2 || ''),
        source: 'flashscore',
        has_stats: Boolean(match.has_stats),
        has_lineups: Boolean(match.has_lineups),
        has_commentary: Boolean(match.has_commentary),
      })
    }
  }
  return options
}

export async function listSharedMatchOptions(league) {
  if (!league) {
    return []
  }
  const merged = []
  const seen = new Set()
  for (const option of [...(await listFlashscoreMatchOptions(league)), ...(await listNowgoalMatchOptions(league))]) {
    const key = matchOptionKey(option)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    merged.push(option)
  }
  return merged.sort((a, b) =>
    [a.match_date, a.team1, a.team2].join('::').localeCompare([b.match_date, b.team1, b.team2].join('::')),
  )
}

async function loadRecordFromManifest(root, manifest, gameId) {
  for (const entry of Object.values(manifest.dates || {})) {
    if (!(entry.matches || []).some((match) => String(match.game_id) === String(gameId))) {
      continue
    }
    const records = await readGzipJson(relpathToLocalPath(root, entry.detail_path), [])
    const record = records.find((item) => String(item.game_id) === String(gameId))
    if (record) {
      return record
    }
  }
  return null
}

export async function loadFlashscoreRecord(league, gameId) {
  const manifest = await loadFlashscoreLeagueManifest(league)
  const record = await loadRecordFromManifest(flashscoreRoot, manifest, gameId)
  if (!record) {
    const error = new Error(`Could not find local flashscore record for ${league}/${gameId}`)
    error.statusCode = 404
    throw error
  }
  return record
}

export async function tryLoadFlashscoreRecord(league, gameId) {
  try {
    return await loadFlashscoreRecord(league, gameId)
  } catch {
    return null
  }
}

async function loadNowgoalRecordById(league, gameId) {
  const manifest = await loadNowgoalLeagueManifest(league)
  const record = await loadRecordFromManifest(nowgoalRoot, manifest, gameId)
  if (!record) {
    const error = new Error(`Could not find local compact record for ${league}/${gameId}`)
    error.statusCode = 404
    throw error
  }
  return record
}

export async function findNowgoalMatchIdForFlashscoreRecord(league, flashscoreRecord) {
  const manifest = await loadNowgoalLeagueManifest(league)
  if (!manifest?.dates) {
    return null
  }

  const targetDate = String(flashscoreRecord.match_start_date)
  const targetHome = normalizeTeamName(flashscoreRecord.team1)
  const targetAway = normalizeTeamName(flashscoreRecord.team2)
  let exactPairFallback = null
  let crossDateFallback = null
  let unorderedFallback = null

  for (const [matchDate, entry] of Object.entries(manifest.dates || {})) {
    for (const match of entry.matches || []) {
      const matchHome = normalizeTeamName(match.team1)
      const matchAway = normalizeTeamName(match.team2)
      const sameOrder = matchHome === targetHome && matchAway === targetAway
      const samePair = new Set([matchHome, matchAway]).size === new Set([targetHome, targetAway]).size &&
        [matchHome, matchAway].every((team) => [targetHome, targetAway].includes(team))

      if (matchDate === targetDate && sameOrder) {
        return String(match.game_id)
      }
      if (matchDate === targetDate && samePair && exactPairFallback === null) {
        exactPairFallback = String(match.game_id)
      }
      if (sameOrder && crossDateFallback === null) {
        crossDateFallback = String(match.game_id)
      }
      if (samePair && unorderedFallback === null) {
        unorderedFallback = String(match.game_id)
      }
    }
  }

  return exactPairFallback || crossDateFallback || unorderedFallback
}

export async function loadSelectedNowgoalRecord(league, gameId) {
  try {
    return {
      flashscoreRecord: null,
      nowgoalGameId: String(gameId),
      nowgoalRecord: await loadNowgoalRecordById(league, gameId),
    }
  } catch {
    const flashscoreRecord = await loadFlashscoreRecord(league, gameId)
    const nowgoalGameId = await findNowgoalMatchIdForFlashscoreRecord(league, flashscoreRecord)
    if (!nowgoalGameId) {
      const error = new Error('No matching Nowgoal record found for the selected Flashscore match')
      error.statusCode = 404
      throw error
    }
    return {
      flashscoreRecord,
      nowgoalGameId,
      nowgoalRecord: await loadNowgoalRecordById(league, nowgoalGameId),
    }
  }
}

export function getFlashscoreMatchUrl(gameId) {
  return `https://www.flashscore.co.uk/match/${gameId}`
}

export function getNowgoalMatchUrl(gameId) {
  return `https://live.nowgoal26.com/oddscomp/${gameId}`
}
