import { formatNumber } from './api'

const STAT_FIELDS = [
  ['expected_gls', 'Expected Goals'],
  ['xg_on_target', 'xG On Target'],
  ['expected_assists', 'Expected Assists'],
  ['ball_possession', 'Ball Possession'],
  ['goal_attempts', 'Total Shots'],
  ['shots_on_goal', 'Shots On Target'],
  ['shots_off_goal', 'Shots Off Target'],
  ['blocked_shots', 'Blocked Shots'],
  ['shots_inside_box', 'Shots Inside Box'],
  ['shots_outside_box', 'Shots Outside Box'],
  ['attacks', 'Attacks'],
  ['dangerous_attacks', 'Dangerous Attacks'],
  ['corner_kicks', 'Corners'],
  ['total_passes', 'Total Passes'],
  ['completed_passes', 'Completed Passes'],
  ['offsides', 'Offsides'],
  ['goalkeeper_saves', 'Goalkeeper Saves'],
  ['fouls', 'Fouls'],
  ['yellow_cards', 'Yellow Cards'],
  ['red_cards', 'Red Cards'],
  ['tackles', 'Tackles'],
  ['clearances_completed', 'Clearances Completed'],
  ['crosses_completed', 'Crosses Completed'],
  ['distance_covered_km', 'Distance Covered'],
]

const EVENT_TYPES = {
  0: 'General',
  1: 'First Yellow Card',
  2: 'Second Yellow Card',
  3: 'Red Card',
  4: 'Goal',
  5: 'Substitution',
  6: 'Whistle',
  7: 'Stoppage Time',
  8: 'Corner',
  9: 'Injury',
  10: 'Warning',
  11: 'VAR',
}

function statDisplay(value) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return typeof value === 'number' ? formatNumber(value, 2) : String(value)
}

function numericStat(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const number = Number(String(value).replace('%', '').replace(',', ''))
  return Number.isFinite(number) ? number : null
}

function StatBar({ home, away }) {
  const homeNumber = numericStat(home)
  const awayNumber = numericStat(away)
  if (homeNumber === null || awayNumber === null) {
    return <div className="stat-bar" />
  }
  const total = Math.abs(homeNumber) + Math.abs(awayNumber)
  const homeWidth = total <= 0 ? 50 : (Math.abs(homeNumber) / total) * 50
  const awayWidth = total <= 0 ? 50 : (Math.abs(awayNumber) / total) * 50
  const homeClass = homeNumber > awayNumber ? 'stat-bar-fill--good' : homeNumber < awayNumber ? 'stat-bar-fill--bad' : ''
  const awayClass = awayNumber > homeNumber ? 'stat-bar-fill--good' : awayNumber < homeNumber ? 'stat-bar-fill--bad' : ''
  return (
    <div className="stat-bar">
      <span className={`stat-bar-fill stat-bar-fill--home ${homeClass}`} style={{ width: `${homeWidth}%`, left: `${50 - homeWidth}%` }} />
      <span className={`stat-bar-fill stat-bar-fill--away ${awayClass}`} style={{ width: `${awayWidth}%` }} />
    </div>
  )
}

function CardMarks({ stats }) {
  const yellows = Number(stats?.yellow_cards || 0)
  const reds = Number(stats?.red_cards || 0)
  return (
    <span className="card-marks">
      {Array.from({ length: yellows }, (_, index) => (
        <span key={`y-${index}`} className="card-mark card-mark--yellow" />
      ))}
      {Array.from({ length: reds }, (_, index) => (
        <span key={`r-${index}`} className="card-mark card-mark--red" />
      ))}
    </span>
  )
}

export function StatsPanel({ record }) {
  if (!record) {
    return <div className="empty-state">No Flashscore match selected</div>
  }
  const homeStats = record.team1_stats || {}
  const awayStats = record.team2_stats || {}
  const rows = STAT_FIELDS.filter(([field]) => field in homeStats || field in awayStats)

  if (!rows.length) {
    return <div className="empty-state">No stats data</div>
  }

  return (
    <section className="stats-panel">
      <div className="stats-scoreboard">
        <div>
          <strong>{record.team1}</strong>
          <CardMarks stats={homeStats} />
        </div>
        <div className="score-pill">{record.team1_full_time_gls}-{record.team2_full_time_gls}</div>
        <div>
          <strong>{record.team2}</strong>
          <CardMarks stats={awayStats} />
        </div>
      </div>
      {rows.map(([field, label]) => (
        <div className="stat-row" key={field}>
          <div className="stat-value stat-value--home">{statDisplay(homeStats[field])}</div>
          <div className="stat-main">
            <div>{label}</div>
            <StatBar home={homeStats[field]} away={awayStats[field]} />
          </div>
          <div className="stat-value">{statDisplay(awayStats[field])}</div>
        </div>
      ))}
    </section>
  )
}

function generalPositionLabel(value) {
  if (value === 0 || value === '0') return 'GK'
  if (value === 1 || value === '1') return 'Def'
  if (value === 2 || value === '2') return 'Mid'
  if (value === 3 || value === '3') return 'Att'
  return ''
}

function playerPositions(personnel) {
  return personnel?.team_formation?.player_positions || []
}

function formationLines(personnel) {
  const positions = playerPositions(personnel)
  const formation = personnel?.team_formation?.formation_str || ''
  const counts = formation
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isInteger(part) && part > 0)

  if (counts.length) {
    const lines = []
    let start = 0
    for (const count of counts) {
      lines.push(positions.slice(start, start + count))
      start += count
    }
    if (start < positions.length) {
      lines.push(positions.slice(start))
    }
    return lines.filter((line) => line.length)
  }

  const grouped = { GK: [], Def: [], Mid: [], Att: [], Other: [] }
  for (const player of positions) {
    grouped[generalPositionLabel(player.general_position) || 'Other'].push(player)
  }
  return ['GK', 'Def', 'Mid', 'Att', 'Other'].map((key) => grouped[key]).filter((line) => line.length)
}

function xPositions(count) {
  const map = {
    1: [50],
    2: [42, 58],
    3: [24, 50, 76],
    4: [16, 39, 61, 84],
    5: [10, 30, 50, 70, 90],
  }
  return map[count] || Array.from({ length: count }, (_, index) => 8 + index * (84 / Math.max(count - 1, 1)))
}

function yPositions(totalLines, side) {
  const homeMap = {
    1: [8],
    2: [8, 43],
    3: [8, 20, 43],
    4: [8, 20, 31, 43],
    5: [8, 18, 27, 35, 43],
  }
  const values = homeMap[totalLines] || Array.from({ length: totalLines }, (_, index) => 8 + index * ((43 - 8) / Math.max(totalLines - 1, 1)))
  return side === 'away' ? values.map((value) => 100 - value) : values
}

function PitchPlayers({ personnel, side }) {
  const lines = formationLines(personnel)
  const yValues = yPositions(lines.length, side)
  return lines.flatMap((line, lineIndex) => {
    const xValues = xPositions(line.length)
    return line.map((player, playerIndex) => {
      const name = player.player_name || 'Unknown'
      return (
        <div
          className="pitch-player"
          key={`${side}-${lineIndex}-${playerIndex}-${name}`}
          style={{ left: `${xValues[playerIndex]}%`, top: `${yValues[lineIndex]}%` }}
          title={name}
        >
          <span>{generalPositionLabel(player.general_position) || 'XI'}</span>
          <small>{name}</small>
        </div>
      )
    })
  })
}

function formatFormation(personnel) {
  const parts = String(personnel?.team_formation?.formation_str || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts[0] === '1') {
    parts.shift()
  }
  return parts.join(',')
}

export function LineupsPanel({ record }) {
  if (!record?.team1_personnel && !record?.team2_personnel) {
    return <div className="empty-state">No lineup data</div>
  }
  return (
    <section className="lineups-panel">
      <div className="pitch-meta pitch-meta--home">
        <strong>{record.team1}</strong>
        <span>{formatFormation(record.team1_personnel)}</span>
      </div>
      <div className="pitch">
        <span className="pitch-halfway" />
        <span className="pitch-circle" />
        <span className="pitch-box pitch-box--home" />
        <span className="pitch-box pitch-box--away" />
        <PitchPlayers personnel={record.team1_personnel || {}} side="home" />
        <PitchPlayers personnel={record.team2_personnel || {}} side="away" />
      </div>
      <div className="pitch-meta pitch-meta--away">
        <strong>{record.team2}</strong>
        <span>{formatFormation(record.team2_personnel)}</span>
      </div>
    </section>
  )
}

function formatEventType(value) {
  if (value === null || value === undefined || value === '') {
    return 'Event'
  }
  if (Number.isInteger(value)) {
    return EVENT_TYPES[value] || `Type ${value}`
  }
  const text = String(value).split('.').pop()
  return EVENT_TYPES[Number(text)] || text.replaceAll('_', ' ')
}

export function CommentaryPanel({ record }) {
  const events = record?.match_commentary?.events || []
  if (!events.length) {
    return <div className="empty-state">No commentary data</div>
  }
  return (
    <section className="commentary-panel">
      {[...events].reverse().map((event, index) => (
        <article className="commentary-card" key={`${event.game_minute}-${index}`}>
          <header>
            <strong>{event.game_minute !== null && event.game_minute !== undefined ? `${event.game_minute}'` : '-'}</strong>
            <span>{[event.team, formatEventType(event.event_type)].filter(Boolean).join(' | ')}</span>
          </header>
          <p>{event.supplementary_info || event.main_info || 'No detail'}</p>
        </article>
      ))}
    </section>
  )
}

