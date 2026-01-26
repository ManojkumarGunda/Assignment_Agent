import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Navbar from '../components/Navbar'

const Home = () => {
    const navigate = useNavigate()
    const { user } = useAuth()

    // Background animation circles
    const circles = [
        { size: 'w-96 h-96', color: 'bg-cyan-500/20', blur: 'blur-3xl', position: '-top-20 -left-20' },
        { size: 'w-80 h-80', color: 'bg-emerald-500/20', blur: 'blur-3xl', position: 'top-1/2 -right-20' },
        { size: 'w-64 h-64', color: 'bg-indigo-500/20', blur: 'blur-3xl', position: '-bottom-20 left-1/4' },
    ]

    return (
        <div className="min-h-screen bg-[#020617] text-white overflow-hidden relative selection:bg-cyan-500 selection:text-black">
            {/* Dynamic Background Elements */}
            <div className="fixed inset-0 pointer-events-none">
                {circles.map((c, i) => (
                    <div
                        key={i}
                        className={`absolute rounded-full ${c.size} ${c.color} ${c.blur} ${c.position} animate-pulse`}
                        style={{ animationDuration: `${5 + i * 2}s` }}
                    />
                ))}
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020617]/50 to-[#020617]" />
            </div>

            <Navbar />

            {/* Hero Section */}
            <section className="relative z-10 pt-32 pb-20 px-4">
                <div className="max-w-7xl mx-auto text-center">
                    {user ? (
                        <div className="mb-8 animate-fade-in flex flex-col items-center">
                            <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 backdrop-blur-md mb-3">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                                <span className="text-sm font-bold text-cyan-400 tracking-wide">
                                    Welcome back, {user.email?.split('@')[0]}
                                </span>
                            </div>
                            <p className="text-gray-400 text-sm font-medium tracking-widest uppercase">
                                Ready to achieve greatness today?
                            </p>
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 animate-fade-in">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                            <span className="text-xs font-black uppercase tracking-[4px] text-cyan-400">Intelligence Protocol Loaded</span>
                        </div>
                    )}

                    <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-[0.8] mb-8 animate-slide-up bg-gradient-to-b from-white via-white to-white/20 bg-clip-text text-transparent">
                        EVALUATE <br />
                        <span className="italic font-serif text-[#00A896]">BEYOND</span> LIMITS
                    </h1>

                    <p className="max-w-2xl mx-auto text-xl text-gray-400 font-medium mb-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        “An AI-powered platform to evaluate assignments, review code, and analyze presentations—accurately and efficiently.”
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
                        <button
                            onClick={() => navigate(user ? '/services' : '/login')}
                            className="h-20 px-12 bg-white text-[#020617] rounded-full font-black uppercase tracking-[3px] text-sm hover:bg-cyan-400 transition-all duration-500 shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 group"
                        >
                            Services <span className="inline-block group-hover:translate-x-2 transition-transform ml-2">→</span>
                        </button>
                        <button
                            onClick={() => navigate('/about')}
                            className="h-20 px-12 bg-white/5 backdrop-blur-xl border border-white/10 text-white rounded-full font-black uppercase tracking-[3px] text-sm hover:bg-white/10 transition-all duration-500 hover:border-white/30"
                        >
                            About us
                        </button>
                    </div>
                </div>
            </section>

            {/* Visual Feature Section */}
            <section className="relative z-10 px-4 py-20 overflow-hidden">
                <div className="max-w-7xl mx-auto">
                    <div className="relative group perspective-1000">
                        {/* Mockup Container */}
                        <div className="relative rounded-[40px] overflow-hidden border border-white/10 shadow-2xl bg-[#020617] group-hover:border-cyan-500/50 transition-all duration-700 animate-float">
                            <img
                                src="/assets/platform_mockup_hero.png"
                                alt="Assessment Engine Interface"
                                className="w-full h-auto opacity-80 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.classList.remove('hidden');
                                }}
                            />
                            {/* Fallback generated background if image not found */}
                            <div className="hidden w-full aspect-video bg-gradient-to-br from-[#020617] via-[#003B46] to-[#020617] flex items-center justify-center p-20">
                                <div className="text-center">
                                    <div className="w-20 h-20 bg-cyan-500/20 rounded-3xl mx-auto mb-6 flex items-center justify-center animate-spin-slow">
                                        <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                    <h3 className="text-4xl font-black tracking-tighter">AI MATRIX INITIALIZED</h3>
                                </div>
                            </div>

                            {/* Overlapping Info Cards */}
                            <div className="absolute top-10 right-10 p-8 rounded-[30px] bg-white/5 backdrop-blur-2xl border border-white/10 hidden lg:block hover:-translate-x-4 transition-transform duration-500">
                                <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[4px] mb-2">  Efficiency</p>
                                <p className="text-4xl font-black tracking-tighter uppercase leading-none mb-1">99.8%</p>
                                <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div className="w-full h-full bg-cyan-400 animate-loading-bar" />
                                </div>
                            </div>

                            <div className="absolute bottom-10 left-10 p-8 rounded-[30px] bg-white/5 backdrop-blur-2xl border border-white/10 hidden lg:block hover:translate-x-4 transition-transform duration-500">
                                <p className="text-[10px] font-black text-[#00A896] uppercase tracking-[4px] mb-2">Audit Latency</p>
                                <p className="text-4xl font-black tracking-tighter uppercase leading-none mb-1">&lt; 150ms</p>
                                <div className="flex gap-1 mt-2">
                                    {[...Array(5)].map((_, i) => <div key={i} className="w-4 h-1 bg-[#00A896] rounded-full animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Protocol  s Section */}
            <section className="relative z-10 px-4 py-32 bg-white/5 backdrop-blur-sm border-y border-white/5">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {[
                            { title: 'Repo Audit', desc: 'Deep architectural analysis of GitHub repositories with real-time dependency tracking.', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', color: 'group-hover:text-indigo-400' },
                            { title: 'File Intelligence', desc: 'Natural language extraction and semantic grading for large-scale academic documentation.', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'group-hover:text-[#00A896]' },
                            { title: 'Slide Analytics', desc: 'Computer vision analysis for slide design metrics and content consistency checks.', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z', color: 'group-hover:text-cyan-400' },
                        ].map((node, i) => (
                            <div key={i} className="group p-10 rounded-[40px] border border-white/5 hover:border-white/20 transition-all duration-500 hover:bg-white/[0.02]">
                                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-8 border border-white/10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 text-gray-500 group-hover:bg-white group-hover:text-black">
                                    <svg className="w-8 h-8 transition-colors duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={node.icon} /></svg>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-[5px] text-gray-500 mb-4 tracking-widest">{node.title.toUpperCase()} NODE</p>
                                <h3 className="text-3xl font-black tracking-tighter mb-6 group-hover:translate-x-2 transition-transform duration-300 uppercase italic">0{i + 1}</h3>
                                <p className="text-gray-400 font-medium leading-relaxed italic">"{node.desc}"</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <section className="relative z-10 px-4 py-40 text-center">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-5xl md:text-7xl font-black mb-12 tracking-tighter uppercase leading-none"> Ready to Review <br /> <span className="text-cyan-400">Your History?</span></h2>
                    <button
                        onClick={() => navigate(user ? '/history' : '/login')}
                        className="px-20 py-8 bg-cyan-500 rounded-full text-black font-black uppercase tracking-[5px] text-xs hover:bg-white transition-all duration-500 hover:scale-110 active:scale-95 shadow-[0_0_50px_rgba(6,182,212,0.3)]"
                    >
                        VIEW HISTORY.EXE
                    </button>
                </div>
            </section>

            <footer className="relative z-10 py-12 px-4 border-t border-white/5 text-center text-[10px] font-black uppercase tracking-[8px] text-gray-600">
                © 2026 ASSESSMENT AGENT ALL RIGHTS RESERVED
            </footer>
        </div>
    )
}

export default Home
