import React from 'react';

const StatCard = ({ title, value, icon, color, helperText }) => {
    return (
        <div className="glass-effect p-6 group hover-lift rounded-[32px] shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-2xl bg-[#00A896]/10 group-hover:bg-[#00A896]/20 transition-colors">
                    {React.cloneElement(icon, { className: `w-6 h-6 ${color}` })}
                </div>
            </div>
            <div className="space-y-3">
                <p className="text-[#003B46]/60 text-[10px] font-black uppercase tracking-[2px] font-mono-tech">{title}</p>
                <div className="flex flex-col gap-1">
                    <p className="text-3xl font-extrabold text-[#003B46] tracking-tighter">{value}</p>
                    {helperText && (
                        <span className="text-[9px] font-bold text-[#00A896] uppercase tracking-wider font-mono-tech opacity-80">
                            {helperText}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatCard;
