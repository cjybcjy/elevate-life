import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/auth/login', { username, password })
      const { accessToken } = response.data
      login(accessToken)
      navigate('/dashboard')
    } catch (err: unknown) {
      let message = '登录失败，请检查用户名和密码'
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
      <div className="w-full max-w-md p-8 rounded-2xl bg-ledger-surface border border-ledger-primary/20">
        <h1 className="mb-6 text-2xl font-bold text-ledger-text text-center">家庭账本 Pro</h1>
        <p className="mb-6 text-sm text-ledger-muted text-center">登录您的账户</p>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded bg-red-900/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block mb-1 text-sm text-ledger-muted">用户名</label>
            <input
              id="username"
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-ledger-bg border border-gray-700 text-ledger-text focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block mb-1 text-sm text-ledger-muted">密码</label>
            <input
              id="password"
              type="password"
              placeholder="请输入密码"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-ledger-bg border border-gray-700 text-ledger-text focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ledger-muted">
          还没有账户？{' '}
          <Link to="/register" className="text-blue-400 hover:text-blue-300 transition-colors">
            立即注册
          </Link>
        </p>
      </div>
    </div>
  )
}

export default LoginPage
