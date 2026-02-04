import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../contexts/AuthContext'

const Login = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (location.state?.message) {
      setSuccess(location.state.message)
    }
  }, [location])

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

    try {
      const response = await api.post('/auth/login', formData)
      if (response.data.token) {
        login(response.data.token, response.data.user)
        const destination = location.state?.from?.pathname || '/services'
        navigate(destination, { replace: true })
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
        setError('Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] px-4 py-10 overflow-hidden relative">
      {/* High-end neon glow background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#00A896]/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
        {/* Left side – brand / copy */}
        <div className="hidden lg:flex flex-col justify-between rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-3xl p-12 shadow-2xl">
          <div>
            <div className="inline-flex items-center gap-4">
              <div className="bg-[#003B46] w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <div className="text-white font-black tracking-tighter text-2xl leading-none uppercase">
                  Assessment Agent
                </div>
                <div className="text-cyan-400 font-black text-[10px] uppercase tracking-[4px] mt-2 italic">
                  AI Evaluation Engine
                </div>
              </div>
            </div>

            <div className="mt-16 space-y-6">
              <div className="text-white font-black text-5xl tracking-tighter leading-[0.9]">
                INITIALIZE <br /> <span className="text-[#00A896]">ASSESSMENT WORKSPACE</span>
              </div>
              <p className="text-gray-400 font-medium text-lg leading-relaxed max-w-sm">
                A centralized platform for assignment uploads, repository tracking, and accurate evaluation
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => <div key={i} className="w-8 h-1 bg-white/10 rounded-full overflow-hidden"><div className="w-full h-full bg-[#00A896] animate-loading-bar" style={{ animationDelay: `${i * 0.2}s` }} /></div>)}
            </div>
            <div className="text-gray-500 font-black text-[9px] uppercase tracking-[5px]">
              SECURE ACCESS  AI Evaluation Engine  ACTIVE
            </div>
          </div>
        </div>

        {/* Right side – form */}
        <div className="w-full rounded-[40px] bg-white p-8 sm:p-10 lg:p-12 shadow-2xl">
          <div className="text-center mb-12">
            <div className="bg-[#020617] w-16 h-16 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl">
              <svg className="w-10 h-10 text-[#00A896]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-4xl font-black text-[#020617] mb-2 tracking-tighter uppercase">
              Welcome  Back
            </h1>
            <p className="text-[#64748B] text-sm font-bold tracking-tight uppercase tracking-[2px]">
              Confirm Your Identity
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {success && (
              <div className="bg-[#D1FAE5] border border-[#10B981]/20 text-[#065F46] px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[2px]">
                {success}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-500/10 text-red-600 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[2px]">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-[10px] font-black text-gray-400 uppercase tracking-[4px] ml-1">Email  </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-3xl focus:ring-4 focus:ring-[#00A896]/10 outline-none transition-all font-black text-[#020617] placeholder:text-gray-300"
                placeholder="USER@PROTOCOL.COM"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label htmlFor="password" className="text-[10px] font-black text-gray-400 uppercase tracking-[4px]">Password</label>
                <button type="button" className="text-[9px] font-black text-[#00A896] uppercase tracking-[2px] hover:text-[#020617] transition-colors"> </button>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-3xl focus:ring-4 focus:ring-[#00A896]/10 outline-none transition-all font-black text-[#020617] placeholder:text-gray-300"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-16 bg-[#020617] text-white rounded-3xl font-black uppercase tracking-[5px] text-xs hover:bg-[#003B46] shadow-xl hover:shadow-2xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Verifying...
                </>
              ) : (
                'Login  '
              )}
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-[3px]">
              No account yet?{' '}
              <Link to="/register" className="text-[#00A896] hover:text-[#020617] transition-colors decoration-underline underline-offset-4">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
