import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { logout, user } = useAuth();

  const navLinks = [
    { name: 'Dashboard', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'History', path: '/History' },
    { name: 'About', path: '/about' },
  ];

  const isLanding = location.pathname === '/';

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className={`w-full py-4 px-6 md:px-12 flex justify-center sticky top-0 z-50 transition-all duration-500 ${isLanding ? 'bg-transparent' : 'bg-[#f8fbfd]'}`}>
      {/* Inner Pill Container */}
      <div className={`w-full max-w-6xl transition-all duration-500 rounded-full px-10 py-3 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.08)] border ${isLanding
        ? 'bg-white/5 backdrop-blur-2xl border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.3)]'
        : 'bg-white border-gray-50/50'
        }`}>

        {/* Left: Logo and Brand */}
        <Link to="/" className="flex items-center gap-3 decoration-none group transition-all hover:scale-105 active:scale-95">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${isLanding ? 'bg-white/10 group-hover:bg-cyan-400' : 'bg-[#007a7c]'}`}>
            <svg className={`w-6 h-6 ${isLanding ? 'text-white group-hover:text-black' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className={`text-[16px] font-black tracking-tighter uppercase transition-colors duration-500 ${isLanding ? 'text-white' : 'text-[#003B46]'}`}>ASSESSMENT</span>
            <span className={`text-[8px] font-black tracking-[0.4em] uppercase mt-1 transition-colors duration-500 ${isLanding ? 'text-cyan-400' : 'text-[#00A896]'}`}>AGENT</span>
          </div>
        </Link>

        {/* Center: Menu Items (Desktop) */}
        <div className="hidden md:flex items-center gap-12">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className={`text-[11px] font-black uppercase tracking-[3px] nav-link-underline transition-all duration-300 ${isActive(link.path)
                ? (isLanding ? 'text-cyan-400 nav-link-active' : 'text-[#007a7c] nav-link-active')
                : (isLanding ? 'text-white/60 hover:text-white' : 'text-[#4a4a4a] hover:text-[#007a7c]')
                }`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Right: User Profile Section */}
        <div className="flex items-center gap-4">
          {user ? (
            <>
              {/* Grouped User Info */}
              <div className={`hidden lg:flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all duration-500 ${isLanding ? 'bg-white/5 border-white/10' : 'bg-[#f0f9f9]/50 border-[#007a7c]/5'
                }`}>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black italic shadow-sm transition-all duration-500 ${isLanding ? 'bg-cyan-400 text-black' : 'bg-[#007a7c] text-white'
                  }`}>
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <span className={`text-[11px] font-black uppercase tracking-widest transition-colors duration-500 ${isLanding ? 'text-white' : 'text-[#003B46]'}`}>{user?.email?.split('@')[0]}</span>
              </div>

              {/* Logout Symbol */}
              <button
                onClick={logout}
                title="Logout session"
                className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 active:scale-90 ${isLanding ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:text-white hover:bg-red-500'
                  }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="px-8 py-3 bg-cyan-500 text-black rounded-full text-[10px] font-black uppercase tracking-[3px] hover:bg-white transition-all shadow-lg active:scale-95"
            >
              Login.EXE
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className={`md:hidden p-2 transition-colors ${isLanding ? 'text-white' : 'text-gray-400 hover:text-[#007a7c]'}`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className={`absolute top-28 left-6 right-6 backdrop-blur-3xl rounded-[40px] shadow-3xl border p-10 flex flex-col gap-8 md:hidden z-50 transition-all duration-500 ${isLanding ? 'bg-[#020617]/95 border-white/10' : 'bg-white/95 border-white/50'
          }`}>
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              onClick={() => setIsMenuOpen(false)}
              className={`text-2xl font-black tracking-tighter transition-colors ${isActive(link.path)
                ? (isLanding ? 'text-cyan-400' : 'text-[#007a7c]')
                : (isLanding ? 'text-white/40' : 'text-gray-400')
                }`}
            >
              {link.name}
            </Link>
          ))}
          <div className={`mt-4 pt-8 border-t ${isLanding ? 'border-white/5' : 'border-gray-100/50'}`}>
            <button
              onClick={logout}
              className={`w-full h-16 rounded-[24px] font-black flex items-center justify-center gap-4 uppercase tracking-[0.2em] text-sm transition-all ${isLanding ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white' : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              End Session
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
