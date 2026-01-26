import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import DashboardLayout from './dashboard/DashboardLayout'

// NEW: floating bubbles component
// NEW: premium custom interactive cursor bubbles (inspired by premium agency designs)
const FloatingBubbles = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  // Three bubbles with different sizes and speeds for a "trail" effect
  const [b1, setB1] = useState({ x: 0, y: 0 })
  const [b2, setB2] = useState({ x: 0, y: 0 })

  useEffect(() => {
    let tx = window.innerWidth / 2
    let ty = window.innerHeight / 2

    let cx1 = tx, cy1 = ty
    let cx2 = tx, cy2 = ty

    const handleMove = (e) => {
      tx = e.clientX
      ty = e.clientY
      setMousePos({ x: tx, y: ty })
    }

    const animate = () => {
      // Faster easing for tighter following (closer to cursor)
      cx1 += (tx - cx1) * 0.25
      cy1 += (ty - cy1) * 0.25

      cx2 += (tx - cx2) * 0.15
      cy2 += (ty - cy2) * 0.15

      setB1({ x: cx1, y: cy1 })
      setB2({ x: cx2, y: cy2 })

      requestAnimationFrame(animate)
    }

    window.addEventListener('mousemove', handleMove)
    const id = requestAnimationFrame(animate)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      cancelAnimationFrame(id)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {/* SVG Liquid Filter for organic merging */}
      <svg className="hidden">
        <defs>
          <filter id="liquid-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
          </filter>
        </defs>
      </svg>

      {/* Bubble Container */}
      <div className="w-full h-full relative" style={{ filter: 'url(#liquid-goo)' }}>
        {/* Leading Bubble - Smaller and faster */}
        <div
          className="absolute rounded-full bg-gradient-to-tr from-[#00D1FF] via-[#00A896] to-[#0EA5E9] opacity-90"
          style={{
            width: '20px',
            height: '20px',
            left: 0,
            top: 0,
            transform: `translate3d(${b1.x - 10}px, ${b1.y - 10}px, 0)`,
            border: '1px solid rgba(255,255,255,0.6)'
          }}
        />
        {/* Trailing Bubble - Smaller than before */}
        <div
          className="absolute rounded-full bg-gradient-to-tr from-[#0EA5E9] to-[#00A896] opacity-60"
          style={{
            width: '35px',
            height: '35px',
            left: 0,
            top: 0,
            transform: `translate3d(${b2.x - 17.5}px, ${b2.y - 17.5}px, 0)`,
            border: '1px solid rgba(255,255,255,0.3)'
          }}
        />
      </div>

      {/* Precision Center Point */}
      <div
        className="absolute w-1.5 h-1.5 bg-white rounded-full z-[10000] mix-blend-difference"
        style={{
          left: 0,
          top: 0,
          transform: `translate3d(${mousePos.x - 0.75}px, ${mousePos.y - 0.75}px, 0)`
        }}
      />
    </div>
  )
}

const Dashboard = () => {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()

  const [userData, setUserData] = useState({
    name: authUser?.email?.split('@')[0] || 'Member',
    email: authUser?.email || 'member@coastalseven.com',
    status: 'Active',
    verified: true,
    lastLogin: 'Today, 10:45 AM',
    totalLogins: 4,
    activeSessions: 1,
    memberSince: 'January 2024'
  })

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const loginCount = parseInt(localStorage.getItem('loginCount') || '0') + 1
        localStorage.setItem('loginCount', loginCount.toString())

        setUserData(prev => ({
          ...prev,
          totalLogins: loginCount,
          lastLogin: new Date().toLocaleString('en-US', {
            weekday: 'short',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
          })
        }))
      } catch (err) {
        console.error("Failed to fetch dashboard data", err)
      }
    }

    fetchDashboardData()
  }, [])

  const handleNewEvaluation = () => navigate('/services')
  const handleViewHistory = () => navigate('/history')

  return (
    <DashboardLayout brandName="Assessment Agent">
      {/* wrapper so bubbles sit behind everything */}
      <div className="relative min-h-[calc(100vh-80px)] bg-[#F8FAFC] overflow-hidden">
        <FloatingBubbles />

        <div className="max-w-7xl mx-auto pt-16 px-4">
          {/* Welcome Header */}
          <div className="mb-16 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-px w-10 bg-[#00A896]"></span>
              <span className="text-[10px] font-black uppercase tracking-[5px] text-[#00A896]">Command Center Active</span>
            </div>
            <h1 className="text-6xl font-black text-[#020617] mb-4 tracking-tighter leading-none">
              Welcome back, <span className="italic font-serif text-[#00A896]">{userData.name}</span>
            </h1>
            <p className="text-xl text-[#64748B] font-medium max-w-2xl leading-relaxed">
              Initializing intelligence protocols. Your high-precision audit history and real-time  AI Evaluation Engine  metrics are ready for review.
            </p>
          </div>

          {/* Stats Grid - 4 Cards in Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {/* Total Logins */}
            <div
              className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-white/20 hover:shadow-2xl hover:-translate-y-3 transition-all duration-400 group animate-fade-in-up cursor-pointer hover:border-[#0EA5E9]/30"
              style={{ animationDelay: '0.1s' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-[#E3F2FD] to-[#BBDEFB] rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-400 shadow-md">
                  <svg className="w-7 h-7 text-[#0EA5E9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-extrabold text-[#9CA3AF] uppercase tracking-widest mb-3">Total Logins</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-[#003B5C] tracking-tight">{userData.totalLogins}</span>
                <span className="text-sm text-[#9CA3AF] font-semibold">lifetime</span>
              </div>
            </div>

            {/* Active Sessions */}
            <div
              className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-white/20 hover:shadow-2xl hover:-translate-y-3 transition-all duration-400 group animate-fade-in-up cursor-pointer hover:border-[#0EA5E9]/30"
              style={{ animationDelay: '0.2s' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-[#E3F2FD] to-[#BBDEFB] rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-400 shadow-md">
                  <svg className="w-7 h-7 text-[#0EA5E9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-extrabold text-[#9CA3AF] uppercase tracking-widest mb-3">Active Sessions</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-[#003B5C] tracking-tight">{userData.activeSessions}</span>
                <span className="text-sm text-[#9CA3AF] font-semibold">current</span>
              </div>
            </div>

            {/* Account Status */}
            <div
              className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-white/20 hover:shadow-2xl hover:-translate-y-3 transition-all duration-400 group animate-fade-in-up cursor-pointer hover:border-[#10B981]/30"
              style={{ animationDelay: '0.3s' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-400 shadow-md">
                  <svg className="w-7 h-7 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-extrabold text-[#9CA3AF] uppercase tracking-widest mb-3">Account Status</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-[#003B5C] tracking-tight">{userData.status}</span>
                <span className="text-sm text-[#9CA3AF] font-semibold">verified</span>
              </div>
            </div>

            {/* Member Since */}
            <div
              className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-white/20 hover:shadow-2xl hover:-translate-y-3 transition-all duration-400 group animate-fade-in-up cursor-pointer hover:border-[#6366F1]/30"
              style={{ animationDelay: '0.4s' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-[#E0E7FF] to-[#C7D2FE] rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-400 shadow-md">
                  <svg className="w-7 h-7 text-[#6366F1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs font-extrabold text-[#9CA3AF] uppercase tracking-widest mb-3">Member Since</p>
              <span className="text-3xl font-black text-[#003B5C] tracking-tight">{userData.memberSince}</span>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Account Information */}
            <div
              className="bg-white/80 backdrop-blur-xl rounded-3xl p-10 border border-white/20 hover:shadow-2xl hover:-translate-y-2 transition-all duration-400 animate-fade-in-up"
              style={{ animationDelay: '0.5s' }}
            >
              <h2 className="text-3xl font-black text-[#003B5C] mb-8 tracking-tight">
                Account Information
              </h2>

              <div className="space-y-8">
                {/* Email */}
                <div className="flex items-start gap-5 p-6 rounded-2xl hover:bg-[#F9FAFB] transition-all duration-300 group">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#E3F2FD] to-[#BBDEFB] rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-7 h-7 text-[#0EA5E9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-extrabold text-[#9CA3AF] uppercase tracking-widest mb-2">
                      Email Address
                    </p>
                    <p className="text-lg font-black text-[#003B5C] mb-3">{userData.email}</p>
                    <div className="flex gap-2">
                      <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide bg-[#D1FAE5] text-[#059669] hover:bg-[#10B981] hover:text-white transition-all duration-300 cursor-default shadow-sm">
                        ✓ Verified
                      </span>
                      <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide bg-[#DBEAFE] text-[#0284C7] hover:bg-[#0EA5E9] hover:text-white transition-all duration-300 cursor-default shadow-sm">
                        ● Active
                      </span>
                    </div>
                  </div>
                </div>

                {/* Last Login */}
                <div className="flex items-start gap-5 p-6 rounded-2xl hover:bg-[#F9FAFB] transition-all duration-300 border-t border-gray-100 group">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#F3E8FF] to-[#DDD6FE] rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-7 h-7 text-[#7C3AED]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-extrabold text-[#9CA3AF] uppercase tracking-widest mb-2">
                      Last Login
                    </p>
                    <p className="text-lg font-black text-[#003B5C]">{userData.lastLogin}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div
              className="bg-white/80 backdrop-blur-xl rounded-3xl p-10 border border-white/20 hover:shadow-2xl hover:-translate-y-2 transition-all duration-400 animate-fade-in-up"
              style={{ animationDelay: '0.6s' }}
            >
              <h2 className="text-3xl font-black text-[#003B5C] mb-8 tracking-tight">
                Quick Actions
              </h2>

              <div className="space-y-5">
                {/* Start New Evaluation */}
                <button
                  onClick={handleNewEvaluation}
                  className="w-full flex items-center gap-5 p-6 bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] hover:from-[#0284C7] hover:to-[#0369A1] rounded-2xl transition-all duration-400 group shadow-lg hover:shadow-2xl hover:shadow-[#0EA5E9]/30 hover:-translate-y-1"
                >
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 group-hover:rotate-6 transition-all duration-400">
                    <svg className="w-7 h-7 text-[#0EA5E9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-lg font-black text-white tracking-tight">Start New Evaluation</p>
                    <p className="text-sm text-white/90 font-semibold">
                      Evaluate files, PDFs or GitHub repos
                    </p>
                  </div>
                  <svg
                    className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* View History */}
                <button
                  onClick={handleViewHistory}
                  className="w-full flex items-center gap-5 p-6 bg-white hover:bg-[#F9FAFB] rounded-2xl transition-all duration-300 group border-2 border-gray-100 hover:border-[#0EA5E9]/30 hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="w-14 h-14 bg-[#F9FAFB] rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <svg
                      className="w-7 h-7 text-[#6B7280] group-hover:text-[#0EA5E9] transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-lg font-black text-[#003B5C] group-hover:text-[#0EA5E9] transition-colors tracking-tight">
                      View Evaluation History
                    </p>
                    <p className="text-sm text-[#6B7280] font-semibold">
                      Access past evaluations and reports
                    </p>
                  </div>
                  <svg
                    className="w-6 h-6 text-[#6B7280] opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Settings */}
                <button
                  onClick={() => alert('Settings coming soon')}
                  className="w-full flex items-center gap-5 p-6 bg-white hover:bg-[#F9FAFB] rounded-2xl transition-all duration-300 group border-2 border-gray-100 hover:border-[#0EA5E9]/30 hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="w-14 h-14 bg-[#F9FAFB] rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                    <svg
                      className="w-7 h-7 text-[#6B7280] group-hover:text-[#0EA5E9] transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-lg font-black text-[#003B5C] group-hover:text-[#0EA5E9] transition-colors tracking-tight">
                      Account Settings
                    </p>
                    <p className="text-sm text-[#6B7280] font-semibold">
                      Manage preferences and security
                    </p>
                  </div>
                  <svg
                    className="w-6 h-6 text-[#6B7280] opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Dashboard
