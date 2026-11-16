import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import GuestMap from './pages/GuestMap.jsx'
import Register from './pages/Register.jsx'
import Login from './pages/Login.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) setUser(JSON.parse(stored))
  }, [])

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    navigate('/')
  }

  return (
    <>
      <header className="navbar">
        <h1>SotorkoBangladesh</h1>
        <nav>
          <Link to="/">Map</Link>
          {user ? (
            <>
              <span style={{ marginLeft: 20 }}>Hi, {user.name}</span>
              <button className="btn-link" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<GuestMap />} />
        <Route path="/register" element={<Register onLogin={setUser} />} />
        <Route path="/login" element={<Login onLogin={setUser} />} />
      </Routes>
    </>
  )
}
