import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import api from '../services/api'

function RegisterPage() {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/auth/register', { username, password, displayName })
      const { accessToken } = response.data
      localStorage.setItem('access_token', accessToken)
      navigate('/net-worth')
    } catch (err: unknown) {
      let message = 'Registration failed'
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.message || err.message || message
      } else if (err instanceof Error) {
        message = err.message
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-ledger-bg">
      <div className="w-full max-w-md p-8 rounded-lg bg-ledger-surface">
        <h1 className="mb-6 text-2xl font-bold text-ledger-text">Register</h1>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded bg-red-900/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block mb-1 text-sm text-ledger-muted">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-ledger-bg border border-gray-700 text-ledger-text focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="displayName" className="block mb-1 text-sm text-ledger-muted">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-ledger-bg border border-gray-700 text-ledger-text focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block mb-1 text-sm text-ledger-muted">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-ledger-bg border border-gray-700 text-ledger-text focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ledger-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}

export default RegisterPage
