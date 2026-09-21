import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight, X, Sparkles, Minimize2 } from 'lucide-react';
import { useBillingQueueStore } from '../../store/useBillingQueueStore';

export const BillingProcessingModal: React.FC = () => {
    const { activeJob, isModalOpen, minimizeToBackground, closeModal, clearJob, setGlobalViewSaleId } = useBillingQueueStore();
    const [subtextIndex, setSubtextIndex] = useState(0);

    const subtexts = [
        'Generando XML estructurado bajo estándar SRI...',
        'Firmando digitalmente con tu certificado .p12...',
        'Enviando a servidores del SRI (Recepción SOAP)...',
        'Consultando autorización oficial del comprobante...'
    ];

    useEffect(() => {
        if (activeJob?.status === 'processing') {
            const interval = setInterval(() => {
                setSubtextIndex(prev => (prev + 1) % subtexts.length);
            }, 2500);
            return () => clearInterval(interval);
        }
    }, [activeJob?.status]);

    if (!isModalOpen || !activeJob) return null;

    const isProcessing = activeJob.status === 'processing';
    const isSuccess = activeJob.status === 'success';
    const isError = activeJob.status === 'error';

    const handleViewInvoiceDirectly = () => {
        const saleId = activeJob.saleId;
        clearJob();
        setGlobalViewSaleId(saleId);
    };

    const modalContent = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl shadow-indigo-500/10 p-8 overflow-hidden transition-all text-center">
                
                {/* Ambient glow effect in background */}
                <div className={`absolute -top-24 -left-24 w-56 h-56 rounded-full blur-3xl opacity-30 pointer-events-none transition-colors duration-700 ${
                    isSuccess ? 'bg-emerald-500' : isError ? 'bg-rose-500' : 'bg-indigo-500'
                }`} />
                <div className={`absolute -bottom-24 -right-24 w-56 h-56 rounded-full blur-3xl opacity-30 pointer-events-none transition-colors duration-700 ${
                    isSuccess ? 'bg-teal-500' : isError ? 'bg-amber-500' : 'bg-sky-500'
                }`} />

                {/* Close/Minimize button */}
                <button
                    type="button"
                    onClick={isProcessing ? minimizeToBackground : closeModal}
                    title={isProcessing ? "Continuar en segundo plano" : "Cerrar"}
                    className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer z-10"
                >
                    {isProcessing ? <Minimize2 size={18} /> : <X size={18} />}
                </button>

                {/* ─── STATE: PROCESSING ─── */}
                {isProcessing && (
                    <div className="flex flex-col items-center py-4">
                        {/* Animated Icon with concentric pulse rings */}
                        <div className="relative mb-6 flex items-center justify-center">
                            <div className="absolute w-28 h-28 rounded-full bg-indigo-500/15 animate-ping" />
                            <div className="absolute w-24 h-24 rounded-full bg-sky-500/20 animate-pulse" />
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 via-sky-600 to-indigo-500 shadow-xl shadow-indigo-500/30 flex items-center justify-center text-white relative z-10">
                                <FileText size={38} className="animate-bounce" />
                                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white">
                                    <ShieldCheck size={16} />
                                </div>
                            </div>
                        </div>

                        {/* Title with subtle gradient */}
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                            Facturando tu comprobante...
                        </h3>

                        {/* Sale Identifier */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-black uppercase tracking-wider mb-4">
                            <Sparkles size={12} />
                            Venta {activeJob.saleNumber}
                        </div>

                        {/* Subtext with dynamic stages */}
                        <div className="min-h-[44px] flex items-center justify-center px-4">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-all duration-300">
                                {subtexts[subtextIndex]}
                            </p>
                        </div>

                        {/* Progress bar shimmer */}
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden my-6">
                            <div className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 rounded-full animate-pulse w-full" />
                        </div>

                        {/* ─── PRIMARY ACTION: MINIMIZE TO BACKGROUND ─── */}
                        <div className="w-full pt-2">
                            <button
                                type="button"
                                onClick={minimizeToBackground}
                                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-black text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-98 group"
                            >
                                <span>Puedes seguir usando la app — te avisamos cuando esté lista</span>
                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
                                La autorización ante el SRI continúa en segundo plano de forma segura.
                            </p>
                        </div>
                    </div>
                )}

                {/* ─── STATE: SUCCESS ─── */}
                {isSuccess && (
                    <div className="flex flex-col items-center py-4">
                        <div className="w-20 h-20 rounded-2xl bg-emerald-500 shadow-xl shadow-emerald-500/30 flex items-center justify-center text-white mb-6 animate-scale-up">
                            <CheckCircle2 size={44} />
                        </div>

                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                            ¡Factura Autorizada! 🎉
                        </h3>

                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mb-4">
                            El comprobante electrónico para la venta <strong className="text-slate-700 dark:text-slate-200">{activeJob.saleNumber}</strong> fue autorizado con éxito por el SRI.
                        </p>

                        {activeJob.result?.accessKey && (
                            <div className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl mb-6 text-left font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all">
                                <span className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Clave de Acceso SRI:</span>
                                {activeJob.result.accessKey}
                            </div>
                        )}

                        <div className="w-full flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleViewInvoiceDirectly}
                                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
                            >
                                <FileText size={18} />
                                Ver Factura / RIDE
                            </button>
                            <button
                                type="button"
                                onClick={clearJob}
                                className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm rounded-2xl transition-all cursor-pointer"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── STATE: ERROR ─── */}
                {isError && (
                    <div className="flex flex-col items-center py-4">
                        <div className="w-20 h-20 rounded-2xl bg-rose-500 shadow-xl shadow-rose-500/30 flex items-center justify-center text-white mb-6">
                            <AlertTriangle size={44} />
                        </div>

                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                            Atención en la Facturación
                        </h3>

                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            No se pudo completar la autorización ante el SRI para la venta <strong>{activeJob.saleNumber}</strong>:
                        </p>

                        <div className="w-full p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl mb-6 text-left text-xs text-rose-700 dark:text-rose-300 font-medium">
                            {activeJob.errorMessage || 'El comprobante fue rechazado o el servicio del SRI no respondió.'}
                        </div>

                        <div className="w-full flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleViewInvoiceDirectly}
                                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-black text-sm rounded-2xl shadow-lg transition-all cursor-pointer active:scale-95"
                            >
                                <FileText size={18} />
                                Ver Detalle de Venta
                            </button>
                            <button
                                type="button"
                                onClick={clearJob}
                                className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm rounded-2xl transition-all cursor-pointer"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
