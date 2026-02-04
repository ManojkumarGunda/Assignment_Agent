import React from 'react';

const AccountInfoCard = ({ email, status, verified, lastLogin }) => {
    return (
        <div className="glass-effect p-8 group hover-lift rounded-[32px] shadow-sm">
            <h2 className="text-2xl font-black text-[#003B46] mb-8 uppercase tracking-tight">Intelligence   Profile</h2>
            <div className="space-y-8">
                <div className="flex items-center gap-6">
                    <div className="bg-[#00A896]/10 p-4 rounded-2xl group-hover:bg-[#00A896]/20 transition-colors">
                        <svg className="w-8 h-8 text-[#00A896]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-[11px] text-[#003B46]/50 font-black uppercase tracking-[2.5px] mb-2 font-mono-tech">Authenticated Identifier</p>
                        <p className="text-lg font-black text-[#003B46]">{email}</p>
                    </div>
                    <div className="flex gap-2">
                        {verified && (
                            <span className="px-4 py-1.5 bg-[#00A896] text-white text-[9px] font-black rounded-full shadow-lg shadow-[#00A896]/20 uppercase tracking-[2px] font-mono-tech">
                                Validated
                            </span>
                        )}
                        {status === 'Active' && (
                            <span className="px-4 py-1.5 bg-[#003B46] text-white text-[9px] font-black rounded-full shadow-lg shadow-[#003B46]/20 uppercase tracking-[2px] font-mono-tech">
                                Online
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-6 pt-8 border-t border-[#00A896]/10">
                    <div className="bg-[#00A896]/10 p-4 rounded-2xl group-hover:bg-[#00A896]/20 transition-colors">
                        <svg className="w-8 h-8 text-[#00A896]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-[11px] text-[#003B46]/50 font-black uppercase tracking-[2.5px] mb-2 font-mono-tech">Terminal Activity</p>
                        <p className="text-lg font-black text-[#003B46]">{lastLogin}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountInfoCard;
