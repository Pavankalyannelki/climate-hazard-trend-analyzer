
'use client'

import useSWR from 'swr'
import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  CloudSun,
  Copy,
  Download,
  Gauge,
  Layers3,
  MapPin,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Thermometer,
  TrendingUp,
  Wind,
  X,
} from 'lucide-react'

type View =
  | 'Overview'
  | 'Saved analyses'
  | 'Data sources'
  | 'Methodology'
  | 'Settings'

type Modal =
  | 'analysis'
  | 'export'
  | 'methodology'
  | 'settings'
  | 'actions'
  | null

type AnnualResult = {
  year: number
  events: number
  days: number
  mean: number | null
}

type DataQuality = {
  requestedDays: number
  observedDays: number
  missingDays: number
  completeness: number
  source: string
}

type ClimateData = {
  annual: AnnualResult[]
  threshold: number
  source: string
  quality: DataQuality
  location: {
    city: string
    state: string
    country: string
    latitude: number
    longitude: number
  }
  parameters?: {
    location: string
    startYear: number
    endYear: number
  }
   trend?: {
    metric: string;
    slopePerYear: number;
    direction: "increasing" | "decreasing" | "stable";
  };
}

type AnalysisRecord = {
  id: number
  name: string
  location: string
  startYear: number
  endYear: number
  hazard: string
  status: string
  payload: ClimateData | null
  createdAt: string
  updatedAt: string
}

type AnalysisResponse = AnalysisRecord & {
  climate: ClimateData
}

const fetcher = async (url: string): Promise<AnalysisRecord[]> => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Unable to load saved analyses')
  }

  return response.json()
}

function MetricCard({
  label,
  value,
  unit,
  detail,
  icon: Icon,
  trend,
}: {
  label: string
  value: string | number
  unit?: string
  detail: string
  icon: typeof Thermometer
  trend?: 'up' | 'down'
}) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className="metric-icon">
          <Icon />
        </span>
      </div>

      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>

      <div className="metric-detail">
        {trend === 'up' && <ArrowUpRight className="trend-up" />}
        {trend === 'down' && <ArrowDownRight className="trend-down" />}
        {detail}
      </div>
    </article>
  )
}

function BarChart({
  mode,
  data,
}: {
  mode: 'events' | 'days'
  data: AnnualResult[]
}) {
  const maxValue = Math.max(
    1,
    ...data.map((item) => mode === 'events' ? item.events : item.days),
  )

  return (
    <div
      className="bar-chart"
      aria-label={
        mode === 'events'
          ? 'Annual heatwave event frequency'
          : 'Annual heatwave days'
      }
    >
      <div className="chart-y-labels">
        <span>{maxValue}</span>
        <span>{Math.round(maxValue * 0.66)}</span>
        <span>{Math.round(maxValue * 0.33)}</span>
        <span>0</span>
      </div>

      <div className="bars">
        {data.map((item) => {
          const value = mode === 'events' ? item.events : item.days

          return (
            <div className="bar-column" key={item.year}>
              <div className="bar-track">
                <div
                  className={`bar ${mode === 'days' ? 'bar-amber' : ''}`}
                  style={{
                    height: `${(value / maxValue) * 100}%`,
                  }}
                >
                  <span className="bar-tooltip">{value}</span>
                </div>
              </div>
              <span>{String(item.year).slice(2)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TrendChart({ data }: { data: AnnualResult[] }) {
  const validData = data.filter(
    (item): item is AnnualResult & { mean: number } =>
      item.mean !== null && Number.isFinite(item.mean),
  )

  if (validData.length === 0) {
    return <p>No annual temperature data is available.</p>
  }

  const values = validData.map((item) => item.mean)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const padding = Math.max((max - min) * 0.2, 1)
  const lower = min - padding
  const upper = max + padding
  const spread = upper - lower

  const points = validData.map((item, index) => {
    const x = validData.length === 1
      ? 50
      : 2 + (index / (validData.length - 1)) * 96

    const y = 90 - ((item.mean - lower) / spread) * 75

    return { ...item, x, y }
  })

  const polyline = points
    .map((point) => `${point.x},${point.y}`)
    .join(' ')

  const first = points[0]
  const last = points[points.length - 1]

  return (
    <div className="trend-chart">
      <div className="chart-y-labels">
        <span>{upper.toFixed(1)}°C</span>
        <span>{((upper + lower) / 2).toFixed(1)}°C</span>
        <span>{lower.toFixed(1)}°C</span>
      </div>

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label="Annual mean temperature trend"
      >
        {first && last && (
          <path
            d={`M ${first.x} ${first.y} L ${last.x} ${last.y}`}
            className="trend-line"
          />
        )}

        <polyline points={polyline} className="temperature-line" />

        {points.map((point) => (
          <circle
            key={point.year}
            cx={point.x}
            cy={point.y}
            r="1.4"
            className="temperature-dot"
          />
        ))}
      </svg>

      <div className="trend-x-labels">
        {points.map((point) => (
          <span key={point.year}>{point.year}</span>
        ))}
      </div>
    </div>
  )
}

function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <article className="panel chart-panel">
      <div className="panel-header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      {children}

      <div className="chart-footnote">
        <span className="legend-dot blue" />
        Annual observations
      </div>
    </article>
  )
}

function PageHeader({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <>
      <section className="page-header">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-mark" />
            CLIMATE ANALYTICS WORKSPACE
          </div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action}
      </section>
      {children}
    </>
  )
}

export default function Page() {
  const [view, setView] = useState<View>('Overview')
  const [modal, setModal] = useState<Modal>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisRecord | null>(null)

  const [city, setCity] = useState('Bengaluru')
  const [startYear, setStartYear] = useState('2020')
  const [endYear, setEndYear] = useState('2024')
  const [analyzing, setAnalyzing] = useState(false)
  const [toast, setToast] = useState('')

  const [currentAnalysis, setCurrentAnalysis] =
    useState<AnalysisResponse | null>(null)

  const {
    data: savedAnalyses = [],
    error: savedError,
    mutate,
  } = useSWR<AnalysisRecord[]>('/api/analyses', fetcher)

  const activeClimate =
    currentAnalysis?.climate ??
    (selectedAnalysis?.payload
      ? selectedAnalysis.payload
      : null)

  const annualData = activeClimate?.annual ?? []

  const location = activeClimate
    ? [
      activeClimate.location.city,
      activeClimate.location.state,
      activeClimate.location.country,
    ].filter(Boolean).join(', ')
    : ''

  const range = useMemo(
    () => `${startYear}–${endYear}`,
    [startYear, endYear],
  )

  const savedItems = savedAnalyses.map((item) => ({
    ...item,
    range: `${item.startYear}–${item.endYear}`,
    updated: item.updatedAt
      ? new Date(item.updatedAt).toLocaleString()
      : 'Just now',
  }))

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3000)
  }

  const navigate = (next: View) => {
    setView(next)
    setMenuOpen(false)
  }

  const analyze = async () => {
    if (!city.trim()) {
      showToast('Enter a location first')
      return
    }

    const start = Number(startYear)
    const end = Number(endYear)

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1940 ||
      start >= end ||
      end > new Date().getFullYear()
    ) {
      showToast('Select a valid historical year range')
      return
    }

    setAnalyzing(true)
    setView('Overview')
    setCurrentAnalysis(null)

    try {
      const response = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${city.trim()} heatwave review`,
          location: city.trim(),
          startYear: start,
          endYear: end,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? 'Analysis could not be loaded')
      }

      setCurrentAnalysis(result as AnalysisResponse)
      await mutate()

      showToast('Live analysis saved successfully')
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Unable to run analysis',
      )
    } finally {
      setAnalyzing(false)
    }
  }

  const openSavedAnalysis = (item: AnalysisRecord) => {
    setSelectedAnalysis(item)
    setCurrentAnalysis(null)
    setCity(item.payload?.parameters?.location ?? item.location)
    setStartYear(String(item.startYear))
    setEndYear(String(item.endYear))
    setView('Overview')
  }

  const duplicateAnalysis = async (id: number) => {
    try {
      const response = await fetch('/api/analyses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? 'Could not duplicate analysis')
      }

      await mutate()
      showToast('Duplicate created in your workspace')
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Duplicate failed',
      )
    }
  }

  const exportCsv = () => {
    if (!activeClimate || activeClimate.annual.length === 0) {
      showToast('Run or open an analysis before exporting')
      return
    }

    const header = 'Year,Heatwave Events,Threshold Exceedance Days,Mean Maximum Temperature (C)'
    const lines = activeClimate.annual.map((row) =>
      [
        row.year,
        row.events,
        row.days,
        row.mean ?? '',
      ].join(','),
    )

    const csv = [header, ...lines].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = 'climatelens-annual-analysis.csv'
    link.click()

    URL.revokeObjectURL(url)
    setModal(null)
    showToast('CSV report exported')
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><CloudSun /></span>
          <span>Climate<span className="brand-accent">Lens</span></span>
          <button
            className="mobile-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>

        <nav className="side-nav" aria-label="Primary navigation">
          <p className="nav-caption">Workspace</p>

          {([
            ['Overview', <Activity key="overview" />],
            ['Saved analyses', <Layers3 key="saved" />],
            ['Data sources', <Wind key="sources" />],
          ] as [View, React.ReactNode][]).map(([item, icon]) => (
            <button
              key={item}
              className={`nav-item ${view === item ? 'active' : ''}`}
              onClick={() => navigate(item)}
            >
              <span>{icon}</span>
              {item}
              {item === 'Overview' && <span className="nav-dot" />}
            </button>
          ))}

          <p className="nav-caption nav-caption-spaced">Resources</p>

          <button
            className={`nav-item ${view === 'Methodology' ? 'active' : ''}`}
            onClick={() => navigate('Methodology')}
          >
            <span><CircleHelp /></span>Methodology
          </button>

          <button
            className={`nav-item ${view === 'Settings' ? 'active' : ''}`}
            onClick={() => navigate('Settings')}
          >
            <span><Settings2 /></span>Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="data-status">
            <span className="status-pulse" />
            <div>
              <strong>Data pipeline online</strong>
              <small>Open-Meteo archive</small>
            </div>
          </div>
          <div className="user-row">
            <span className="avatar">CL</span>
            <div>
              <strong>Researcher</strong>
              <small>Climate workspace</small>
            </div>
            <ChevronDown />
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>

          <div className="breadcrumbs">
            <span>Workspace</span>
            <span>/</span>
            <strong>{view}</strong>
          </div>

          <div className="top-actions">
            <span className="live-indicator"><span />Live data</span>
            <button
              className="icon-button"
              onClick={async () => {
                await mutate()
                if (currentAnalysis) await analyze()
              }}
              aria-label="Refresh data"
            >
              <RefreshCw />
            </button>
            <button
              className="outline-button"
              onClick={() => setModal('export')}
            >
              <Download /> Export report
            </button>
          </div>
        </header>

        {view === 'Overview' && (
          <Overview
            city={city}
            setCity={setCity}
            startYear={startYear}
            setStartYear={setStartYear}
            endYear={endYear}
            setEndYear={setEndYear}
            range={range}
            analyzing={analyzing}
            analyze={analyze}
            climate={activeClimate}
            annualData={annualData}
            location={location}
            savedError={savedError}
            onMore={() => navigate('Saved analyses')}
          />
        )}

        {view === 'Saved analyses' && (
          <PageHeader
            title="Saved analyses"
            description="Open and reuse historical climate studies stored in your database."
            action={
              <button
                className="primary-button"
                onClick={() => setModal('analysis')}
              >
                <Plus /> New analysis
              </button>
            }
          >
            {savedError && (
              <p role="alert">Unable to load saved analyses. Refresh the page to retry.</p>
            )}

            <section className="saved-grid">
              {savedItems.map((item) => (
                <article className="panel saved-card" key={item.id}>
                  <div className="saved-card-top">
                    <span className="saved-icon"><Activity /></span>
                    <button
                      className="more-button"
                      aria-label={`Actions for ${item.name}`}
                      onClick={() => {
                        setSelectedAnalysis(item)
                        setModal('actions')
                      }}
                    >
                      •••
                    </button>
                  </div>

                  <h3>{item.name}</h3>
                  <p>{item.location} · {item.range}</p>

                  <div className="saved-meta">
                    <span>{item.updated}</span>
                    <button
                      className="text-button"
                      onClick={() => openSavedAnalysis(item)}
                    >
                      Open <ArrowUpRight />
                    </button>
                  </div>

                  <button
                    className="duplicate-button"
                    onClick={() => duplicateAnalysis(item.id)}
                  >
                    <Copy /> Duplicate analysis
                  </button>
                </article>
              ))}

              {savedItems.length === 0 && !savedError && (
                <p>No saved analyses yet. Run an analysis to get started.</p>
              )}
            </section>
          </PageHeader>
        )}

        {view === 'Data sources' && (
          <PageHeader
            title="Data sources"
            description="Review the provenance and health of the datasets used in your analyses."
          >
            <section className="source-list panel">
              <div className="source-row">
                <span className="source-logo"><CloudSun /></span>
                <div>
                  <h3>Open-Meteo Historical Weather API</h3>
                  <p>Daily maximum temperature · ERA5 reanalysis · Celsius</p>
                </div>
                <span className="source-status"><Check /> Connected</span>
                <button
                  className="outline-button"
                  onClick={() => showToast('Source metadata is available in analysis results')}
                >
                  Verify
                </button>
              </div>

              <div className="source-row">
                <span className="source-logo blue-logo"><Gauge /></span>
                <div>
                  <h3>ClimateLens calculation engine</h3>
                  <p>95th-percentile threshold · minimum event duration: 3 days</p>
                </div>
                <span className="source-status"><Check /> Ready</span>
                <button
                  className="outline-button"
                  onClick={() => setModal('methodology')}
                >
                  Details
                </button>
              </div>
            </section>
          </PageHeader>
        )}

        {view === 'Methodology' && (
          <PageHeader
            title="Methodology"
            description="Definitions and assumptions used for climate indicators."
          >
            <section className="method-grid">
              <article className="panel method-card">
                <span className="step-number">01</span>
                <h3>Reference threshold</h3>
                <p>
                  The current backend calculates the 95th percentile from valid
                  daily maximum temperatures across the selected period.
                  This is a period-specific threshold, not yet a separate
                  fixed climatological baseline.
                </p>
              </article>

              <article className="panel method-card">
                <span className="step-number">02</span>
                <h3>Event detection</h3>
                <p>
                  A heatwave requires at least three consecutive days at or
                  above the calculated threshold. The backend currently
                  summarizes threshold-exceedance days and event counts;
                  these metrics need further validation.
                </p>
              </article>

              <article className="panel method-card">
                <span className="step-number">03</span>
                <h3>Trend interpretation</h3>
                <p>
                  Annual summaries describe the returned observations.
                  A trend in these values alone does not establish causation.
                </p>
              </article>
            </section>
          </PageHeader>
        )}

        {view === 'Settings' && (
          <PageHeader
            title="Workspace settings"
            description="Configure your analysis defaults."
          >
            <section className="settings-grid">
              <article className="panel settings-card">
                <h3>Analysis defaults</h3>
                <label>
                  <span>Default hazard</span>
                  <select defaultValue="Heatwave">
                    <option>Heatwave</option>
                  </select>
                </label>
                <label>
                  <span>Minimum event duration</span>
                  <select defaultValue="3">
                    <option value="3">3 days</option>
                    <option value="4">4 days</option>
                    <option value="5">5 days</option>
                  </select>
                </label>
                <label className="switch-row">
                  <span>Show quality warnings</span>
                  <input type="checkbox" defaultChecked />
                </label>
                <button
                  className="primary-button"
                  onClick={() => showToast('Settings saved for this session')}
                >
                  Save settings
                </button>
              </article>
            </section>
          </PageHeader>
        )}

        <footer className="footer">
          <span>ClimateLens · Climate hazard analyzer</span>
          <span>
            <button onClick={() => setView('Methodology')}>Methodology</button>
          </span>
        </footer>
      </div>

      {modal && (
        <Dialog
          type={modal}
          onClose={() => setModal(null)}
          onAnalyze={analyze}
          onExport={exportCsv}
          selectedAnalysis={selectedAnalysis}
          onDuplicate={() => {
            if (selectedAnalysis) {
              void duplicateAnalysis(selectedAnalysis.id)
            }
            setModal(null)
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <Check /> {toast}
        </div>
      )}
    </main>
  )
}

function Overview({
  city,
  setCity,
  startYear,
  setStartYear,
  endYear,
  setEndYear,
  range,
  analyzing,
  analyze,
  climate,
  annualData,
  location,
  savedError,
  onMore,
}: {
  city: string
  setCity: (value: string) => void
  startYear: string
  setStartYear: (value: string) => void
  endYear: string
  setEndYear: (value: string) => void
  range: string
  analyzing: boolean
  analyze: () => void
  climate: ClimateData | null
  annualData: AnnualResult[]
  location: string
  savedError?: Error
  onMore: () => void
}) {
  const totalEvents = annualData.reduce((sum, row) => sum + row.events, 0)
  const totalDays = annualData.reduce((sum, row) => sum + row.days, 0)
  const validMeans = annualData
    .map((row) => row.mean)
    .filter((value): value is number => value !== null && Number.isFinite(value))

  const meanTemperature = validMeans.length
    ? validMeans.reduce((sum, value) => sum + value, 0) / validMeans.length
    : null

  const meanDuration = totalEvents > 0
    ? (totalDays / totalEvents).toFixed(1)
    : '—'

  const quality = climate?.quality
  const completeness = quality
    ? Math.max(0, Math.min(100, quality.completeness * 100))
    : null

  return (
    <>
      <section className="page-header">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-mark" />
            CLIMATE HAZARD ANALYZER
          </div>
          <h1>Heatwave trends</h1>
          <p>Understand how extreme heat is changing across your selected region.</p>
        </div>

        <div className="last-updated">
          <span>Analysis status</span>
          <strong>{climate ? 'Analysis loaded' : 'Awaiting analysis'}</strong>
          <span className="verified">
            <ShieldCheck />
            {climate ? 'Results from API' : 'Run an analysis to begin'}
          </span>
        </div>
      </section>

      <section className="control-panel">
        <div className="control-heading">
          <div>
            <h2>Analysis parameters</h2>
            <p>Configure a location and time period to explore.</p>
          </div>
          <span className="point-badge"><MapPin /> Point analysis</span>
        </div>

        <div className="controls">
          <label className="control-field location-field">
            <span>Location</span>
            <div className="input-wrap">
              <Search />
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                aria-label="City, state, or country"
                placeholder="e.g. Bengaluru, Karnataka, India"
              />
            </div>
          </label>

          <label className="control-field">
            <span>Start year</span>
            <select
              value={startYear}
              onChange={(event) => setStartYear(event.target.value)}
            >
              {Array.from(
                { length: new Date().getFullYear() - 1939 },
                (_, index) => 1940 + index,
              ).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>

          <span className="range-separator">to</span>

          <label className="control-field">
            <span>End year</span>
            <select
              value={endYear}
              onChange={(event) => setEndYear(event.target.value)}
            >
              {Array.from(
                { length: new Date().getFullYear() - 1939 },
                (_, index) => 1940 + index,
              ).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>

          <label className="control-field hazard-field">
            <span>Hazard type</span>
            <div className="select-static">
              <Thermometer /> Heatwave <ChevronDown />
            </div>
          </label>

          <button
            className="analyze-button"
            onClick={analyze}
            disabled={analyzing}
          >
            {analyzing
              ? <RefreshCw className="spin" />
              : <Activity />}
            {analyzing ? 'Analyzing…' : 'Run analysis'}
          </button>
        </div>

        <div className="resolved-location">
          <span className="location-check"><ShieldCheck /></span>
          <span>
            {climate ? (
              <>
                <strong>Resolved location</strong>{' '}
                {climate.location.latitude.toFixed(4)}° N,{' '}
                {climate.location.longitude.toFixed(4)}° E · {location}
              </>
            ) : (
              <span>Run an analysis to resolve the selected location.</span>
            )}
          </span>
          <span className="data-window">
            {climate
              ? `${climate.quality.observedDays.toLocaleString()} observations`
              : range}
          </span>
        </div>
      </section>

      {savedError && (
        <p role="alert">
          Saved analyses could not be loaded. You can still run a new analysis.
        </p>
      )}

      {!climate && !analyzing && (
        <section className="panel method-card">
          <h3>Ready to analyze</h3>
          <p>
            Choose a location and historical period, then select Run analysis
            to retrieve weather data and calculate annual summaries.
          </p>
        </section>
      )}

      {analyzing && (
        <section className="panel method-card">
          <RefreshCw className="spin" />
          <h3>Loading historical weather data</h3>
          <p>This may take a little while for longer historical periods.</p>
        </section>
      )}

      {climate && (
        <>
          <div className="section-heading">
            <div>
              <h2>Regional overview</h2>
              <p>Indicators calculated from daily maximum temperature observations.</p>
            </div>
            <button className="date-button">
              <CalendarDays /> {climate.annual[0]?.year ?? startYear}
              {' – '}
              {climate.annual[climate.annual.length - 1]?.year ?? endYear}
              <ChevronDown />
            </button>
          </div>

          <section className="metrics-grid">
            <MetricCard
              label="95th percentile threshold"
              value={climate.threshold.toFixed(1)}
              unit="°C"
              detail="Calculated for selected period"
              icon={Gauge}
            />
            <MetricCard
              label="Heatwave events"
              value={totalEvents}
              detail="Annual event counts"
              icon={Activity}
            />
            <MetricCard
              label="Threshold-exceedance days"
              value={totalDays}
              detail="Days counted by current backend"
              icon={CalendarDays}
            />
            <MetricCard
              label="Mean annual temperature"
              value={meanTemperature === null ? '—' : meanTemperature.toFixed(1)}
              unit={meanTemperature === null ? '' : '°C'}
              detail="Average of annual mean maximum temperatures"
              icon={TrendingUp}
            />
            
  <MetricCard
    label="Annual heatwave event trend"
    value={
      climate.trend
        ? `${climate.trend.slopePerYear > 0 ? "+" : ""}${climate.trend.slopePerYear.toFixed(2)}`
        : "—"
    }
    unit={climate.trend ? " events/year" : ""}
    detail={
      climate.trend
        ? `Trend: ${climate.trend.direction}`
        : "Run a new analysis to calculate the trend"
    }
    icon={TrendingUp}
    trend={
      climate.trend?.direction === "increasing"
        ? "up"
        : climate.trend?.direction === "decreasing"
          ? "down"
          : undefined
    }
  />

          </section>

          <section className="charts-grid">
            <ChartPanel
              title="Event frequency"
              subtitle="Annual heatwave event counts"
            >
              <BarChart mode="events" data={annualData} />
            </ChartPanel>

            <ChartPanel
              title="Threshold-exceedance days"
              subtitle="Annual qualifying heatwave days"
            >
              <BarChart mode="days" data={annualData} />
            </ChartPanel>

            <ChartPanel
              title="Temperature trend"
              subtitle="Annual mean maximum temperature"
            >
              <TrendChart data={annualData} />
            </ChartPanel>
          </section>

          <section className="bottom-grid">
            <article className="panel events-panel">
              <div className="panel-header">
                <div>
                  <h3>Annual climate summary</h3>
                  <p>Year-by-year results for {location}</p>
                </div>
                <button className="text-button" onClick={onMore}>
                  Saved analyses <ArrowUpRight />
                </button>
              </div>

              <div className="event-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Events</th>
                      <th>Days</th>
                      <th>Mean max temp.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {annualData.map((row) => (
                      <tr key={row.year}>
                        <td>{row.year}</td>
                        <td>{row.events}</td>
                        <td>{row.days}</td>
                        <td>
                          <strong>
                            {row.mean === null ? '—' : `${row.mean.toFixed(1)}°C`}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="panel quality-panel">
              <div className="panel-header">
                <div>
                  <h3>Data quality</h3>
                  <p>Coverage of the requested period</p>
                </div>
                <ShieldCheck className="quality-icon" />
              </div>

              <div className="coverage-score">
                <strong>
                  {completeness === null ? '—' : completeness.toFixed(1)}
                  <span>{completeness === null ? '' : '%'}</span>
                </strong>
                <div>
                  <span>Coverage</span>
                  <small>
                    {completeness === null
                      ? 'Not available'
                      : completeness >= 99
                        ? 'High coverage'
                        : 'Review missing dates'}
                  </small>
                </div>
              </div>

              <div className="progress">
                <span style={{ width: `${completeness ?? 0}%` }} />
              </div>

              <dl className="quality-list">
                <div>
                  <dt>Expected observations</dt>
                  <dd>{quality?.requestedDays.toLocaleString() ?? '—'}</dd>
                </div>
                <div>
                  <dt>Available observations</dt>
                  <dd>{quality?.observedDays.toLocaleString() ?? '—'}</dd>
                </div>
                <div>
                  <dt>Missing dates</dt>
                  <dd className={quality?.missingDays ? 'warning-text' : ''}>
                    {quality?.missingDays.toLocaleString() ?? '—'}
                    {Boolean(quality?.missingDays) && <AlertTriangle />}
                  </dd>
                </div>
                <div>
                  <dt>Data source</dt>
                  <dd>Open-Meteo <span className="source-dot" /></dd>
                </div>
              </dl>

              <p className="quality-note">
                {climate.source}. Completeness reflects available observations;
                it does not independently validate the accuracy of the source.
              </p>
            </article>
          </section>
        </>
      )}
    </>
  )
}

function Dialog({
  type,
  onClose,
  onAnalyze,
  onExport,
  selectedAnalysis,
  onDuplicate,
}: {
  type: Exclude<Modal, null>
  onClose: () => void
  onAnalyze: () => void
  onExport: () => void
  selectedAnalysis: AnalysisRecord | null
  onDuplicate: () => void
}) {
  const titles = {
    analysis: 'Create analysis',
    export: 'Export report',
    methodology: 'Analysis methodology',
    settings: 'Workspace settings',
    actions: 'Analysis actions',
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <button
          className="dialog-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X />
        </button>

        <h2 id="dialog-title">{titles[type]}</h2>

        {type === 'analysis' && (
          <>
            <p>
              Run a new heatwave analysis using the current location and year
              selection.
            </p>
            <button
              className="primary-button dialog-action"
              onClick={() => {
                onClose()
                onAnalyze()
              }}
            >
              Run analysis <ArrowUpRight />
            </button>
          </>
        )}

        {type === 'export' && (
          <>
            <p>
              Export the annual statistics from the currently displayed analysis.
            </p>
            <div className="export-options">
              <button onClick={onExport}>
                <Download /> CSV data
              </button>
            </div>
          </>
        )}

        {type === 'methodology' && (
          <>
            <p>
              A heatwave is definedf as at least three consecutive calendar days with daily maximum temperature strictly above the 95th-percentile threshold calculated for the selected analysis period. Missing calendar days break a consecutive-day run.
            </p>
            <button className="primary-button dialog-action" onClick={onClose}>
              Got it <Check />
            </button>
          </>
        )}

        {type === 'actions' && (
          <>
            <p>
              Manage <strong>{selectedAnalysis?.name ?? 'this analysis'}</strong>.
            </p>
            <div className="export-options">
              <button
                onClick={() => {
                  if (selectedAnalysis) {
                    onClose()
                    onAnalyze()
                  }
                }}
              >
                <RefreshCw /> Re-run analysis
              </button>
              <button onClick={onDuplicate}>
                <Copy /> Duplicate analysis
              </button>
            </div>
          </>
        )}

        {type === 'settings' && (
          <p>Workspace settings are not persisted yet.</p>
        )}
      </section>
    </div>
  )
}
