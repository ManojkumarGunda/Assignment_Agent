import React from 'react';

const QuickActionItem = ({ icon, title, description, onClick }) => (
    <button
        onClick={onClick}
        className="group flex items-center gap-6 p-6 w-full glass-effect rounded-[32px] hover-lift text-left mb-4 shadow-sm border border-white/40 hover:bg-[#00A896]/5 hover:shadow-[0_10px_30px_rgba(0,168,150,0.15)] transition-all duration-500"
    >
        <div className="bg-[#00A896]/10 group-hover:bg-[#00A896] p-4 rounded-2xl transition-all duration-300">
            {React.cloneElement(icon, { className: "w-6 h-6 text-[#00A896] group-hover:text-white transition-colors" })}
        </div>
        <div className="flex-1">
            <h3 className="font-black text-[#003B46] text-sm uppercase tracking-wider mb-1">{title}</h3>
            <p className="text-xs text-[#003B46]/60 font-medium">{description}</p>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
            <svg className="w-6 h-6 text-[#00A896]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        </div>
    </button>
);

const QuickActionsSection = ({ onNewEvaluation, onViewHistory, onUpdateProfile }) => {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-black text-[#003B46] uppercase tracking-tighter">Command Center</h2>
            <div className="grid gap-2">
                <QuickActionItem
                    title="Launch AI Evaluator"
                    description="Initialize specialized assessment agents"
                    icon={
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    }
                    onClick={onNewEvaluation}
                />
                <QuickActionItem
                    title="Generate AI Report"
                    description="Access historical evaluation synthesis"
                    icon={
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    }
                    onClick={onViewHistory}
                />
                <QuickActionItem
                    title="Configure   Profile"
                    description="Manage core account infrastructure"
                    icon={
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    }
                    onClick={onUpdateProfile}
                />
            </div>
        </div>
    );
};

export default QuickActionsSection;
