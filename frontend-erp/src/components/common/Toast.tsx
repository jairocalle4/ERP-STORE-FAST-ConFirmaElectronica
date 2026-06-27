import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useNotificationStore } from '../../store/useNotificationStore';

const iconMap = {
    success: <CheckCircle className="text-emerald-500" size={20} />,
    error: <XCircle className="text-rose-500" size={20} />,
    warning: <AlertCircle className="text-amber-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />,
};

const bgMap = {
    success: 'bg-emerald-50/90 border-emerald-100 shadow-emerald-500/10',
    error: 'bg-rose-50/90 border-rose-100 shadow-rose-500/10',
    warning: 'bg-amber-50/90 border-amber-100 shadow-amber-500/10',
    info: 'bg-blue-50/90 border-blue-100 shadow-blue-500/10',
};

export const Toast: React.FC = () => {
    const { notifications, removeNotification, clearAll } = useNotificationStore();

    if (notifications.length === 0) return null;

    const content = (
        <div className="fixed top-6 right-6 z-[9999] flex flex-col items-end gap-3 pointer-events-none">
            <style>{`
                @keyframes toastProgress {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
            {notifications.length > 1 && (
                <button
                    onClick={clearAll}
                    className="pointer-events-auto px-4 py-2 bg-slate-900/90 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-95 animate-fade-in flex items-center gap-2 mb-2 cursor-pointer"
                >
                    <X size={14} /> Borrar Todo ({notifications.length})
                </button>
            )}
            {notifications.map((n) => (
                <div
                    key={n.id}
                    className={`
                        pointer-events-auto
                        flex items-center gap-3 pl-4 pr-3 pt-3 pb-4 min-w-[320px] max-w-md
                        backdrop-blur-md border rounded-2xl shadow-xl
                        animate-fade-in transition-all duration-300
                        relative overflow-hidden
                        ${bgMap[n.type] || bgMap.info}
                    `}
                >
                    <div className="flex-shrink-0">{iconMap[n.type] || iconMap.info}</div>
                    <div className="flex-1 text-sm font-bold text-slate-800">
                        {n.message}
                    </div>
                    <button
                        onClick={() => removeNotification(n.id)}
                        className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors pointer-events-auto cursor-pointer p-1 rounded-lg hover:bg-black/5"
                    >
                        <X size={16} />
                    </button>
                    {/* Barra de progreso animada pegada a la notificación */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5">
                        <div
                            className={`h-full ${
                                n.type === 'success' ? 'bg-emerald-500' :
                                n.type === 'error' ? 'bg-rose-500' :
                                n.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                            }`}
                            style={{
                                animation: `toastProgress ${n.duration || 3000}ms linear forwards`
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );

    return createPortal(content, document.body);
};
