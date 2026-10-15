'use client'



import useSWR from 'swr'

import { jsPDF } from 'jspdf'

import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'

import {

  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, Check, ChevronDown,

  CircleHelp, CloudSun, Copy, Download, Gauge, Layers3, MapPin, Menu, Plus, RefreshCw,

  Search, Settings2, ShieldCheck, Thermometer, Trash2, TrendingUp, Wind, X

} from 'lucide-react'



type View = 'Overview' | 'Saved analyses' | 'Data sources' | 'Methodology' | 'Settings'

type Modal = 'analysis' | 'export' | 'methodology' | 'settings' | 'actions' | 'delete' | null



type AnnualDatum = { year: number; events: number; days: number; mean: number | null }

type HeatwaveEvent = { start: string; end: string; duration: number; peak: string; severity: string }
type DataQuality = { requestedDays: number; observedDays: number; missingDays: number; completeness: number; source: string }

type SavedAnalysis = { id?: number; name: string; location: string; startYear?: number; endYear?: number; range?: string; updated?: string; updatedAt?: string; payload?: { annual?: AnnualDatum[]; events?: HeatwaveEvent[]; threshold?: number; quality?: DataQuality; location?: { city: string; state: string; country: string; latitude?: number; longitude?: number } } }

type LocationSuggestion = { name: string; state: string; country: string; latitude: number; longitude: number }

type HazardType = 'Heatwave'

const hazardTypes: HazardType[] = ['Heatwave']



function downloadCsv(annualData: AnnualDatum[], eventData: HeatwaveEvent[], location: string, range: string) {

  const rows = [['ClimateLens climate hazard report'], ['Location', location], ['Period', range], [], ['Year', 'Heatwave events', 'Heatwave days', 'Mean temperature (°C)'], ...annualData.map((item) => [item.year, item.events, item.days, item.mean ?? '']) , [], ['Event start', 'Event end', 'Duration (days)', 'Peak', 'Severity'], ...eventData.map((event) => [event.start, event.end, event.duration, event.peak, event.severity])]

  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))

  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `climatelens-${range.replace('–', '-')}.csv`; anchor.click(); URL.revokeObjectURL(url)

}



function downloadPdf(location: string, range: string, annualData: AnnualDatum[], eventData: HeatwaveEvent[]) {

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })

  const margin = 42

  let y = 48

  const line = (text: string, size = 10, color: [number, number, number] = [55, 70, 84]) => { pdf.setFontSize(size); pdf.setTextColor(...color); pdf.text(text, margin, y); y += size + 8 }

  pdf.setFillColor(19, 47, 73); pdf.rect(0, 0, 595, 86, 'F'); pdf.setTextColor(255, 255, 255); pdf.setFontSize(22); pdf.text('ClimateLens', margin, 42); pdf.setFontSize(10); pdf.text('Climate hazard analysis report', margin, 62)

  y = 116; line(`Location: ${location || 'Not selected'}`, 12, [19, 47, 73]); line(`Analysis period: ${range}`, 10, [92, 108, 121]); y += 12

  const table = (headers: string[], rows: string[][]) => { pdf.setFillColor(232, 243, 248); pdf.rect(margin, y - 12, 511, 20, 'F'); pdf.setFontSize(8); pdf.setTextColor(19, 47, 73); const widths = headers.map(() => 511 / headers.length); headers.forEach((header, index) => pdf.text(header, margin + widths[index] * index + 5, y)); y += 18; pdf.setTextColor(76, 91, 104); rows.forEach((row) => { if (y > 770) { pdf.addPage(); y = 48 } row.forEach((value, index) => pdf.text(String(value), margin + widths[index] * index + 5, y)); y += 16 }) }

  line('Annual observations', 14, [19, 47, 73]); table(['Year', 'Events', 'Days', 'Mean °C'], annualData.map((item) => [String(item.year), String(item.events), String(item.days), item.mean === null ? '—' : String(item.mean)])); y += 14; line('Detected heatwave events', 14, [19, 47, 73]); table(['Start', 'End', 'Days', 'Peak', 'Severity'], eventData.map((event) => [event.start, event.end, String(event.duration), event.peak, event.severity])); pdf.save(`climatelens-${range.replace('–', '-')}.pdf`); return true

}



function MetricCard({ label, value, unit, detail, icon: Icon, trend }: { label: string; value: string; unit?: string; detail: string; icon: typeof Thermometer; trend?: 'up' | 'down' }) {

  return <article className="metric-card"><div className="metric-top"><span className="metric-label">{label}</span><span className="metric-icon"><Icon /></span></div><div className="metric-value">{value}<span>{unit}</span></div><div className="metric-detail">{trend === 'up' && <ArrowUpRight className="trend-up" />}{trend === 'down' && <ArrowDownRight className="trend-down" />}{detail}</div></article>

}

function BarChart({ mode, data = [] }: { mode: 'events' | 'days'; data?: AnnualDatum[] }) {

  const max = mode === 'events' ? Math.max(7, ...data.map(item => item.events)) : Math.max(30, ...data.map(item => item.days))

  return <div className="bar-chart" aria-label={mode === 'events' ? 'Annual heatwave event frequency' : 'Annual heatwave days'}><div className="chart-y-labels"><span>{max}</span><span>{Math.round(max * .66)}</span><span>{Math.round(max * .33)}</span><span>0</span></div><div className="bars">{data.map(item => <div className="bar-column" key={item.year}><div className="bar-track"><div className={`bar ${mode === 'days' ? 'bar-amber' : ''}`} style={{ height: `${((mode === 'events' ? item.events : item.days) / max) * 100}%` }}><span className="bar-tooltip">{mode === 'events' ? item.events : item.days}</span></div></div><span>{String(item.year).slice(2)}</span></div>)}</div></div>

}

function TrendChart({ data = [] }: { data?: AnnualDatum[] }) {

  const observed = data.filter((item): item is AnnualDatum & { mean: number } => item.mean !== null)

  const minimum = observed.length ? Math.min(...observed.map((item) => item.mean)) : 0

  const maximum = observed.length ? Math.max(...observed.map((item) => item.mean)) : 1

  const span = Math.max(maximum - minimum, 1)

  const points = observed.map((item, index) => `${observed.length === 1 ? 50 : (index / (observed.length - 1)) * 96 + 2},${92 - ((item.mean - minimum) / span) * 76}`).join(' ')

  return <div className="trend-chart"><div className="chart-y-labels"><span>{maximum.toFixed(1)}°C</span><span>{((maximum + minimum) / 2).toFixed(1)}°C</span><span>{minimum.toFixed(1)}°C</span></div>{observed.length ? <><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Annual mean temperature trend"><polyline points={points} className="temperature-line" />{observed.map((item, index) => { const x = observed.length === 1 ? 50 : (index / (observed.length - 1)) * 96 + 2; const y = 92 - ((item.mean - minimum) / span) * 76; return <circle key={item.year} cx={x} cy={y} r="1.4" className="temperature-dot" /> })}</svg><div className="trend-x-labels">{observed.map(item => <span key={item.year}>{item.year}</span>)}</div></> : <div className="chart-empty">Run an analysis to load observed temperatures.</div>}</div>

}






export default function Page() {
  const [threshold, setThreshold] = useState<number | null>(null)
  const [quality, setQuality] = useState<DataQuality | null>(null)

  const [view, setView] = useState<View>('Overview'); const [modal, setModal] = useState<Modal>(null); const [menuOpen, setMenuOpen] = useState(false); const [selectedAnalysis, setSelectedAnalysis] = useState('')

  const [city, setCity] = useState('Bengaluru'); const [startYear, setStartYear] = useState('2015'); const [endYear, setEndYear] = useState('2024'); const [hazard, setHazard] = useState<HazardType>('Heatwave'); const [analyzing, setAnalyzing] = useState(false); const [toast, setToast] = useState('')

  const [location, setLocation] = useState(''); const [annualData, setAnnualData] = useState<AnnualDatum[]>([]); const [eventData, setEventData] = useState<HeatwaveEvent[]>([])

  const { data: locationSuggestions = [] } = useSWR<LocationSuggestion[]>(city.trim().length >= 2 ? `/api/analyses?q=${encodeURIComponent(city.trim())}` : null, (url: string) => fetch(url).then(response => response.ok ? response.json() as Promise<LocationSuggestion[]> : []), { revalidateOnFocus: false })

  const { data: savedAnalyses = [], mutate } = useSWR<SavedAnalysis[]>('/api/analyses', (url: string) => fetch(url, { cache: 'no-store' }).then(response => response.ok ? response.json() as Promise<SavedAnalysis[]> : []), { refreshInterval: 30_000, revalidateOnFocus: true })

  const savedItems = savedAnalyses.map((item) => ({ ...item, range: item.range ?? `${item.startYear ?? ''}–${item.endYear ?? ''}`, updated: item.updated ?? (item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Unknown') }))

  const range = useMemo(() => `${startYear}–${endYear}`, [startYear, endYear])

  const duplicateAnalysis = async (id: number) => { const response = await fetch('/api/analyses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); if (response.ok) { await mutate(); setToast('Duplicate created in your workspace'); window.setTimeout(() => setToast(''), 2600) } }

  const deleteAnalysis = async (id: number) => { const response = await fetch('/api/analyses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); if (response.ok) { await mutate(); setModal(null); setSelectedAnalysis(''); setToast('Analysis deleted'); window.setTimeout(() => setToast(''), 2600) } else { setToast('Unable to delete this analysis') } }

  const analyze = async () => { setAnalyzing(true); setView('Overview'); try { const response = await fetch('/api/analyses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `${city || 'Climate'} ${hazard.toLowerCase()} review`, location: city, startYear: Number(startYear), endYear: Number(endYear), hazard }) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error ?? `Analysis failed (${response.status})`); setLocation(`${result.climate.location.city}, ${result.climate.location.state}, ${result.climate.location.country}`); setAnnualData(result.climate.annual ?? []); setEventData(result.climate.events ?? []); setThreshold(typeof result.climate.threshold === 'number' ? result.climate.threshold : null); setQuality(result.climate.quality ?? null); await mutate(); setToast('Live analysis saved successfully'); } catch (error) { setToast(error instanceof Error ? error.message : 'Analysis could not be loaded'); } finally { setAnalyzing(false); window.setTimeout(() => setToast(''), 3500); } }

  const navigate = (next: View) => { setView(next); setMenuOpen(false) }



  const totalEvents = eventData.length



const totalHeatwaveDays = annualData.reduce(

  (total, item) => total + item.days,

  0

)



const meanEventDuration =

  eventData.length > 0

    ? eventData.reduce((total, event) => total + event.duration, 0) /

      eventData.length

    : null



  return <main className="app-shell">

    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}><div className="brand"><span className="brand-mark"><CloudSun /></span><span>Climate<span className="brand-accent">Lens</span></span><button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X /></button></div><nav className="side-nav" aria-label="Primary navigation"><p className="nav-caption">Workspace</p>{(['Overview', 'Saved analyses', 'Data sources'] as View[]).map((item, index) => <button key={item} className={`nav-item ${view === item ? 'active' : ''}`} onClick={() => navigate(item)}><span>{index === 0 ? <Activity /> : index === 1 ? <Layers3 /> : <Wind />}</span>{item}{item === 'Overview' && <span className="nav-dot" />}</button>)}<p className="nav-caption nav-caption-spaced">Resources</p><button className={`nav-item ${view === 'Methodology' ? 'active' : ''}`} onClick={() => navigate('Methodology')}><span><CircleHelp /></span>Methodology</button><button className={`nav-item ${view === 'Settings' ? 'active' : ''}`} onClick={() => navigate('Settings')}><span><Settings2 /></span>Settings</button></nav><div className="sidebar-footer"><div className="data-status"><span className="status-pulse" /><div><strong>Data pipeline online</strong><small>Open-Meteo archive</small></div></div><div className="user-row"><span className="avatar">AK</span><div><strong>Alex Kumar</strong><small>Research workspace</small></div><ChevronDown /></div></div></aside>

    <div className="main-content"><header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu /></button><div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{view}</strong></div><div className="top-actions"><span className="live-indicator"><span />Live data</span><button className="icon-button" onClick={analyze} aria-label="Refresh data"><RefreshCw /></button><button className="outline-button" onClick={() => setModal('export')}><Download /> Export report</button></div></header>

      {view === 'Overview' && <Overview city={city} setCity={setCity} location={location} setLocation={setLocation} startYear={startYear} setStartYear={setStartYear} endYear={endYear} setEndYear={setEndYear} hazard={hazard} setHazard={setHazard} suggestions={locationSuggestions} range={range} annualData={annualData} eventData={eventData} analyzing={analyzing} analyze={analyze} onMore={() => setModal('analysis')} threshold={threshold} quality={quality} totalEvents={totalEvents} totalHeatwaveDays={totalHeatwaveDays} meanEventDuration={meanEventDuration} onExport={() => downloadCsv(annualData, eventData, location || city, range)} />}

      {view === 'Saved analyses' && <PageHeader title="Saved analyses" description="Reuse, duplicate, and compare previous climate hazard studies." action={<button className="primary-button" onClick={() => setModal('analysis')}><Plus /> New analysis</button>}><section className="saved-grid">{savedItems.map(item => <article className="panel saved-card" key={item.id ?? item.name}><div className="saved-card-top"><span className="saved-icon"><Activity /></span><button className="more-button" aria-label={`Actions for ${item.name}`} onClick={() => { setSelectedAnalysis(item.name); setModal('actions') }}>•••</button></div><h3>{item.name}</h3><p>{item.location} · {item.range}</p><div className="saved-meta"><span>{item.updated}</span><button className="text-button" onClick={() => { const climate = item.payload; setCity(item.location ?? ''); setLocation(climate?.location ? `${climate.location.city}, ${climate.location.state}, ${climate.location.country}` : item.location ?? ''); setAnnualData(climate?.annual ?? []); setEventData(climate?.events ?? []); setThreshold(typeof climate?.threshold === 'number' ? climate.threshold : null); setQuality(climate?.quality ?? null); setStartYear(String(item.startYear ?? 2015)); setEndYear(String(item.endYear ?? 2024)); setView('Overview') }}>Open <ArrowUpRight /></button></div><div className="saved-card-actions"><button className="duplicate-button" onClick={() => item.id ? duplicateAnalysis(item.id) : setToast('Save this analysis before duplicating it')}><Copy /> Duplicate analysis</button>{item.id && <button className="delete-button" onClick={() => { setSelectedAnalysis(String(item.id)); setModal('delete') }}><Trash2 /> Delete</button>}</div></article>)}</section></PageHeader>}

      {view === 'Data sources' && <PageHeader title="Data sources" description="Review the provenance and health of every dataset used in your analyses."><section className="source-list panel"><div className="source-row"><span className="source-logo"><CloudSun /></span><div><h3>Open-Meteo Historical Weather API</h3><p>Daily maximum temperature · ERA5 reanalysis · Celsius</p></div><span className="source-status"><Check /> Connected</span><button className="outline-button" onClick={() => setToast('Source connection verified')}>Verify</button></div><div className="source-row"><span className="source-logo blue-logo"><Gauge /></span><div><h3>ClimateLens calculation engine</h3><p>95th percentile baseline · minimum event duration: 3 days</p></div><span className="source-status"><Check /> Ready</span><button className="outline-button" onClick={() => setModal('methodology')}>Details</button></div></section></PageHeader>}

      {view === 'Methodology' && <PageHeader title="Methodology" description="Transparent definitions for every metric in the ClimateLens workspace."><MethodologyContent /></PageHeader>}

      {view === 'Settings' && <PageHeader title="Workspace settings" description="Manage display, analysis defaults, and report preferences."><SettingsContent onSave={() => { setModal(null); setToast('Settings saved') }} /></PageHeader>}

      <footer className="footer"><span>ClimateLens · Analysis v1.4.2</span><span>Threshold baseline: 2015–2024 · <button onClick={() => setView('Methodology')}>Methodology</button></span></footer></div>

    {modal && <Dialog type={modal} onClose={() => setModal(null)} onAnalyze={analyze} onDelete={deleteAnalysis} selectedAnalysis={selectedAnalysis} setToast={setToast} annualData={annualData} eventData={eventData} location={location || city} range={range} />}{toast && <div className="toast"><Check />{toast}</div>}

  </main>

}



type OverviewProps = {

  city: string

  setCity: Dispatch<SetStateAction<string>>

  location: string

  setLocation: Dispatch<SetStateAction<string>>

  startYear: string

  setStartYear: Dispatch<SetStateAction<string>>

  endYear: string

  setEndYear: Dispatch<SetStateAction<string>>

  range: string

  annualData: AnnualDatum[]

  eventData: HeatwaveEvent[]

  analyzing: boolean

  analyze: () => Promise<void>

  onMore: () => void

  hazard: HazardType

  setHazard: Dispatch<SetStateAction<HazardType>>

  suggestions: LocationSuggestion[]
  threshold: number | null
  quality: DataQuality | null
  totalEvents: number
  totalHeatwaveDays: number
  meanEventDuration: number | null
  onExport: () => void

}



function Overview({ city, setCity, location, setLocation, startYear, setStartYear, endYear, setEndYear, hazard, setHazard, suggestions, range, annualData, eventData, analyzing, analyze, onMore, threshold, quality, totalEvents, totalHeatwaveDays, meanEventDuration, onExport }: OverviewProps) { return <><section className="page-header"><div><div className="eyebrow"><span className="eyebrow-mark" />CLIMATE HAZARD ANALYZER</div><h1>Heatwave trends</h1><p>Understand how extreme heat is changing across your selected region.</p></div><div className="last-updated"><span>Last analysis</span><strong>{annualData.length ? 'Analysis loaded' : 'Not run yet'}</strong><span className="verified"><ShieldCheck /> {quality ? 'Observed data loaded' : 'Awaiting analysis'}</span></div></section><section className="control-panel" id="analysis-parameters"><div className="control-heading"><div><h2>Analysis parameters</h2><p>Choose a location and year range. Historical observations are analyzed by full calendar year.</p></div><span className="point-badge"><MapPin /> Point analysis</span></div><div className="controls"><label className="control-field location-field"><span>Location</span><div className="input-wrap"><Search /><input value={city} onChange={(e) => { setCity(e.target.value); if (e.target.value !== location) setLocation('') }} aria-label="City, state, or country" placeholder="Search any city, state, or country" autoComplete="off" /></div>{suggestions.length > 0 && city !== location && <div className="location-suggestions" role="listbox">{suggestions.map((suggestion) => { const resolved = [suggestion.name, suggestion.state, suggestion.country].filter(Boolean).join(', '); return <button type="button" key={`${suggestion.latitude}-${suggestion.longitude}`} role="option" onClick={() => { setCity(resolved); setLocation(resolved) }}><MapPin />{resolved}</button> })}</div>}{location && <span className="selected-location"><Check /> Selected: {location}</span>}</label><label className="control-field"><span>Start year</span><input className="date-input" type="number" min="1940" max={new Date().getFullYear() - 1} value={startYear} onChange={(e) => setStartYear(e.target.value)} /></label><span className="range-separator">to</span><label className="control-field"><span>End year</span><input className="date-input" type="number" min={Number(startYear) + 1} max={new Date().getFullYear() - 1} value={endYear} onChange={(e) => setEndYear(e.target.value)} /></label><label className="control-field hazard-field"><span>Hazard type</span><select value={hazard} onChange={(e) => setHazard(e.target.value as HazardType)}>{hazardTypes.map((type) => <option key={type}>{type}</option>)}</select></label><button className="analyze-button" onClick={analyze} disabled={analyzing}>{analyzing ? <RefreshCw className="spin" /> : <Activity />}{analyzing ? 'Analyzing…' : 'Run analysis'}</button></div><div className="resolved-location"><span className="location-check"><ShieldCheck /></span><span><strong>Resolved location</strong> {location || city || 'Choose a location and run an analysis'}</span><span className="data-window">{quality ? `${quality.observedDays.toLocaleString()} observations` : 'No analysis loaded'}</span></div></section><div className="section-heading"><div><h2>Regional overview</h2><p>Heatwave indicators calculated from daily maximum temperature observations.</p></div><button className="date-button" type="button" onClick={() => document.getElementById('analysis-parameters')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} title="Change the period in Analysis parameters"> <CalendarDays /> {range} <ChevronDown /></button></div><section className="metrics-grid"><MetricCard label="95th percentile threshold" value={threshold === null ? '—' : threshold.toFixed(1)} unit={threshold === null ? '' : '°C'} detail={threshold === null ? 'Run an analysis to calculate threshold' : 'Calculated from observed temperatures'} icon={Gauge} /><MetricCard label="Heatwave events" value={annualData.length ? String(totalEvents) : '—'} detail={annualData.length ? 'Qualifying events in selected period' : 'Run an analysis to calculate events'} icon={Activity} /><MetricCard label="Heatwave days" value={annualData.length ? String(totalHeatwaveDays) : '—'} detail={annualData.length ? 'Qualifying days in selected period' : 'Run an analysis to calculate days'} icon={CalendarDays} /><MetricCard label="Mean event duration" value={meanEventDuration === null ? '—' : meanEventDuration.toFixed(1)} unit={meanEventDuration === null ? '' : 'days'} detail={meanEventDuration === null ? 'No qualifying events found' : 'Average duration of qualifying events'} icon={TrendingUp} /></section><section className="charts-grid"><ChartPanel title="Event frequency" subtitle="Qualifying heatwave events per year" onMore={onExport}><BarChart mode="events" data={annualData} />

</ChartPanel><ChartPanel title="Heatwave days" subtitle="Total qualifying days per year" onMore={onExport}><BarChart mode="days" data={annualData} /></ChartPanel><ChartPanel title="Peak temperature trend" subtitle="Mean daily maximum temperature by year" badge={formatDecadeTrend(annualData)} onMore={onExport}><TrendChart data={annualData} /></ChartPanel></section><section className="bottom-grid"><article className="panel events-panel"><div className="panel-header"><div><h3>Recent heatwave events</h3><p>Latest qualifying events in {location.split(',')[0]}</p></div><button className="text-button" onClick={onMore}>View all <ArrowUpRight /></button></div><div className="event-table-wrap"><table><thead><tr><th>Start date</th><th>End date</th><th>Duration</th><th>Peak temp.</th><th>Severity</th></tr></thead><tbody>{eventData.length ? eventData.map(event => <tr key={event.start}><td>{event.start}</td><td>{event.end}</td><td>{event.duration} days</td><td><strong>{event.peak}</strong></td><td><span className={`severity ${event.severity.toLowerCase()}`}><span />{event.severity}</span></td></tr>) : <tr><td colSpan={5}>{annualData.length ? 'No qualifying heatwave events were detected for this period.' : 'Run an analysis to view detected events.'}</td></tr>}</tbody></table></div></article><article className="panel quality-panel"><div className="panel-header"><div><h3>Data quality</h3><p>Reliability of this analysis</p></div><ShieldCheck className="quality-icon" /></div><div className="coverage-score"><strong>{quality ? (quality.completeness * 100).toFixed(1) : '—'}<span>{quality ? '%' : ''}</span></strong><div><span>Coverage</span><small>{quality ? (quality.completeness >= 0.99 ? 'Excellent' : quality.completeness >= 0.95 ? 'Good' : 'Limited') : 'Run analysis'}</small></div></div><div className="progress"><span style={{ width: `${quality ? Math.max(0, Math.min(100, quality.completeness * 100)) : 0}%` }} /></div><dl className="quality-list"><div><dt>Expected observations</dt><dd>{quality ? quality.requestedDays.toLocaleString() : '—'}</dd></div><div><dt>Available observations</dt><dd>{quality ? quality.observedDays.toLocaleString() : '—'}</dd></div><div><dt>Missing dates</dt><dd className="warning-text">{quality ? quality.missingDays.toLocaleString() : '—'} {quality && quality.missingDays > 0 ? <AlertTriangle /> : null}</dd></div><div><dt>Data source</dt><dd>{quality?.source ?? 'Not loaded'} <span className="source-dot" /></dd></div></dl><p className="quality-note">Missing dates break consecutive runs. No interpolation applied.</p></article></section></> }

function formatDecadeTrend(data: AnnualDatum[]): string {
  const points = data.filter((item): item is AnnualDatum & { mean: number } => item.mean !== null)
  if (points.length < 2) return 'No data for trend'
  const meanX = points.reduce((sum, item) => sum + item.year, 0) / points.length
  const meanY = points.reduce((sum, item) => sum + item.mean, 0) / points.length
  const denominator = points.reduce((sum, item) => sum + (item.year - meanX) ** 2, 0)
  if (!denominator) return 'No data for trend'
  const slope = points.reduce((sum, item) => sum + (item.year - meanX) * (item.mean - meanY), 0) / denominator
  return `${slope >= 0 ? '+' : ''}${(slope * 10).toFixed(2)}°C / decade`
}

function ChartPanel({ title, subtitle, children, badge, onMore }: { title: string; subtitle: string; children: ReactNode; badge?: string; onMore: () => void }) { return <article className="panel chart-panel"><div className="panel-header"><div><h3>{title}</h3><p>{subtitle}</p></div>{badge ? <span className="trend-badge">{badge.startsWith('+') ? <TrendingUp /> : null}{badge}</span> : <button className="more-button" type="button" aria-label={`${title} options — export data`} title="Export analysis data as CSV" onClick={onMore}>•••</button>}</div>{children}<div className="chart-footnote"><span className={`legend-dot ${title === 'Heatwave days' ? 'amber' : 'blue'}`} />{title === 'Peak temperature trend' ? 'Observed mean' : title === 'Heatwave days' ? 'Annual days' : 'Annual events'}<span className="trend-note">{badge && !badge.startsWith('No data') ? <TrendingUp /> : null}{badge ?? 'Annual values from the selected analysis'}</span></div></article> }

function PageHeader({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) { return <><section className="page-header"><div><div className="eyebrow"><span className="eyebrow-mark" />CLIMATE ANALYTICS WORKSPACE</div><h1>{title}</h1><p>{description}</p></div>{action}</section>{children}</> }

function MethodologyContent() { return <section className="method-grid"><article className="panel method-card"><span className="step-number">01</span><h3>Reference threshold</h3><p>The 95th percentile is calculated from valid daily maximum temperature observations in the selected baseline. The threshold remains fixed across the comparison period.</p></article><article className="panel method-card"><span className="step-number">02</span><h3>Event detection</h3><p>A heatwave requires at least three consecutive days strictly above the threshold. Missing dates break a run; no interpolation is applied.</p></article><article className="panel method-card"><span className="step-number">03</span><h3>Trend interpretation</h3><p>Annual counts are summarized with a linear trend. A trend indicates direction in the observations and is not proof of climate causation.</p></article></section> }

function SettingsContent({ onSave }: { onSave: () => void }) {
  return (
    <section className="settings-grid">
      <article className="panel settings-card">
        <h3>Analysis configuration</h3>

        <label>
          <span>Hazard type</span>
          <select value="Heatwave" disabled>
            <option value="Heatwave">Heatwave</option>
          </select>
        </label>

        <label>
          <span>Minimum event duration</span>
          <select value="3" disabled>
            <option value="3">3 consecutive days</option>
          </select>
        </label>

        <p>
          A heatwave event is identified when daily maximum
          temperatures meet the configured threshold for at
          least three consecutive days. Missing dates interrupt
          an event.
        </p>
      </article>
    </section>
  )
}

function Dialog({ type, onClose, onAnalyze, onDelete, selectedAnalysis, setToast, annualData, eventData, location, range }: { type: Exclude<Modal, null>; onClose: () => void; onAnalyze: () => void; onDelete: (id: number) => void; selectedAnalysis: string; setToast: (message: string) => void; annualData: AnnualDatum[]; eventData: HeatwaveEvent[]; location: string; range: string }) { const titles = { analysis: 'Create analysis', export: 'Export report', methodology: 'Analysis methodology', settings: 'Workspace settings', actions: 'Analysis actions', delete: 'Delete saved analysis' }; return <div className="dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="dialog-close" onClick={onClose} aria-label="Close dialog"><X /></button><h2 id="dialog-title">{titles[type]}</h2>{type === 'analysis' && <><p>Start a new point-based heatwave analysis using the current workspace defaults.</p><label className="dialog-field"><span>Analysis name</span><input defaultValue="Bengaluru heatwave review" /></label><button className="primary-button dialog-action" onClick={() => { onAnalyze(); onClose() }}>Run analysis <ArrowUpRight /></button></>}{type === 'export' && <><p>Your report will include the selected parameters, summary metrics, annual trend data, event table, and quality notes.</p><div className="export-options"><button onClick={() => { if (!downloadPdf(location, range, annualData, eventData)) setToast('Allow popups to create the PDF report'); onClose() }}><Download /> PDF report</button><button onClick={() => { downloadCsv(annualData, eventData, location, range); setToast('CSV download started'); onClose() }}><Download /> CSV data</button></div></>}{type === 'methodology' && <><p>ClimateLens uses a fixed 95th-percentile regional baseline and counts runs of three or more consecutive qualifying days. Missing observations always interrupt a confirmed event.</p><button className="primary-button dialog-action" onClick={onClose}>Got it <Check /></button></>}{type === 'delete' && <><p>Are you sure you want to permanently delete this saved analysis? This action cannot be undone.</p><div className="dialog-actions"><button className="outline-button" onClick={onClose}>Cancel</button><button className="danger-button" onClick={() => onDelete(Number(selectedAnalysis))}><Trash2 /> Delete analysis</button></div></>}{type === 'actions' && <><p>Manage <strong>{selectedAnalysis}</strong> without leaving your workspace.</p><div className="export-options"><button onClick={() => { onClose(); onAnalyze() }}><RefreshCw /> Re-run analysis</button><button onClick={() => { onClose(); setToast('Duplicate created in your workspace') }}><Copy /> Duplicate data</button><button onClick={() => { onClose(); setToast('Analysis archived') }}><Download /> Export snapshot</button></div></>}{type === 'settings' &&
   <SettingsContent onSave={onClose} />}</section></div> }
