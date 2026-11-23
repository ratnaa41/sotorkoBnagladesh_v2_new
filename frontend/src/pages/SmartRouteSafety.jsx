
import { useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
  Popup,
} from 'react-leaflet'
import L from 'leaflet'
import api from '../api'

const DHAKA_PLACES = [
  'Gulshan',
  'Dhanmondi',
  'Mirpur',
  'Uttara',
  'Motijheel',
  'Farmgate',
  'Mohakhali',
  'Badda',
  'Jatrabari',
  'Airport',
  'Shyamoli',
  'Paltan',
]

const ALERT_COLORS = {
  High: '#dc2626',
  Medium: '#f59e0b',
  Low: '#16a34a',
}

const endpointIcon = (label, color) =>
  L.divIcon({
    className: 'smart-route-endpoint',
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};color:white;border:2px solid white;display:flex;align-items:center;justify-content:center;font-weight:800;box-shadow:0 2px 6px #0005">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

function hotspotLabel(names, clusterId) {
  if (!names) return `Historical hotspot #${clusterId}`

  const rows = Array.isArray(names)
    ? names
    : Array.isArray(names.hotspots)
      ? names.hotspots
      : null

  if (rows) {
    const match = rows.find(
      (item) => Number(item.cluster_id) === Number(clusterId)
    )
    if (match) {
      return (
        match.locality ||
        match.area_name ||
        match.name ||
        match.label ||
        `Historical hotspot #${clusterId}`
      )
    }
  }

  const value =
    names[String(clusterId)] ??
    names[`cluster_${clusterId}`] ??
    names[`cluster-${clusterId}`]

  if (typeof value === 'string') return value

  if (value && typeof value === 'object') {
    return (
      value.locality ||
      value.area_name ||
      value.name ||
      value.label ||
      `Historical hotspot #${clusterId}`
    )
  }

  return `Historical hotspot #${clusterId}`
}

export default function SmartRouteSafety({ user }) {
  const isDhakaUser =
    (user?.preferred_district || '').trim().toLowerCase() === 'dhaka'

  const [startMode, setStartMode] = useState('gps')
  const [startPlace, setStartPlace] = useState('Gulshan')
  const [destination, setDestination] = useState('Dhanmondi')
  const [gps, setGps] = useState(null)
  const [result, setResult] = useState(null)
  const [names, setNames] = useState(null)
  const [loading, setLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  if (!user) return null

  if (!isDhakaUser) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>🛡️ Smart Route Safety</h3>
        <p style={{ color: '#718096', fontSize: 13 }}>
          Dhaka historical hotspot route alerts are available only to users
          whose preferred district is Dhaka. Your existing district route
          analysis remains available below.
        </p>
      </div>
    )
  }

  const getMyLocation = () => {
    setError('')
    setMessage('')

    if (!navigator.geolocation) {
      setError('This browser does not support GPS location.')
      return
    }

    setGpsLoading(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
        setStartMode('gps')
        setGpsLoading(false)
        setMessage('GPS location captured. Press Find Safe Route to continue.')
      },
      (err) => {
        setGpsLoading(false)
        if (err.code === 1) {
          setError('Location permission denied. Allow location access or select a manual start.')
        } else if (err.code === 2) {
          setError('Your current location could not be detected.')
        } else {
          setError('GPS request timed out. Try again or select a manual start.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    )
  }

  const analyzeRoute = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setResult(null)

    if (startMode === 'manual' && startPlace === destination) {
      setError('Start and destination must be different.')
      return
    }

    if (startMode === 'gps' && !gps) {
      setError('First capture your GPS location or choose a manual starting point.')
      return
    }

    setLoading(true)

    try {
      const payload = {
        to_place: destination,
      }

      if (startMode === 'gps') {
        payload.start_lat = gps.lat
        payload.start_lon = gps.lon
      } else {
        payload.start_place = startPlace
      }

      const response = await api.post('/smart-route-safety', payload)
      const routeData = response.data

      // Each cluster is included once per trip.
      const seen = new Set()
      routeData.alerts = (routeData.alerts || []).filter((item) => {
        const key = String(item.cluster_id)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      setResult(routeData)

      // Locality labels are optional; route analysis still works without them.
      try {
        const namesResponse = await fetch('/data/dhaka_hotspot_names.json')
        if (namesResponse.ok) {
          setNames(await namesResponse.json())
        }
      } catch {
        // Use cluster IDs if the optional names file is unavailable.
      }

      setMessage(
        routeData.nearby_hotspot_count > 0
          ? `${routeData.nearby_hotspot_count} historical hotspot(s) found within 1 km of this route.`
          : 'No historical hotspot was found within 1 km of this route.'
      )
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        'Could not analyze this route. Check the selected locations and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const routePositions = result?.route_geometry || []
  const mapCenter = routePositions.length
    ? routePositions[Math.floor(routePositions.length / 2)]
    : [23.8103, 90.4125]

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginBottom: 6 }}>🛡️ Smart Route Safety</h2>

      <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
        Find historical accident hotspots near your Dhaka road route.
        You can use your GPS location or choose a starting locality.
        Alerts show historical proximity, not future accident predictions.
      </p>

      <form onSubmit={analyzeRoute}>
        <div className="form-grid-3">
          <div className="form-group">
            <label>Starting Point</label>
            <select
              value={startMode}
              onChange={(e) => {
                setStartMode(e.target.value)
                setError('')
                setMessage('')
              }}
            >
              <option value="gps">My Current GPS Location</option>
              <option value="manual">Choose Dhaka Locality</option>
            </select>
          </div>

          {startMode === 'manual' && (
            <div className="form-group">
              <label>Start Locality</label>
              <select
                value={startPlace}
                onChange={(e) => setStartPlace(e.target.value)}
              >
                {DHAKA_PLACES.map((place) => (
                  <option key={place} value={place}>{place}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Destination</label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              {DHAKA_PLACES.map((place) => (
                <option key={place} value={place}>{place}</option>
              ))}
            </select>
          </div>
        </div>

        {startMode === 'gps' && (
          <div style={{ margin: '8px 0 14px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={gpsLoading}
              onClick={getMyLocation}
            >
              {gpsLoading ? 'Getting GPS...' : '📍 Use My Location'}
            </button>

            {gps && (
              <span style={{ fontSize: 12, color: '#15803d', marginLeft: 10 }}>
                GPS captured
              </span>
            )}
          </div>
        )}

        {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
        {message && (
          <div style={{
            marginTop: 10,
            marginBottom: 10,
            padding: 10,
            borderRadius: 8,
            background: '#eff6ff',
            color: '#1e40af',
            fontSize: 13,
          }}>
            {message}
          </div>
        )}

        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Analyzing Road & Hotspots...' : 'Find Safe Route'}
        </button>
      </form>

      {result && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
            marginTop: 18,
            marginBottom: 16,
          }}>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>ROAD DISTANCE</div>
              <strong style={{ fontSize: 20 }}>{result.distance_km} km</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>NEARBY HOTSPOTS</div>
              <strong style={{ fontSize: 20 }}>{result.nearby_hotspot_count}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>CHECKED CLUSTERS</div>
              <strong style={{ fontSize: 20 }}>{result.historical_hotspot_count}</strong>
            </div>
          </div>

          <h3 style={{ marginBottom: 10 }}>
            {result.start_label} → {result.destination_label}
          </h3>

          <div style={{ height: 450, borderRadius: 10, overflow: 'hidden' }}>
            <MapContainer
              key={`${result.start_label}-${result.destination_label}-${result.distance_km}`}
              center={mapCenter}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <Polyline
                positions={routePositions}
                pathOptions={{
                  color: '#1e3a8a',
                  weight: 5,
                  opacity: 0.85,
                }}
              />

              <Marker
                position={[
                  result.start_coords.lat,
                  result.start_coords.lon,
                ]}
                icon={endpointIcon('A', '#15803d')}
              >
                <Popup>Start: {result.start_label}</Popup>
              </Marker>

              <Marker
                position={[
                  result.destination_coords.lat,
                  result.destination_coords.lon,
                ]}
                icon={endpointIcon('B', '#1e3a8a')}
              >
                <Popup>Destination: {result.destination_label}</Popup>
              </Marker>

              {result.alerts.map((hotspot) => (
                <CircleMarker
                  key={hotspot.cluster_id}
                  center={[hotspot.latitude, hotspot.longitude]}
                  radius={9}
                  pathOptions={{
                    color: ALERT_COLORS[hotspot.alert_level],
                    fillColor: ALERT_COLORS[hotspot.alert_level],
                    fillOpacity: 0.8,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: 12, minWidth: 180 }}>
                      <strong>
                        {hotspotLabel(names, hotspot.cluster_id)}
                      </strong>
                      <div>
                        {hotspot.distance_from_route_m} m from route
                      </div>
                      <div>
                        {hotspot.proximity} · {hotspot.alert_level} alert
                      </div>
                      <hr />
                      <div>
                        Historical accident records:{' '}
                        {hotspot.historical_accident_records}
                      </div>
                      <div>
                        Historical fatalities:{' '}
                        {hotspot.historical_fatalities}
                      </div>
                      <div>
                        Historical injuries:{' '}
                        {hotspot.historical_injuries}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          <div style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 10 }}>
              🚨 Historical Hotspot Alerts ({result.alerts.length})
            </h3>

            {result.alerts.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 13 }}>
                No historical hotspot found within 1 km of this route.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 9 }}>
                {result.alerts.map((hotspot) => (
                  <div
                    key={hotspot.cluster_id}
                    style={{
                      border: `1px solid ${ALERT_COLORS[hotspot.alert_level]}55`,
                      borderLeft: `4px solid ${ALERT_COLORS[hotspot.alert_level]}`,
                      borderRadius: 8,
                      padding: 12,
                      background: '#fff',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}>
                      <strong>
                        {hotspotLabel(names, hotspot.cluster_id)}
                      </strong>
                      <span style={{
                        color: ALERT_COLORS[hotspot.alert_level],
                        fontWeight: 700,
                        fontSize: 12,
                      }}>
                        {hotspot.alert_level} · {hotspot.distance_from_route_m} m
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                      {hotspot.historical_accident_records} historical records
                      {' · '}{hotspot.historical_fatalities} fatalities
                      {' · '}{hotspot.historical_injuries} injuries
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p style={{
            fontSize: 11,
            color: '#64748b',
            marginTop: 14,
            lineHeight: 1.6,
          }}>
            ⚠️ {result.alert_basis} Route geometry: {result.route_source}.
            Alert distance thresholds: 250 m, 500 m and 1 km.
          </p>
        </>
      )}
    </div>
  )
}
