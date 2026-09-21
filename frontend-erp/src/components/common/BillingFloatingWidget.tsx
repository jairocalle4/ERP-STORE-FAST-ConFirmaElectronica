import React from 'react';
import { createPortal } from 'react-dom';
import { FileText, Loader2, Sparkles, Maximize2 } from 'lucide-react';
import { useBillingQueueStore } from '../../store/useBillingQueueStore';

export const BillingFloatingWidget: React.FC = () => {
    const { activeJob, isModalOpen, reopenModal } = useBillingQueueStore();

    // Only show when there is an active job AND the main modal is minimized
    if (!activeJob || isModalOpen) return null;

    const isProcessing = activeJob.status === 'processing';
    const isSuccess = activeJob.status === 'success';
    const isError = activeJob.status === 'error';

    const content = (
        <div className="fixed bottom-6 right-6 z-[9990] animate-bounce-short">
            <button
                type="button"
                onClick={reopenModal}
                className={`
                    group flex items-center gap-3.5 pl-3.5 pr-4 py-2.5
                    bg-slate-900/90 dark:bg-slate-800/95 backdrop-blur-md
                    text-white rounded-2xl shadow-2xl border transition-all duration-300
                    cursor-pointer hover:scale-105 active:scale-95
                    ${
                        isSuccess
                            ? 'border-emerald-500/50 shadow-emerald-500/20'
                            : isError
                            ? 'border-rose-500/50 shadow-rose-500/20'
                            : 'border-indigo-500/40 shadow-indigo-500/20 hover:border-indigo-400'
                    }
                `}
                title="Click para ver estado detallado de la facturación"
            >
                {/* Icon with animated spinner */}
                <div className="relative flex items-center justify-center">
                    {isProcessing && (
                        <div className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping" />
                    )}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                        isSuccess ? 'bg-emerald-500' : isError ? 'bg-rose-500' : 'bg-gradient-to-tr from-indigo-600 to-sky-500'
                    }`}>
                        {isProcessing ? (
                            <Loader2 size={18} className="animate-spin text-white" />
                        ) : (
                            <FileText size={18} />
                        )}
                    </div>
                </div>

                {/* Text Content */}
                <div className="text-left">
                    <div className="flex items-center gap-1.5 text-xs font-black tracking-wide text-white">
                        <span>
                            {isProcessing ? 'Facturando en 2do plano...' : isSuccess ? '¡Factura autorizada!' : 'Error en facturación'}
                        </span>
                        <Sparkles size={11} className="text-sky-400" />
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                        Venta {activeJob.saleNumber}
                    </div>
                </div>

                {/* Expand Indicator */}
                <div className="pl-1 text-slate-400 group-hover:text-white transition-colors">
                    <Maximize2 size={14} />
                </div>
            </button>
        </div>
    );

    return createPortal(content, document.body);
};
