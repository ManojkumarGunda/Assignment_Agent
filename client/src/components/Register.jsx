import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../contexts/AuthContext'

const Register = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      const response = await api.post('/auth/register', {
        email: formData.email,
        password: formData.password
      })

      if (response.data.message) {
        try {
          const loginResponse = await api.post('/auth/login', {
            email: formData.email,
            password: formData.password
          })
          if (loginResponse.data.token) {
            login(loginResponse.data.token, loginResponse.data.user)
            navigate('/services')
          }
        } catch (loginErr) {
          navigate('/login', { state: { message: 'Account created! Please sign in.' } })
        }
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (Array.isArray(detail)) {
        setError(detail.map(e => e.msg).join(', '))
      } else if (typeof detail === 'object' && detail !== null) {
        setError(JSON.stringify(detail))
      } else {
        setError(err.response?.data?.detail || 'Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] px-4 py-10 overflow-hidden relative">
      {/* High-end neon glow background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#00A896]/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1.5s' }}></div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
        {/* Left side – brand / copy */}
        <div className="hidden lg:flex flex-col justify-between rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-3xl p-12 shadow-2xl">
          <div>
            <div className="inline-flex items-center gap-4">
              <div className="bg-[#003B46] w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <div className="text-white font-black tracking-tighter text-2xl leading-none uppercase">
                  Assessment Agent
                </div>
                <div className="text-cyan-400 font-black text-[10px] uppercase tracking-[4px] mt-2 italic">
                  Join Us
                </div>
              </div>
            </div>

            <div className="mt-16 space-y-6">
              <div className="text-white font-black text-5xl tracking-tighter leading-[0.9]">
                JOIN THE <br /> <span className="text-[#00A896]">WORKSPACE</span>
              </div>
              <p className="text-gray-400 font-medium text-lg leading-relaxed max-w-sm">
                Initialize your personal intelligence  . Gain access to sub-millisecond evaluation cycles and secure history archives.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => <div key={i} className="w-8 h-1 bg-white/10 rounded-full overflow-hidden"><div className="w-full h-full bg-cyan-400 animate-loading-bar" style={{ animationDelay: `${i * 0.25}s` }} /></div>)}
            </div>
            <div className="text-gray-500 font-black text-[9px] uppercase tracking-[5px]">
              NEURAL HANDSHAKE INITIALIZED
            </div>
          </div>
        </div>

        {/* Right side – form */}
        <div className="w-full rounded-[40px] bg-white p-8 sm:p-10 lg:p-12 shadow-2xl">
          <div className="text-center mb-12">
            <div className="bg-[#020617] w-16 h-16 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl">
              <svg className="w-10 h-10 text-[#00A896]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h1 className="text-4xl font-black text-[#020617] mb-2 tracking-tighter uppercase">
              Create Account
            </h1>
            <p className="text-[#64748B] text-sm font-bold tracking-tight uppercase tracking-[2px]">
              Create Account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-500/10 text-red-600 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[2px]">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="email" className="text-[10px] font-black text-gray-400 uppercase tracking-[4px] ml-1">Email  </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-3xl focus:ring-4 focus:ring-[#00A896]/10 outline-none transition-all font-black text-[#020617] placeholder:text-gray-300"
                placeholder="USER@PROTOCOL.COM"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-[10px] font-black text-gray-400 uppercase tracking-[4px] ml-1">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-3xl focus:ring-4 focus:ring-[#00A896]/10 outline-none transition-all font-black text-[#020617] placeholder:text-gray-300"
                placeholder="********"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="text-[10px] font-black text-gray-400 uppercase tracking-[4px] ml-1">Re-enter Password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-3xl focus:ring-4 focus:ring-[#00A896]/10 outline-none transition-all font-black text-[#020617] placeholder:text-gray-300"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-16 bg-[#020617] text-white rounded-3xl font-black uppercase tracking-[5px] text-xs hover:bg-cyan-500 hover:text-black shadow-xl hover:shadow-2xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Registering...
                </>
              ) : (
                'Register'
              )}
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-[3px]">
              Already have an account?{' '}
              <Link to="/login" className="text-[#00A896] hover:text-[#020617] transition-colors decoration-underline underline-offset-4">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register
