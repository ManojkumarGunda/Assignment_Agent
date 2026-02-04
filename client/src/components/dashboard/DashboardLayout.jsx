import React from 'react';
import Navbar from '../Navbar';

const DashboardLayout = ({ children, brandName = "Assessment Agent" }) => {
    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
            <Navbar />

            <main className="flex-grow container mx-auto max-w-7xl pt-0 pb-20 px-6 animate-fade-in-up">
                {children}
            </main>

            <footer className="py-16 bg-white border-t border-gray-100 mt-auto overflow-hidden relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-[#00A896]/20 to-transparent"></div>
                <div className="container mx-auto px-6 text-center">
                    <div className="flex flex-col items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[#003B46] flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                            <span className="text-[12px] font-black uppercase tracking-[5px] text-[#003B46]">ASSESSMENT</span>
                        </div>
                        <p className="text-[10px] font-black text-[#003B46]/30 uppercase tracking-[4px]">
                            © 2026 {brandName} PROTOCOL. ALL RIGHTS RESERVED. SECURE   CLUSTER ACTIVE.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default DashboardLayout;
