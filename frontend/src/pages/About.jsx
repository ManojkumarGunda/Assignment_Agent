import React from 'react'
import DashboardLayout from '../components/dashboard/DashboardLayout'

const About = () => {
  return (
    <DashboardLayout brandName="Assessment Agent">
      <div className="min-h-[calc(100vh-80px)] bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto pt-16 px-4">
          <div className="mb-20 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-px w-10 bg-[#00A896]"></span>
              <span className="text-[10px] font-black uppercase tracking-[5px] text-[#00A896]">About Us</span>
            </div>
            <h1 className="text-6xl font-black text-[#020617] mb-6 tracking-tighter leading-none">
              THE <span className="italic font-serif text-[#00A896]">PROTOCOL</span>
            </h1>
            <p className="text-xl text-[#64748B] font-medium max-w-3xl leading-relaxed">
              Assessment Agent   Protocol is a state-of-the-art AI evaluation engine designed for extreme accuracy in auditing codebases, academic documentation, and presentation logic. Our neural architecture eliminates human bias and scales evaluation latency to sub-millisecond cycles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-24">
            {/* Core Capability 01 */}
            <div className="group bg-white rounded-[40px] p-10 border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-4">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-8 text-[#6366F1] group-hover:bg-[#6366F1] group-hover:text-white transition-all shadow-inner">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              </div>
              <p className="text-[10px] font-black text-[#6366F1] uppercase tracking-[4px] mb-4">  </p>
              <h3 className="text-2xl font-black text-[#020617] mb-4 uppercase">Repo Audit</h3>
              <p className="text-[#64748B] font-medium leading-relaxed italic">
                Advanced architectural analysis of GitHub repositories. Detecting technology stack mismatches and satisfying complex compliance rules.
              </p>
            </div>

            {/* Core Capability 02 */}
            <div className="group bg-white rounded-[40px] p-10 border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-4">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-8 text-[#00A896] group-hover:bg-[#00A896] group-hover:text-white transition-all shadow-inner">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <p className="text-[10px] font-black text-[#00A896] uppercase tracking-[4px] mb-4">  </p>
              <h3 className="text-2xl font-black text-[#020617] mb-4 uppercase">File Intel</h3>
              <p className="text-[#64748B] font-medium leading-relaxed italic">
                Cross-document semantic grading for PDF, DOCX, and TXT files. Extracting intelligence from student assignments with machine precision.
              </p>
            </div>

            {/* Core Capability 03 */}
            <div className="group bg-white rounded-[40px] p-10 border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-4">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-8 text-[#0EA5E9] group-hover:bg-[#0EA5E9] group-hover:text-white transition-all shadow-inner">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
              </div>
              <p className="text-[10px] font-black text-[#0EA5E9] uppercase tracking-[4px] mb-4"> </p>
              <h3 className="text-2xl font-black text-[#020617] mb-4 uppercase">Slide Logic</h3>
              <p className="text-[#64748B] font-medium leading-relaxed italic">
                Evaluates visual design hierarchy and content consistency in presentation decks. Merging aesthetic metrics with logical accuracy.
              </p>
            </div>
          </div>

          <div className="bg-[#020617] rounded-[50px] p-16 text-white relative overflow-hidden group mb-24">
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity font-black text-[150px] leading-none select-none">AI AGENT</div>
            <div className="relative z-10">
              <h2 className="text-[10px] font-black uppercase tracking-[10px] mb-8 text-[#00A896]">The Mission</h2>
              <p className="text-4xl font-black tracking-tighter leading-tight mb-10 max-w-4xl">
                To build the foundation of <span className="text-[#00A896]">Automated Intelligence</span>. Fast, Reliable, and Unbiased evaluation for every Tasks workflow.
              </p>
              <div className="flex flex-wrap gap-12 border-t border-white/10 pt-10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[4px] text-gray-500 mb-2">Evaluations Sync</p>
                  <p className="text-2xl font-black tracking-tight">100% SECURE</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[4px] text-gray-500 mb-2">Audit Latency</p>
                  <p className="text-2xl font-black tracking-tight">&lt; 150MS</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[4px] text-gray-500 mb-2">Uptime Protocol</p>
                  <p className="text-2xl font-black tracking-tight">99.9% LIVE</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default About
