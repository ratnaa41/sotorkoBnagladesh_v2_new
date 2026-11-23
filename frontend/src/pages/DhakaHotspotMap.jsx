import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import api from '../api'

const DHAKA_CENTER = [23.7806, 90.4070]

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function getClusters(data) {
  if (Array.isArray(data)) return data
  return data?.hotspots || data?.clusters || data?.points || data?.results || []
}

function getCoordinates(item) {
  const lat = Number(firstValue(
    item.center_lat,
    item.center_latitude,
    item.latitude,
    item.lat,
    item.center?.lat,
    item.center?.latitude,
    item.coordinates?.[0]
  ))

  const lng = Number(firstValue(
    item.center_lon,
    item.center_lng,
    item.center_longitude,
    item.longitude,
    item.lon,
    item.lng,
    item.center?.lon,
    item.center?.lng,
    item.center?.longitude,
    item.coordinates?.[1]
  ))

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < 23.5 || lat > 24.0 || lng < 90.2 || lng > 90.7) return null

  return [lat, lng]
}

function getRecordCount(item) {
  return Number(firstValue(
    item.accident_records,
    item.records,
    item.record_count,
    item.total_accidents,
    item.count,
    0
  ))
}

function getClusterQuality(item) {
  const locations = Number(firstValue(item.unique_locations, item.unique_location_count, 0))

  if (locations >= 3) return 'Spatial hotspot'
  if (locations === 2) return 'Limited spatial concentration'
  return 'Repeated-coordinate concentration'
}

export default function DhakaHotspotMap({ user }) {
  const isDhakaUser = (user?.preferred_district || '').trim().toLowerCase() === 'dhaka'

  const [hotspotData, setHotspotData] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [areaNames, setAreaNames] = useState({})

useEffect(() => {
  let active = true

  fetch('/data/dhaka_hotspot_names.json')
    .then((response) => {
      if (!response.ok) {
        throw new Error('Area names file not found')
      }
      return response.json()
    })
    .then((data) => {
      if (active) setAreaNames(data)
    })
    .catch((err) => {
      console.error('Could not load Dhaka area names:', err)
    })

  return () => {
    active = false
  }
}, [])

  useEffect(() => {
    if (!isDhakaUser) {
      setLoading(false)
      setHotspotData(null)
      setMetrics(null)
      return
    }

    let active = true
    setLoading(true)
    setError('')

    Promise.all([
      api.get('/dhaka/hotspots'),
      api.get('/dhaka/metrics'),
    ])
      .then(([hotspotResponse, metricsResponse]) => {
        if (!active) return
        setHotspotData(hotspotResponse.data)
        setMetrics(metricsResponse.data)
      })
      .catch((err) => {
        if (!active) return
        if (err.response?.status === 403 || err.response?.status === 401) {
          setError('Your account is not authorized to view Dhaka hotspots. Please log in with a Dhaka preferred district.')
        } else {
          setError('Could not load Dhaka hotspot data. Check that the backend and model JSON files are available.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [isDhakaUser])

  const clusters = useMemo(() => getClusters(hotspotData), [hotspotData])

const validClusters = useMemo(() => {
  const mapped = clusters
    .map((item, index) => {
      const clusterId = String(
        firstValue(item.cluster_id, item.cluster, item.id, index)
      )

      const areaInfo = areaNames[clusterId] || {}

      return {
        ...item,
        _mapCoordinates: getCoordinates(item),
        _key: clusterId,
        _areaName: areaInfo.area_name || `Unknown area`,
        _displayName: areaInfo.display_name || '',
      }
    })
    .filter((item) => item._mapCoordinates && getRecordCount(item) > 0)

  const maxFrequency = Math.max(
    1,
    ...mapped.map(getRecordCount)
  )

  const maxSeverity = Math.max(
    1,
    ...mapped.map((item) =>
      Number(item.fatalities || item.deaths || 0) * 3 +
      Number(item.injuries || 0)
    )
  )

  return mapped.map((item) => {
    const count = getRecordCount(item)

    const severityBurden =
      Number(item.fatalities || item.deaths || 0) * 3 +
      Number(item.injuries || 0)

    const frequencyScore = (count / maxFrequency) * 100
    const severityScore = (severityBurden / maxSeverity) * 100

    const riskScore = Math.round(
      frequencyScore * 0.4 + severityScore * 0.6
    )

    const riskLevel =
      riskScore >= 70 ? 'High' :
      riskScore >= 40 ? 'Medium' : 'Low'

    const riskColor =
      riskLevel === 'High' ? '#dc2626' :
      riskLevel === 'Medium' ? '#f59e0b' : '#16a34a'

    return {
      ...item,
      _riskScore: riskScore,
      _riskLevel: riskLevel,
      _riskColor: riskColor,
    }
  })
}, [clusters, areaNames])

  if (!user) {
    return (
      <div className="page">
        <div className="card">
          <h2>Login required</h2>
          <p>Dhaka historical hotspot information is available only to eligible Dhaka users.</p>
          <Link to="/login" className="cta">Login</Link>
        </div>
      </div>
    )
  }

  if (!isDhakaUser) {
    return (
      <div className="page">
        <div className="card">
          <h2>Dhaka hotspot access unavailable</h2>
          <p>Your preferred district is <b>{user.preferred_district || 'not set'}</b>.</p>
          <p>This page is reserved for accounts with Dhaka as their preferred district.</p>
          <Link to="/" className="cta outline">Back to Bangladesh map</Link>
        </div>
      </div>
    )
  }

  if (loading) return <div className="page">Loading Dhaka historical hotspots...</div>

  if (error) {
    return (
      <div className="page">
        <div className="card">
          <h2>Dhaka Historical Hotspots</h2>
          <p className="error">{error}</p>
          <button className="cta outline" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    )
  }

  const totalRecords = firstValue(
    hotspotData?.records_used,
    hotspotData?.total_records,
    metrics?.records_used,
    metrics?.dataset_size
  )
  const hotspotCount = firstValue(
    hotspotData?.hotspot_count,
    hotspotData?.cluster_count,
    validClusters.length
  )
  const noiseRecords = firstValue(hotspotData?.noise_records, hotspotData?.noise_count)

  return (
    <div className="page">
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Dhaka City — Historical Accident Hotspots</h2>
        <p style={{ color: '#64748b', lineHeight: 1.6 }}>
          These markers show historical accident concentrations from the BUET dataset.
          They do not predict that an accident will happen at a location.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
          <div className="stat-card">
            <small>Records used</small>
            <h3>{totalRecords ?? '—'}</h3>
          </div>
          <div className="stat-card">
            <small>Hotspot clusters</small>
            <h3>{hotspotCount ?? validClusters.length}</h3>
          </div>
          <div className="stat-card">
            <small>Noise records</small>
            <h3>{noiseRecords ?? '—'}</h3>
          </div>
          <div className="stat-card">
            <small>Mapped clusters</small>
            <h3>{validClusters.length}</h3>
          </div>
        </div>
      </div>

      <div className="layout-split">
        <div className="main">
          <div className="card">
            <h3>Historical accident concentration map</h3>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              Select a marker to inspect its historical record count and severity breakdown.
            </p>

            <div className="map-container">
              <MapContainer
                center={DHAKA_CENTER}
                zoom={12}
                scrollWheelZoom
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {validClusters.map((item) => {
  const count = getRecordCount(item)
  const radius = Math.max(7, Math.min(22, 5 + Math.sqrt(count) * 0.8))

  return (
    <CircleMarker
      key={item._key}
      center={item._mapCoordinates}
      radius={radius}
      pathOptions={{
        color: item._riskColor,
        fillColor: item._riskColor,
        fillOpacity: 0.68,
        weight: 2,
      }}
      eventHandlers={{
        click: () => setSelected(item),
      }}
    >
      <Popup>
        <div style={{ minWidth: 170 }}>
          <strong>{item._areaName}</strong>
          <br />
          Risk score: <b>{item._riskScore}/100</b>
          <br />
          Risk level: <b>{item._riskLevel}</b>
          <br />
          {count} historical accident records
          <br />
          {getClusterQuality(item)}
        </div>
      </Popup>
    </CircleMarker>
  )
})}
              </MapContainer>
            </div>

            <p style={{ fontSize: 12, color: '#64748b', marginTop: 10 }}>
              <div style={{
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  marginTop: 14,
  fontSize: 13,
}}>
  <span>
    <span style={{ color: '#dc2626' }}>●</span> High risk (70–100)
  </span>

  <span>
    <span style={{ color: '#f59e0b' }}>●</span> Medium risk (40–69)
  </span>

  <span>
    <span style={{ color: '#16a34a' }}>●</span> Low risk (0–39)
  </span>
</div>
              Marker size represents the number of historical records in each cluster.
            </p>
          </div>
        </div>

        <div className="side">
          <div className="card">
  <h3>Historical Hotspot Details</h3>

  {!selected ? (
    <div style={{
      padding: '24px 12px',
      textAlign: 'center',
      color: '#64748b',
    }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>📍</div>
      <p>Select a colored marker on the map to view its area details.</p>
    </div>
  ) : (
    <>
      <div style={{
        padding: 16,
        borderRadius: 12,
        background: '#f8fafc',
        marginTop: 12,
        marginBottom: 16,
      }}>
        <small style={{ color: '#64748b' }}>HOTSPOT AREA</small>

        <h2 style={{ margin: '6px 0', fontSize: 22 }}>
          {selected._areaName}
        </h2>

        <div style={{
          display: 'inline-block',
          padding: '5px 10px',
          borderRadius: 20,
          background: selected._riskColor,
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
        }}>
          {selected._riskLevel} Risk
        </div>

        {selected._displayName && (
          <p style={{
            fontSize: 12,
            color: '#64748b',
            lineHeight: 1.5,
            marginTop: 10,
          }}>
            {selected._displayName}
          </p>
        )}
      </div>

      <div style={{
        padding: 16,
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        marginBottom: 14,
      }}>
        <small style={{ color: '#64748b' }}>HISTORICAL RISK INDEX</small>

        <h1 style={{
          fontSize: 36,
          margin: '5px 0',
          color: selected._riskColor,
        }}>
          {selected._riskScore}/100
        </h1>

        <div style={{
          height: 9,
          background: '#e2e8f0',
          borderRadius: 10,
          overflow: 'hidden',
          marginTop: 10,
        }}>
          <div style={{
            width: `${selected._riskScore}%`,
            height: '100%',
            background: selected._riskColor,
            borderRadius: 10,
          }} />
        </div>
      </div>

      <h4>Accident statistics</h4>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
      }}>
        <div className="stat-card">
          <small>Accident records</small>
          <h3>{getRecordCount(selected)}</h3>
        </div>

        <div className="stat-card">
          <small>Unique locations</small>
          <h3>
            {firstValue(
              selected.unique_locations,
              selected.unique_location_count,
              '—'
            )}
          </h3>
        </div>

        <div className="stat-card">
          <small>Deaths</small>
          <h3>
            {firstValue(selected.fatalities, selected.deaths, '—')}
          </h3>
        </div>

        <div className="stat-card">
          <small>Injuries</small>
          <h3>{firstValue(selected.injuries, '—')}</h3>
        </div>
      </div>

      <p style={{ marginTop: 16 }}>
        <b>Classification:</b> {getClusterQuality(selected)}
      </p>

      <p>
        <b>Cluster ID:</b> {selected._key}
      </p>

      {selected.severity_counts && (
        <>
          <h4 style={{ marginTop: 18 }}>Severity categories</h4>

          <ul className="factor-list">
            {Object.entries(selected.severity_counts).map(([name, value]) => (
              <li key={name}>
                {name.replaceAll('_', ' ')}: {value}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )}
</div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Model information</h3>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              {metrics?.model_type || metrics?.model_name || 'DBSCAN historical clustering'}
            </p>
            {metrics?.accuracy !== undefined && (
              <p><b>Severity classifier accuracy:</b> {(Number(metrics.accuracy) * 100).toFixed(2)}%</p>
            )}
            {metrics?.boundary_note && (
              <p style={{ fontSize: 12, color: '#64748b' }}>{metrics.boundary_note}</p>
            )}
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 10 }}>
              The severity classifier estimates accident severity categories from recorded features.
              Its accuracy is not a measure of future hotspot prediction accuracy.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
