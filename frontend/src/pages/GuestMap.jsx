import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import api from '../api'

const DISTRICT_COORDS = {
  Dhaka: [23.8103, 90.4125],
  Chattogram: [22.3569, 91.7832],
  Rajshahi: [24.3745, 88.6042],
  Khulna: [22.8456, 89.5403],
  Sylhet: [24.8949, 91.8687],
  Barishal: [22.7010, 90.3535],
  Rangpur: [25.7439, 89.2752],
  Mymensingh: [24.7471, 90.4203],
}

const RISK_COLOR = {
  High: '#d32f2f',
  Medium: '#f57c00',
  Low: '#388e3c',
}

export default function GuestMap() {
  const [districts, setDistricts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/public/summary')
      .then((res) => setDistricts(res.data.districts || []))
      .catch(() => setError('Could not load map data. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page">Loading map...</div>
  if (error) return <div className="page error">{error}</div>

  return (
    <div className="page">
      <div className="card">
        <h2 style={{ marginBottom: 6 }}>Public Road Accident Risk Map</h2>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 18 }}>
          Guest view — district-level risk. Register to see upazila detail and
          personal alerts.
        </p>

        <div className="map-container">
          <MapContainer
            center={[23.8103, 90.4125]}
            zoom={7}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {districts.map((d) => {
              const coords = DISTRICT_COORDS[d.name]
              if (!coords) return null
              return (
                <CircleMarker
                  key={d.name}
                  center={coords}
                  radius={24}
                  pathOptions={{
                    color: RISK_COLOR[d.risk_level] || '#666',
                    fillColor: RISK_COLOR[d.risk_level] || '#666',
                    fillOpacity: 0.55,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <strong>{d.name}</strong>
                    <br />
                    Risk: <b>{d.risk_level}</b>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>

        <div className="legend">
          <span className="high">High risk</span>
          <span className="medium">Medium risk</span>
          <span className="low">Low risk</span>
        </div>
      </div>
    </div>
  )
}