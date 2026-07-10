import { useEffect, useMemo, useState } from 'react'
import { apiRequest, defaultSinceDate, formatNumber } from './api'
import { MarketChart } from './MarketChart'
import { CommentaryPanel, LineupsPanel, StatsPanel } from './FlashscorePanels'

const TABS = [
  ['inplay', 'Inplay'],
  ['stats', 'Stats'],
  ['commentary', 'Commentary'],
  ['downloads', 'Downloads'],
  ['sync', 'Data Sync'],
]

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function MatchSummary({ summary }) {
  if (!summary) {
    return <div className="sidebar-empty">No match selected</div>
  }
  return (
    <div className="match-summary">
      <div className="match-scoreline">
        <span>{summary.team1}</span>
        <a href={summary.flashscoreUrl || summary.nowgoalUrl || '#'} target="_blank" rel="noreferrer">
          {summary.score}
        </a>
        <span>{summary.team2}</span>
      </div>
      <div className="match-meta">
        <span>{summary.matchDate}</span>
        <span>{summary.halftimeScore}</span>
      </div>
      <div className="match-links">
        {summary.flashscoreUrl && (
          <a href={summary.flashscoreUrl} target="_blank" rel="noreferrer">
            Flashscore
          </a>
        )}
        {summary.nowgoalUrl && (
          <a href={summary.nowgoalUrl} target="_blank" rel="noreferrer">
            Nowgoal
          </a>
        )}
      </div>
    </div>
  )
}

function PasswordPanel({ csrfToken, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setStatus('')
    if (newPassword !== confirmPassword) {
      setStatus('New passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await apiRequest('/api/password', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setStatus('Password changed.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="password-panel" onSubmit={submit}>
        <header>
          <h2>Change Password</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close password panel">
            X
          </button>
        </header>
        <label>
          Current password
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        </label>
        <label>
          New password
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required />
        </label>
        <label>
          Confirm new password
          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
        </label>
        <button type="submit" disabled={busy}>
          Save password
        </button>
        {status && <div className="form-status">{status}</div>}
      </form>
    </div>
  )
}

export function InplayApp() {
  const [session, setSession] = useState(null)
  const [config, setConfig] = useState(null)
  const [leagues, setLeagues] = useState([])
  const [selectedLeague, setSelectedLeague] = useState('')
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState('')
  const [matchPayload, setMatchPayload] = useState(null)
  const [graphs, setGraphs] = useState(null)
  const [supValue, setSupValue] = useState('')
  const [glsValue, setGlsValue] = useState('')
  const [activeTab, setActiveTab] = useState('inplay')
  const [loading, setLoading] = useState(true)
  const [matchLoading, setMatchLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPasswordPanel, setShowPasswordPanel] = useState(false)

  const [syncSources, setSyncSources] = useState(['nowgoal'])
  const [syncLeagues, setSyncLeagues] = useState([])
  const [syncSinceDates, setSyncSinceDates] = useState({})
  const [syncStatus, setSyncStatus] = useState('Sync output will appear here.')
  const [syncBusy, setSyncBusy] = useState(false)
  const [individualIds, setIndividualIds] = useState('')
  const [individualStatus, setIndividualStatus] = useState('Downloaded games will be listed here.')

  const csrfToken = session?.csrfToken
  const flashscoreRecord = matchPayload?.flashscoreRecord
  const hasNowgoalRecord = Boolean(matchPayload?.nowgoalRecord)
  const commentaryEnabled = Boolean(flashscoreRecord?.match_commentary?.events?.length)
  const statsEnabled = Boolean(flashscoreRecord)

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const sessionPayload = await apiRequest('/api/session')
        if (!sessionPayload.authenticated) {
          window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`
          return
        }
        if (cancelled) return
        setSession(sessionPayload)
        const [configPayload, leaguesPayload] = await Promise.all([
          apiRequest('/api/inplay/config'),
          apiRequest('/api/inplay/leagues'),
        ])
        if (cancelled) return
        setConfig(configPayload)
        setLeagues(leaguesPayload.leagues || [])
        setSelectedLeague((leaguesPayload.leagues || [])[0]?.value || '')
      } catch (requestError) {
        if (requestError.status === 401) {
          window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`
          return
        }
        setError(requestError.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedLeague) {
      setMatches([])
      setSelectedMatch('')
      return
    }
    let cancelled = false
    async function loadMatches() {
      setError('')
      try {
        const payload = await apiRequest(`/api/inplay/matches?league=${encodeURIComponent(selectedLeague)}`)
        if (cancelled) return
        const nextMatches = payload.matches || []
        setMatches(nextMatches)
        setSelectedMatch((current) =>
          current && nextMatches.some((match) => match.value === current)
            ? current
            : nextMatches[nextMatches.length - 1]?.value || '',
        )
      } catch (requestError) {
        if (!cancelled) setError(requestError.message)
      }
    }
    loadMatches()
    return () => {
      cancelled = true
    }
  }, [selectedLeague])

  useEffect(() => {
    if (!selectedLeague || !selectedMatch) {
      setMatchPayload(null)
      setGraphs(null)
      return
    }
    let cancelled = false
    async function loadMatch() {
      setMatchLoading(true)
      setError('')
      try {
        const payload = await apiRequest(
          `/api/inplay/match?league=${encodeURIComponent(selectedLeague)}&matchId=${encodeURIComponent(selectedMatch)}`,
        )
        if (cancelled) return
        setMatchPayload(payload)
        setGraphs(payload.graphs)
        setSupValue(payload.initialValues?.sup ?? '')
        setGlsValue(payload.initialValues?.gls ?? '')
        setActiveTab((currentTab) =>
          (currentTab === 'stats' && !payload.flashscoreRecord) ||
          (currentTab === 'commentary' && !payload.flashscoreRecord?.match_commentary?.events?.length)
            ? 'inplay'
            : currentTab,
        )
      } catch (requestError) {
        if (!cancelled) {
          setMatchPayload(null)
          setGraphs(null)
          setError(requestError.message)
        }
      } finally {
        if (!cancelled) setMatchLoading(false)
      }
    }
    loadMatch()
    return () => {
      cancelled = true
    }
  }, [selectedLeague, selectedMatch])

  useEffect(() => {
    if (!selectedLeague || !selectedMatch || !hasNowgoalRecord) {
      return
    }
    const timer = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams({
          league: selectedLeague,
          matchId: selectedMatch,
          sup: supValue,
          gls: glsValue,
        })
        const payload = await apiRequest(`/api/inplay/graphs?${query.toString()}`)
        setGraphs(payload.graphs)
      } catch (requestError) {
        setError(requestError.message)
      }
    }, 160)
    return () => window.clearTimeout(timer)
  }, [supValue, glsValue, selectedLeague, selectedMatch, hasNowgoalRecord])

  async function logout() {
    await apiRequest('/api/logout', { method: 'POST', csrfToken })
    window.location.href = '/login'
  }

  function toggleSyncSource(source) {
    setSyncSources((current) => (current.includes(source) ? current.filter((item) => item !== source) : [...current, source]))
  }

  function addSyncGroup(group) {
    setSyncLeagues((current) => unique([...current, ...(config?.leagues?.[group] || [])]))
  }

  async function runSync() {
    setSyncBusy(true)
    setSyncStatus('Loading...')
    try {
      const payload = await apiRequest('/api/inplay/sync', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({
          sources: syncSources,
          leagues: syncLeagues,
          sinceDates: syncSinceDates,
        }),
      })
      setSyncStatus(payload.status || 'Sync complete.')
      const leaguesPayload = await apiRequest('/api/inplay/leagues')
      setLeagues(leaguesPayload.leagues || [])
      if (!selectedLeague && leaguesPayload.leagues?.length) {
        setSelectedLeague(leaguesPayload.leagues[0].value)
      }
    } catch (requestError) {
      setSyncStatus(requestError.message)
    } finally {
      setSyncBusy(false)
    }
  }

  async function runIndividualDownload() {
    setIndividualStatus('Loading...')
    try {
      const payload = await apiRequest('/api/inplay/individual-downloads', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({ gameIds: individualIds }),
      })
      setIndividualStatus(payload.status || 'Complete.')
      const leaguesPayload = await apiRequest('/api/inplay/leagues')
      setLeagues(leaguesPayload.leagues || [])
      if ((leaguesPayload.leagues || []).some((league) => league.value === 'individually_downloaded_games')) {
        setSelectedLeague('individually_downloaded_games')
      }
    } catch (requestError) {
      setIndividualStatus(requestError.message)
    }
  }

  const syncLeagueOptions = useMemo(() => config?.leagues?.all || [], [config])
  const selectedSyncLeagues = useMemo(() => syncLeagues.map((league) => [league, syncSinceDates[league] || config?.defaultSinceDate || defaultSinceDate()]), [syncLeagues, syncSinceDates, config])

  if (loading) {
    return <main className="inplay-shell"><div className="empty-state">Loading</div></main>
  }

  return (
    <main className="inplay-shell">
      <header className="inplay-header">
        <div>
          <h1>Inplay Tool</h1>
          <span>{session?.username}</span>
        </div>
        <nav>
          <button type="button" onClick={() => setShowPasswordPanel(true)}>Change password</button>
          <button type="button" onClick={logout}>Logout</button>
        </nav>
      </header>

      {error && <div className="app-alert">{error}</div>}

      <div className="inplay-workspace">
        <section className="inplay-main">
          <div className="tabs">
            {TABS.map(([value, label]) => {
              const disabled = (value === 'stats' && !statsEnabled) || (value === 'commentary' && !commentaryEnabled)
              return (
                <button
                  type="button"
                  key={value}
                  className={activeTab === value ? 'is-active' : ''}
                  disabled={disabled}
                  onClick={() => setActiveTab(value)}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {activeTab === 'inplay' && (
            <div className="chart-stack">
              {matchLoading && <div className="loading-overlay">Loading match graphs</div>}
              <MarketChart title={`${matchPayload?.summary?.team1 || 'Home'} v ${matchPayload?.summary?.team2 || 'Away'} SUP`} chart={graphs?.sup} goals={graphs?.goals} />
              <MarketChart title={`${matchPayload?.summary?.team1 || 'Home'} v ${matchPayload?.summary?.team2 || 'Away'} GLS`} chart={graphs?.gls} goals={graphs?.goals} />
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="flashscore-grid">
              <StatsPanel record={flashscoreRecord} />
              <LineupsPanel record={flashscoreRecord} />
            </div>
          )}

          {activeTab === 'commentary' && <CommentaryPanel record={flashscoreRecord} />}

          {activeTab === 'downloads' && (
            <section className="tool-panel downloads-panel">
              <h2>Individual Game Downloads</h2>
              <textarea
                value={individualIds}
                onChange={(event) => setIndividualIds(event.target.value)}
                placeholder={'2906721\n2906720'}
              />
              <button type="button" onClick={runIndividualDownload}>Sync Selected Games</button>
              <pre>{individualStatus}</pre>
            </section>
          )}

          {activeTab === 'sync' && (
            <section className="sync-layout">
              <aside className="sync-controls">
                <h2>Data Sync</h2>
                <div className="button-row">
                  <button type="button" onClick={() => addSyncGroup('jja')}>Add JJA</button>
                  <button type="button" onClick={() => addSyncGroup('ned')}>Add Ned</button>
                </div>
                <label>
                  Leagues
                  <select
                    multiple
                    size={14}
                    value={syncLeagues}
                    onChange={(event) => setSyncLeagues([...event.target.selectedOptions].map((option) => option.value))}
                  >
                    {syncLeagueOptions.map((league) => (
                      <option key={league} value={league}>{league}</option>
                    ))}
                  </select>
                </label>
                <div className="checkbox-row">
                  <label><input type="checkbox" checked={syncSources.includes('nowgoal')} onChange={() => toggleSyncSource('nowgoal')} /> Nowgoal</label>
                  <label><input type="checkbox" checked={syncSources.includes('flashscore')} onChange={() => toggleSyncSource('flashscore')} /> Flashscore</label>
                </div>
                <div className="config-readout">
                  <strong>GCS Bucket</strong>
                  <span>{config?.cache?.nowgoalBucket || config?.cache?.flashscoreBucket || 'Not set'}</span>
                  <strong>Nowgoal Prefix</strong>
                  <span>{config?.cache?.nowgoalPrefix || '(bucket root)'}</span>
                  <strong>Flashscore Prefix</strong>
                  <span>{config?.cache?.flashscorePrefix || '(bucket root)'}</span>
                </div>
                <button type="button" onClick={runSync} disabled={syncBusy}>
                  {syncBusy ? 'Syncing Selected Leagues...' : 'Sync Selected Leagues'}
                </button>
              </aside>
              <div className="sync-output">
                <h2>Selected League Sync Windows</h2>
                <div className="sync-date-list">
                  {selectedSyncLeagues.length === 0 && <div className="sidebar-empty">No leagues selected</div>}
                  {selectedSyncLeagues.map(([league, since]) => (
                    <label key={league}>
                      <span>{league}</span>
                      <input
                        type="date"
                        value={since}
                        onChange={(event) => setSyncSinceDates((current) => ({ ...current, [league]: event.target.value }))}
                      />
                    </label>
                  ))}
                </div>
                <h2>Sync Output</h2>
                <pre>{syncStatus}</pre>
              </div>
            </section>
          )}
        </section>

        <aside className="match-sidebar">
          <label>
            League Selection
            <select value={selectedLeague} onChange={(event) => setSelectedLeague(event.target.value)}>
              {leagues.map((league) => (
                <option key={league.value} value={league.value}>{league.label}</option>
              ))}
            </select>
          </label>
          <MatchSummary summary={matchPayload?.summary} />
          <div className="price-inputs">
            <label>
              <span>SUP</span>
              <input type="number" step="0.01" value={supValue} onChange={(event) => setSupValue(event.target.value)} />
              <small>Start: {formatNumber(matchPayload?.initialValues?.sup)}</small>
            </label>
            <label>
              <span>GLS</span>
              <input type="number" step="0.01" value={glsValue} onChange={(event) => setGlsValue(event.target.value)} />
              <small>Start: {formatNumber(matchPayload?.initialValues?.gls)}</small>
            </label>
          </div>
          <label className="match-list-label">Match Selection</label>
          <div className="match-list">
            {matches.length === 0 && <div className="sidebar-empty">No matches available</div>}
            {matches.map((match) => (
              <button
                type="button"
                className={selectedMatch === match.value ? 'is-selected' : ''}
                key={`${match.match_date}-${match.value}-${match.team1}`}
                onClick={() => setSelectedMatch(match.value)}
              >
                <span>{match.match_date}</span>
                <strong>{match.team1}</strong>
                <em>v</em>
                <strong>{match.team2}</strong>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {showPasswordPanel && <PasswordPanel csrfToken={csrfToken} onClose={() => setShowPasswordPanel(false)} />}
    </main>
  )
}
