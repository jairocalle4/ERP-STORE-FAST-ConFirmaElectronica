import React, { useState, useEffect } from 'react';
import { cashRegisterService, type CashRegisterSession, type CashRegisterSummary } from '../services/cash-register.service';
import { useNotificationStore } from '../store/useNotificationStore';
import {
    Coins, ArrowUpCircle, ArrowDownCircle, Wallet,
    AlertCircle, Clock, CheckCircle2, History,
    Plus, Minus, Info, X, Calculator, ArrowRight, Eye, Trash2, Loader2
} from 'lucide-react';

const CashRegisterPage: React.FC = () => {
    const [status, setStatus] = useState<CashRegisterSession | null>(null);
    const [summary, setSummary] = useState<CashRegisterSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [openAmount, setOpenAmount] = useState<string>('');
    const [closeAmount, setCloseAmount] = useState<string>('');
    const [closeNotes, setCloseNotes] = useState('');
    const [showCloseModal, setShowCloseModal] = useState(false);

    // Submission guards — prevent double-click
    const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
    const [isSubmittingOpen, setIsSubmittingOpen] = useState(false);
    const [isSubmittingClose, setIsSubmittingClose] = useState(false);
    const [deletingTransactionId, setDeletingTransactionId] = useState<number | null>(null);

    // Custom confirm modal (replaces window.confirm)
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        transactionId: number | null;
        description: string;
    }>({ open: false, transactionId: null, description: '' });

    // Transaction Modal
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [transactionType, setTransactionType] = useState<'Income' | 'Expense'>('Income');
    const [transactionAmount, setTransactionAmount] = useState('');
    const [transactionDesc, setTransactionDesc] = useState('');

    const [history, setHistory] = useState<CashRegisterSession[]>([]);
    
    // Denominations Count
    const [denominationInputs, setDenominationInputs] = useState<{ [key: string]: string }>({});

    // Audit Details Modal State
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [sessionDetails, setSessionDetails] = useState<{
        session: CashRegisterSession;
        manualTransactions: any[];
        sales: any[];
        expenses: any[];
    } | null>(null);

    const handleViewDetails = async (sessionId: number) => {
        setDetailsLoading(true);
        setShowDetailsModal(true);
        try {
            const data = await cashRegisterService.getSessionDetails(sessionId);
            setSessionDetails(data);
        } catch (error) {
            console.error(error);
            addNotification('Error al cargar los detalles de auditoría', 'error');
            setShowDetailsModal(false);
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleViewCurrentSession = async () => {
        setDetailsLoading(true);
        setShowDetailsModal(true);
        try {
            const data = await cashRegisterService.getCurrentSessionDetails();
            setSessionDetails(data);
        } catch (error) {
            console.error(error);
            addNotification('Error al cargar los movimientos de la sesión activa', 'error');
            setShowDetailsModal(false);
        } finally {
            setDetailsLoading(false);
        }
    };

    const { addNotification } = useNotificationStore();

    useEffect(() => {
        fetchStatus();
        fetchHistory();
    }, []);

    useEffect(() => {
        if (status?.status === 'Open') {
            fetchSummary();
        } else {
            setSummary(null);
        }
    }, [status]);

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const data = await cashRegisterService.getStatus();
            setStatus(data || null);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const data = await cashRegisterService.getHistory();
            setHistory(data || []);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSummary = async () => {
        try {
            const data = await cashRegisterService.getSummary();
            setSummary(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleOpenSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmittingOpen) return; // Guard against double submit
        setIsSubmittingOpen(true);
        try {
            await cashRegisterService.openSession(Number(openAmount));
            addNotification('Caja abierta correctamente', 'success');
            fetchStatus();
            fetchHistory();
        } catch (error: any) {
            addNotification(error.response?.data || 'Error al abrir caja', 'error');
        } finally {
            setIsSubmittingOpen(false);
        }
    };

    const handleCloseSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmittingClose) return; // Guard against double submit
        setIsSubmittingClose(true);
        try {
            const notesPayload = JSON.stringify({
                userNotes: closeNotes,
                denominations: denominationInputs
            });
            await cashRegisterService.closeSession(Number(closeAmount), notesPayload);
            addNotification('Caja cerrada correctamente', 'success');
            setShowCloseModal(false);
            fetchStatus();
            fetchHistory();
            setCloseAmount('');
            setCloseNotes('');
            setDenominationInputs({});
        } catch (error: any) {
            addNotification(error.response?.data || 'Error al cerrar caja', 'error');
        } finally {
            setIsSubmittingClose(false);
        }
    };

    const handleAddTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmittingTransaction) return; // Guard against double-click
        setIsSubmittingTransaction(true);
        try {
            await cashRegisterService.addTransaction(transactionType, Number(transactionAmount), transactionDesc);
            addNotification('Movimiento registrado satisfactoriamente', 'success');
            setShowTransactionModal(false);
            setTransactionAmount('');
            setTransactionDesc('');
            fetchSummary();
        } catch (error: any) {
            addNotification('Error al registrar movimiento', 'error');
        } finally {
            setIsSubmittingTransaction(false);
        }
    };

    // Opens the custom confirm modal (does NOT delete yet)
    const handleDeleteTransaction = (transactionId: number, description: string) => {
        setConfirmModal({ open: true, transactionId, description });
    };

    // Called when user clicks "Confirmar" inside the custom modal
    const confirmDeleteNow = async () => {
        const transactionId = confirmModal.transactionId;
        if (!transactionId) return;
        setConfirmModal({ open: false, transactionId: null, description: '' });
        if (deletingTransactionId !== null) return;
        setDeletingTransactionId(transactionId);
        try {
            await cashRegisterService.deleteTransaction(transactionId);
            addNotification('Movimiento eliminado', 'success');
            if (sessionDetails?.session?.status === 'Open') {
                const data = await cashRegisterService.getCurrentSessionDetails();
                setSessionDetails(data);
            } else if (sessionDetails?.session?.id) {
                const data = await cashRegisterService.getSessionDetails(sessionDetails.session.id);
                setSessionDetails(data);
            }
            fetchSummary();
        } catch (error: any) {
            addNotification(error.response?.data || 'Error al eliminar el movimiento', 'error');
        } finally {
            setDeletingTransactionId(null);
        }
    };

    if (loading) {
        return (
            <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="font-bold text-slate-400 animate-pulse">Cargando estado de caja...</p>
            </div>
        );
    }

    const isClosed = !status || status.status !== 'Open';

    return (
        <>
            {isClosed ? (
                <div className="p-4 md:p-8 space-y-12 max-w-7xl mx-auto pb-20">
                    <div className="flex items-center justify-center pt-10">
                        <div className="max-w-xl w-full">
                            <div className="bg-white/40 backdrop-blur-xl p-8 md:p-12 rounded-[2.5rem] border border-white/60 shadow-2xl shadow-indigo-500/10 text-center animate-scale-in">
                                <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-200 relative">
                                    <Wallet className="w-12 h-12 text-white" />
                                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-rose-500 rounded-full border-4 border-white flex items-center justify-center">
                                        <Minus className="w-4 h-4 text-white" strokeWidth={4} />
                                    </div>
                                </div>

                                <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-3">La caja está cerrada</h2>
                                <p className="text-slate-500 font-medium mb-10 max-w-sm mx-auto">
                                    Para comenzar a procesar ventas en efectivo y registrar movimientos, primero debes abrir una nueva sesión de caja.
                                </p>

                                <form onSubmit={handleOpenSession} className="space-y-6">
                                    <div className="text-left group">
                                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">
                                            Monto Inicial en Efectivo
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-600 font-black text-xl">$</div>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="w-full pl-12 pr-6 py-5 bg-white border border-indigo-100 rounded-[1.5rem] focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all outline-none text-2xl font-black text-slate-800 placeholder:text-slate-200"
                                                placeholder="0.00"
                                                value={openAmount}
                                                onChange={(e) => setOpenAmount(e.target.value)}
                                                required
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmittingOpen}
                                        className="w-full bg-slate-900 hover:bg-slate-800 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                                    >
                                        {isSubmittingOpen ? (
                                            <><Loader2 size={20} className="animate-spin" /> Abriendo...</>
                                        ) : (
                                            <><CheckCircle2 size={20} className="text-emerald-400" /> Abrir Caja Ahora</>
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* History section for closed state */}
                    <CashHistory history={history} onViewDetails={handleViewDetails} />
                </div>
            ) : (
                <div className="p-4 md:p-8 animate-fade-in max-w-7xl mx-auto space-y-8 pb-20">
            {/* Header section */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tighter">Sesión de Caja Activa</h1>
                    </div>
                    <div className="flex items-center gap-4 text-slate-500 font-medium">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-100 rounded-full text-xs">
                            <Clock size={12} className="text-indigo-400" />
                            Apertura: {new Date(status.openTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-100 rounded-full text-xs">
                            <Plus size={12} className="text-emerald-400" strokeWidth={3} />
                            Inició con: ${status.openAmount.toFixed(2)}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleViewCurrentSession}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-white border border-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                    >
                        <Eye size={18} className="text-indigo-500" />
                        Ver Movimientos
                    </button>
                    <button
                        onClick={() => {
                            setTransactionType('Income');
                            setShowTransactionModal(true);
                        }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-white border border-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                    >
                        <Plus size={18} className="text-indigo-600" strokeWidth={3} />
                        Movimiento
                    </button>
                    <button
                        onClick={() => setShowCloseModal(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-4 bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-rose-600 transition-all shadow-lg shadow-rose-200 active:scale-95 whitespace-nowrap"
                    >
                        <AlertCircle size={18} />
                        Cerrar Caja
                    </button>
                </div>
            </header>

            {/* Main Stats Summary */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6">
                    {/* Tarjeta Base Inicial */}
                    <div className="group bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
                                <Wallet size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Base Inicial</p>
                                <p className="text-xl font-black text-slate-800">${summary.openAmount.toFixed(2)}</p>
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 w-full opacity-30"></div>
                        </div>
                        <p className="text-[10px] font-medium text-slate-400 mt-2">Monto inicial de apertura</p>
                    </div>

                    {/* Ventas en Efectivo */}
                    <div className="group bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-emerald-500/5 transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
                                <ArrowUpCircle size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Ventas Efectivo</p>
                                <p className="text-xl font-black text-slate-800">+${summary.cashSales.toFixed(2)}</p>
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 w-[60%]"></div>
                        </div>
                        <p className="text-[10px] font-medium text-slate-400 mt-2">Ventas POS registradas</p>
                    </div>

                    {/* Ingresos Manuales / Servicios */}
                    <div className="group bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-teal-500/5 transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
                                <Plus size={20} strokeWidth={3} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Ingresos Trabajos</p>
                                <p className="text-xl font-black text-slate-800">+${summary.manualIncome.toFixed(2)}</p>
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-500 w-[40%]"></div>
                        </div>
                        <p className="text-[10px] font-medium text-slate-400 mt-2">Copias, investigaciones, etc.</p>
                    </div>

                    {/* Gastos / Salidas */}
                    <div className="group bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-rose-500/5 transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
                                <ArrowDownCircle size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Salidas / Gastos</p>
                                <p className="text-xl font-black text-rose-600">-${(summary.expenses + summary.manualExpense).toFixed(2)}</p>
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 w-[20%]"></div>
                        </div>
                        <p className="text-[10px] font-medium text-slate-400 mt-2">Egresos y pagos de caja</p>
                    </div>

                    {/* Utilidad / Ganancia del Día */}
                    <div className="group bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-[2rem] shadow-xl shadow-emerald-500/20 text-white transition-all transform hover:-translate-y-1">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-white/20 text-white rounded-2xl flex items-center justify-center backdrop-blur-md">
                                <Calculator size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest">Utilidad del Día</p>
                                <p className="text-2xl font-black text-white">
                                    +${((summary.cashSales + summary.manualIncome) - (summary.expenses + summary.manualExpense)).toFixed(2)}
                                </p>
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-emerald-100/80 leading-tight">
                            Ganancia neta del día (Ventas + Trabajos - Gastos)
                        </p>
                    </div>

                    {/* Balance Calculado */}
                    <div className="group bg-slate-900 p-6 rounded-[2rem] shadow-2xl shadow-slate-900/20 text-white transition-all transform hover:-translate-y-1">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-white/10 text-emerald-400 rounded-2xl flex items-center justify-center">
                                <Coins size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest italic">Efectivo Esperado</p>
                                <p className="text-2xl font-black text-white tracking-tighter">${summary.calculatedBalance.toFixed(2)}</p>
                            </div>
                        </div>
                        <p className="text-[10px] font-medium text-white/50 leading-tight">Efectivo total en cajón (Base + Ganancias)</p>
                    </div>
                </div>
            )}

            {/* Info Section */}
            <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-md">
                        <Info size={40} className="text-white" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-xl font-black mb-2 uppercase tracking-tight">Recordatorio de Seguridad</h3>
                        <p className="text-indigo-100 font-medium">Recuerda contar el dinero físico periódicamente y registrar cualquier salida de efectivo (pagos a proveedores, cambio, etc.) para mantener el arqueo al día </p>
                    </div>
                    <button
                        onClick={() => window.location.href = '/pos'}
                        className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50 transition-all active:scale-95"
                    >
                        Ir al POS
                    </button>
                </div>
            </div>

            {/* History Section */}
            <CashHistory history={history} onViewDetails={handleViewDetails} />
            </div>
            )}

            {/* Modal de Cierre */}
            {showCloseModal && (
                <div className="fixed inset-0 z-[110] bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.3)] w-full max-w-2xl overflow-hidden animate-scale-in border border-slate-100 max-h-[90vh] flex flex-col">
                        <div className="p-8 pb-4 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Cerrar Sesión</h2>
                                <p className="text-sm font-bold text-slate-400">Cuenta el dinero físico por denominación.</p>
                            </div>
                            <button onClick={() => setShowCloseModal(false)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar p-8 pt-2 space-y-6">
                            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shrink-0 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Balance Esperado en Cajón</span>
                                        <span className="text-3xl font-black text-indigo-600">${summary?.calculatedBalance.toFixed(2)}</span>
                                    </div>
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                                        <Calculator size={20} className="text-slate-400" />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/60">
                                    <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Base Inicial (Apertura)</span>
                                        <span className="font-black text-slate-700 text-sm">${summary?.openAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                        <span className="block text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Utilidad / Ganancia del Día</span>
                                        <span className="font-black text-emerald-700 text-sm">
                                            +${((summary?.cashSales || 0) + (summary?.manualIncome || 0) - (summary?.expenses || 0) - (summary?.manualExpense || 0)).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <DenominationCounter
                                onChange={(total, inputs) => {
                                    setCloseAmount(total.toFixed(2));
                                    setDenominationInputs(inputs);
                                }}
                            />

                            <div className="space-y-3">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest pl-1">
                                    Dinero Físico Total
                                </label>
                                <div className="relative">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-800 font-bold text-xl">$</div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full pl-10 pr-6 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all outline-none text-3xl font-black text-slate-800"
                                        placeholder="0.00"
                                        value={closeAmount}
                                        readOnly
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold pl-1">
                                    * Calculado automáticamente según las denominaciones ingresadas.
                                </p>
                            </div>

                            {closeAmount && summary && (
                                <div className={`px-6 py-4 rounded-2xl flex items-center gap-3 animate-fade-in ${Math.abs(Number(closeAmount) - summary.calculatedBalance) < 0.01
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700 font-black'
                                    }`}>
                                    {Math.abs(Number(closeAmount) - summary.calculatedBalance) < 0.01 ? (
                                        <CheckCircle2 size={18} />
                                    ) : (
                                        <AlertCircle size={18} />
                                    )}
                                    <span className="text-sm">
                                        Diferencia: <b>${(Number(closeAmount) - summary.calculatedBalance).toFixed(2)}</b>
                                    </span>
                                </div>
                            )}

                            <div className="space-y-3">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest pl-1">
                                    Observaciones Finales
                                </label>
                                <textarea
                                    className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all text-sm font-medium min-h-[80px]"
                                    value={closeNotes}
                                    onChange={(e) => setCloseNotes(e.target.value)}
                                    placeholder="Detalla cualquier novedad en el cuadre..."
                                ></textarea>
                            </div>

                            <button
                                onClick={handleCloseSession}
                                disabled={isSubmittingClose}
                                className="w-full py-5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-rose-200 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                            >
                                {isSubmittingClose ? (
                                    <><Loader2 size={16} className="animate-spin" /> Cerrando caja...</>
                                ) : (
                                    <>Confirmar y Cerrar Caja <ArrowRight size={16} /></>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Movimiento Manual */}
            {showTransactionModal && (
                <div className="fixed inset-0 z-[110] bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="p-8 pb-4 flex justify-between items-center">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Nuevo Movimiento</h2>
                            <button onClick={() => setShowTransactionModal(false)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddTransaction} className="p-8 pt-4 space-y-6">
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                                <button
                                    type="button"
                                    onClick={() => setTransactionType('Income')}
                                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${transactionType === 'Income' ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <Plus size={14} strokeWidth={4} /> Ingreso
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTransactionType('Expense')}
                                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${transactionType === 'Expense' ? 'bg-white shadow text-rose-600' : 'text-slate-400'}`}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <Minus size={14} strokeWidth={4} /> Egreso
                                    </div>
                                </button>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Monto ($)</label>
                                <div className="relative">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-800 font-bold text-lg">$</div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full pl-10 pr-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all text-xl font-black text-slate-800"
                                        value={transactionAmount}
                                        onChange={(e) => setTransactionAmount(e.target.value)}
                                        required
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Descripción</label>
                                <input
                                    type="text"
                                    className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all text-sm font-medium"
                                    placeholder="Ej: Pago de almuerzos, cambio inicial..."
                                    value={transactionDesc}
                                    onChange={(e) => setTransactionDesc(e.target.value)}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmittingTransaction}
                                className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-indigo-200 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                            >
                                {isSubmittingTransaction ? (
                                    <><Loader2 size={16} className="animate-spin" /> Registrando...</>
                                ) : (
                                    'Registrar Movimiento'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Auditoría de Sesión (Detalles) */}
            {showDetailsModal && (
                <div className="fixed inset-0 z-[110] bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.3)] w-full max-w-3xl overflow-hidden animate-scale-in border border-slate-100 max-h-[90vh] flex flex-col">
                        <div className="p-8 pb-4 flex justify-between items-center shrink-0 border-b border-slate-100">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Detalles de Auditoría</h2>
                                <p className="text-sm font-bold text-slate-400">
                                    Sesión #{sessionDetails?.session.id} — {sessionDetails?.session.status === 'Open' ? 'En curso' : 'Cerrada'}
                                </p>
                            </div>
                            <button onClick={() => { setShowDetailsModal(false); setSessionDetails(null); }} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar p-8 space-y-6">
                            {detailsLoading ? (
                                <div className="text-center py-12 text-slate-500 font-bold">Cargando detalles de sesión...</div>
                            ) : sessionDetails ? (
                                <>
                                    {/* Resumen Principal */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Usuario</span>
                                            <span className="text-sm font-bold text-slate-800">{sessionDetails.session.user?.username || 'Sistema'}</span>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Apertura</span>
                                            <span className="text-xs font-bold text-slate-800">{new Date(sessionDetails.session.openTime).toLocaleString('es-EC')}</span>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Cierre</span>
                                            <span className="text-xs font-bold text-slate-800">
                                                {sessionDetails.session.closeTime ? new Date(sessionDetails.session.closeTime).toLocaleString('es-EC') : 'Activa'}
                                            </span>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Diferencia</span>
                                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${sessionDetails.session.discrepancy === 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                                                ${sessionDetails.session.discrepancy.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Valores Financieros */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Base Inicial</span>
                                            <span className="text-lg font-black text-slate-700">${sessionDetails.session.openAmount.toFixed(2)}</span>
                                        </div>
                                        <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
                                            <span className="block text-[9px] font-black text-emerald-600 uppercase tracking-wider mb-1">Utilidad en Caja</span>
                                            <span className="text-lg font-black text-emerald-700">
                                                +${(sessionDetails.session.calculatedAmount - sessionDetails.session.openAmount).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Efectivo Esperado</span>
                                            <span className="text-lg font-black text-indigo-600">${sessionDetails.session.calculatedAmount.toFixed(2)}</span>
                                        </div>
                                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Efectivo Físico</span>
                                            <span className="text-lg font-black text-slate-700">
                                                {sessionDetails.session.status === 'Closed' ? `$${sessionDetails.session.closeAmount.toFixed(2)}` : '---'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Collapse / Acordeón para Desglose de Monedas/Billetes */}
                                    {(() => {
                                        let userNotesText = sessionDetails.session.notes;
                                        let denominations: { [key: string]: string } | null = null;
                                        try {
                                            if (sessionDetails.session.notes && (sessionDetails.session.notes.startsWith('{') || sessionDetails.session.notes.includes('"denominations"'))) {
                                                const parsed = JSON.parse(sessionDetails.session.notes);
                                                userNotesText = parsed.userNotes;
                                                denominations = parsed.denominations;
                                            }
                                        } catch (e) {
                                            console.warn("Could not parse denominations notes", e);
                                        }

                                        return (
                                            <div className="space-y-4">
                                                {/* Detalle del Arqueo de Monedas / Billetes (Collapse/Details) */}
                                                {denominations && Object.keys(denominations).length > 0 && (
                                                    <details className="group border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/50">
                                                        <summary className="flex justify-between items-center p-4 font-black text-xs text-slate-700 uppercase tracking-widest cursor-pointer select-none hover:bg-slate-50 transition-colors">
                                                            <div className="flex items-center gap-2">
                                                                <Coins size={16} className="text-indigo-600" />
                                                                Ver Conteo de Monedas y Billetes
                                                            </div>
                                                            <span className="text-slate-400 group-open:rotate-180 transition-transform duration-200">
                                                                ▼
                                                            </span>
                                                        </summary>
                                                        <div className="p-6 pt-0 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white">
                                                            {Object.entries(denominations)
                                                                .filter(([_, count]) => count && Number(count) > 0)
                                                                .map(([key, count]) => {
                                                                    const parts = key.split('_');
                                                                    const type = parts[0] === 'bill' ? 'Billete' : 'Moneda';
                                                                    const val = parts[1];
                                                                    return (
                                                                        <div key={key} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                                                                            <div>
                                                                                <span className="text-[10px] text-slate-400 font-bold block">{type}</span>
                                                                                <span className="text-sm font-black text-slate-700">${val}</span>
                                                                            </div>
                                                                            <span className="text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                                                                                x{count}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                        </div>
                                                    </details>
                                                )}

                                                {/* Observaciones / Notas */}
                                                {userNotesText && (
                                                    <div className="p-4 bg-amber-50/40 border border-amber-100 rounded-2xl">
                                                        <span className="block text-[9px] font-black text-amber-500 uppercase tracking-wider mb-1">Observaciones / Notas</span>
                                                        <p className="text-xs text-amber-800 font-medium whitespace-pre-wrap">{userNotesText}</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Detalle de Transacciones Manuales */}
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Movimientos Manuales en Caja</h3>
                                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl overflow-hidden">
                                            <div className="overflow-x-auto">
                                            <table className="w-full min-w-[520px] text-left border-collapse table-clean">
                                                <thead>
                                                    <tr className="bg-slate-900/5">
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Hora</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Tipo</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Descripción</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-right whitespace-nowrap">Monto</th>
                                                        {sessionDetails?.session?.status === 'Open' && (
                                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-right whitespace-nowrap">Acc.</th>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sessionDetails.manualTransactions.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={sessionDetails?.session?.status === 'Open' ? 5 : 4} className="p-4 text-center text-xs text-slate-400 italic">No hay movimientos manuales en esta sesión.</td>
                                                        </tr>
                                                    ) : (
                                                        sessionDetails.manualTransactions.map((t: any) => (
                                                            <tr key={t.id} className={deletingTransactionId === t.id ? 'opacity-40' : ''}>
                                                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                                                <td className="px-4 py-3 text-xs font-bold whitespace-nowrap">
                                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${t.type === 'Income' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                                                                        {t.type === 'Income' ? 'INGRESO' : 'EGRESO'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-xs text-slate-700">{t.description}</td>
                                                                <td className={`px-4 py-3 text-xs font-black text-right whitespace-nowrap ${t.type === 'Income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                    ${t.amount.toFixed(2)}
                                                                </td>
                                                                {sessionDetails?.session?.status === 'Open' && (
                                                                    <td className="px-4 py-3 text-right">
                                                                        <button
                                                                            onClick={() => handleDeleteTransaction(t.id, t.description)}
                                                                            disabled={deletingTransactionId !== null}
                                                                            title="Eliminar movimiento"
                                                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                                        >
                                                                            {deletingTransactionId === t.id
                                                                                ? <Loader2 size={13} className="animate-spin" />
                                                                                : <Trash2 size={13} />}
                                                                        </button>
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ventas en Efectivo */}
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Ventas en Efectivo (POS)</h3>
                                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl overflow-hidden">
                                            <div className="overflow-x-auto">
                                            <table className="w-full min-w-[480px] text-left border-collapse table-clean">
                                                <thead>
                                                    <tr className="bg-slate-900/5">
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Hora</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Nota de Venta</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Observación</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-right whitespace-nowrap">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sessionDetails.sales.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="p-4 text-center text-xs text-slate-400 italic">No hay ventas registradas en esta sesión.</td>
                                                        </tr>
                                                    ) : (
                                                        sessionDetails.sales.map((s: any) => (
                                                            <tr key={s.id}>
                                                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                                                <td className="px-4 py-3 text-xs font-bold text-slate-700 whitespace-nowrap">{s.noteNumber}</td>
                                                                <td className="px-4 py-3 text-xs text-slate-500">{s.observation}</td>
                                                                <td className="px-4 py-3 text-xs font-black text-indigo-600 text-right whitespace-nowrap">${s.total.toFixed(2)}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Egresos/Gastos Generales en Efectivo */}
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Gastos Generales en Efectivo (Módulo Egresos)</h3>
                                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl overflow-hidden">
                                            <div className="overflow-x-auto">
                                            <table className="w-full min-w-[380px] text-left border-collapse table-clean">
                                                <thead>
                                                    <tr className="bg-slate-900/5">
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Hora</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Descripción</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-right whitespace-nowrap">Monto</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sessionDetails.expenses.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={3} className="p-4 text-center text-xs text-slate-400 italic">No hay gastos generales registrados en esta sesión.</td>
                                                        </tr>
                                                    ) : (
                                                        sessionDetails.expenses.map((e: any) => (
                                                            <tr key={e.id}>
                                                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                                                <td className="px-4 py-3 text-xs text-slate-700">
                                                                    {e.description}
                                                                    {e.notes && <p className="text-[10px] text-slate-400">{e.notes}</p>}
                                                                </td>
                                                                <td className="px-4 py-3 text-xs font-black text-rose-600 text-right whitespace-nowrap">${e.amount.toFixed(2)}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
            {/* ── Custom Confirm Delete Modal ── */}
            {confirmModal.open && (
                <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => setConfirmModal({ open: false, transactionId: null, description: '' })}
                    />

                    {/* Sheet — slides up on mobile, centered on desktop */}
                    <div className="relative w-full sm:max-w-sm bg-white sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl animate-slide-in-up overflow-hidden z-10">
                        {/* Top handle — mobile only */}
                        <div className="flex justify-center pt-3 pb-1 sm:hidden">
                            <div className="w-10 h-1.5 bg-slate-200 rounded-full" />
                        </div>

                        <div className="p-6 sm:p-8 space-y-5">
                            {/* Icon */}
                            <div className="flex items-center justify-center">
                                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center">
                                    <Trash2 size={28} className="text-rose-500" />
                                </div>
                            </div>

                            {/* Text */}
                            <div className="text-center space-y-1.5">
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">Eliminar Movimiento</h3>
                                <p className="text-sm text-slate-500 font-medium">
                                    ¿Eliminar
                                    {confirmModal.description
                                        ? <> <span className="font-bold text-slate-700">&ldquo;{confirmModal.description}&rdquo;</span>? </>
                                        : ' este movimiento? '
                                    }
                                    Esta acción no se puede deshacer.
                                </p>
                            </div>

                            {/* Buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setConfirmModal({ open: false, transactionId: null, description: '' })}
                                    className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-sm transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDeleteNow}
                                    className="py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-sm transition-all active:scale-95 shadow-lg shadow-rose-200"
                                >
                                    Sí, Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// Sub-component for history table to keep main component clean
const CashHistory = ({ history, onViewDetails }: { history: CashRegisterSession[]; onViewDetails: (id: number) => void }) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white border border-slate-100 rounded-xl shadow-sm text-indigo-600">
                    <History size={20} />
                </div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase tracking-widest text-sm">Historial de Sesiones</h2>
            </div>

            <div className="bg-white/40 backdrop-blur-md rounded-[2rem] border border-white/60 shadow-xl shadow-indigo-500/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full transition-all table-clean">
                        <thead>
                            <tr className="bg-slate-900/5 border-b border-slate-100">
                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fecha</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Usuario</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Base</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cierre</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Diferencia</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Estado</th>
                                <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <Calculator size={40} />
                                            <p className="font-bold text-sm">No hay sesiones registradas todavía</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                history.map((session) => (
                                    <tr key={session.id} className="hover:bg-white/60 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-700">{new Date(session.openTime).toLocaleDateString()}</span>
                                                <span className="text-[10px] font-bold text-slate-400">{new Date(session.openTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2" title={session.user?.username || 'Sistema'}>
                                                <div className="w-7 h-7 bg-indigo-50 rounded-full flex items-center justify-center text-[10px] font-black text-indigo-600 border border-indigo-100">
                                                    {(session.user?.username || 'S').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-xs font-bold text-slate-600 truncate max-w-[100px]">{session.user?.username || 'Sistema'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-xs font-bold text-slate-600">${session.openAmount.toFixed(2)}</td>
                                        <td className="px-6 py-5 text-xs font-black text-slate-800">
                                            {session.status === 'Closed' ? `$${session.closeAmount.toFixed(2)}` : '---'}
                                        </td>
                                        <td className="px-6 py-5">
                                            {session.status === 'Closed' ? (
                                                <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${session.discrepancy === 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                                                    {session.discrepancy > 0 ? '+' : ''}{session.discrepancy.toFixed(2)}
                                                </span>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-300 italic">En curso...</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${session.status === 'Open' ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20 animate-pulse' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                                {session.status === 'Open' ? 'ABIERTA' : 'CERRADA'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <button
                                                onClick={() => onViewDetails(session.id)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 rounded-xl text-[10px] font-black text-slate-600 hover:text-indigo-600 transition-all uppercase tracking-widest"
                                            >
                                                <Info size={12} strokeWidth={3} />
                                                Detalles
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// Sub-component for denomination counting
const DenominationCounter = ({ onChange }: { onChange: (total: number, inputs: { [key: string]: string }) => void }) => {

    const denominations = [
        { value: 100, label: '$100', type: 'bill' },
        { value: 50, label: '$50', type: 'bill' },
        { value: 20, label: '$20', type: 'bill' },
        { value: 10, label: '$10', type: 'bill' },
        { value: 5, label: '$5', type: 'bill' },
        { value: 1, label: '$1', type: 'bill' },
        { value: 1, label: '$1.00', type: 'coin' },
        { value: 0.50, label: '$0.50', type: 'coin' },
        { value: 0.25, label: '$0.25', type: 'coin' },
        { value: 0.10, label: '$0.10', type: 'coin' },
        { value: 0.05, label: '$0.05', type: 'coin' },
        { value: 0.01, label: '$0.01', type: 'coin' },
    ];

    // Simplified State Management
    const [inputs, setInputs] = useState<{ [key: string]: string }>({});

    const handleInputChange = (key: string, value: string) => {
        const newInputs = { ...inputs, [key]: value };
        setInputs(newInputs);

        // Calculate total
        let total = 0;
        denominations.forEach(d => {
            const inputKey = `${d.type}_${d.value}`;
            const count = Number(newInputs[inputKey] || 0);
            total += count * d.value;
        });
        onChange(total, newInputs);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Billetes */}
                <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-6 h-px bg-slate-200"></span> Billetes <span className="w-full h-px bg-slate-200"></span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {denominations.filter(d => d.type === 'bill').map((d) => (
                            <div key={`bill_${d.value}`} className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-black uppercase tracking-wider pointer-events-none">
                                    {d.label}
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full pl-12 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-right font-bold text-slate-700 placeholder:text-slate-300"
                                    placeholder="0"
                                    value={inputs[`${d.type}_${d.value}`] || ''}
                                    onChange={(e) => handleInputChange(`${d.type}_${d.value}`, e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Monedas */}
                <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-6 h-px bg-slate-200"></span> Monedas <span className="w-full h-px bg-slate-200"></span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {denominations.filter(d => d.type === 'coin').map((d) => (
                            <div key={`coin_${d.value}`} className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-black uppercase tracking-wider pointer-events-none">
                                    {d.label}
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full pl-12 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-right font-bold text-slate-700 placeholder:text-slate-300"
                                    placeholder="0"
                                    value={inputs[`${d.type}_${d.value}`] || ''}
                                    onChange={(e) => handleInputChange(`${d.type}_${d.value}`, e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CashRegisterPage;
