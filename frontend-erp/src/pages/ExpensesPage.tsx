import { useEffect, useState } from 'react';
import { Plus, Search, Calendar, Trash2, DollarSign, Tag, FileText, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { GlassCard } from '../components/common/GlassCard';
import { expensesService } from '../services/expenses.service';
import type { Expense, CreateExpenseDto } from '../services/expenses.service';
import { expenseCategoriesService, type ExpenseCategory } from '../services/expense-categories.service';
import ExpenseCategoriesModal from '../components/modals/ExpenseCategoriesModal';
import ConfirmModal from '../components/modals/ConfirmModal';
import { useNotificationStore } from '../store/useNotificationStore';

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
    const [isClosedSessionModalOpen, setIsClosedSessionModalOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const addNotification = useNotificationStore(s => s.addNotification);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const pageSize = 15;

    // Form State
    const [formData, setFormData] = useState<CreateExpenseDto>({
        description: '',
        amount: 0,
        expenseCategoryId: 0,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'Efectivo',
        notes: '',
        deductFromCashRegister: false
    });

    useEffect(() => {
        fetchExpenses(currentPage);
        fetchCategories();
    }, [currentPage]);

    const fetchExpenses = async (page = 1) => {
        setLoading(true);
        try {
            const data = await expensesService.getAll(page, pageSize);
            setExpenses(data.items);
            setTotalPages(data.totalPages);
            setTotalItems(data.totalCount);
        } catch (err) {
            console.error('Error fetching expenses', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const data = await expenseCategoriesService.getAll(1, 1000);
            setCategories(data.items);
        } catch (err) {
            console.error('Error fetching categories', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await expensesService.create(formData);
            addNotification('Egreso registrado correctamente', 'success');
            setIsModalOpen(false);
            setFormData({
                description: '',
                amount: 0,
                expenseCategoryId: 0,
                date: new Date().toISOString().split('T')[0],
                paymentMethod: 'Efectivo',
                notes: '',
                deductFromCashRegister: false
            });
            fetchExpenses(currentPage);
        } catch (err: any) {
            console.error('Error creating expense', err);
            if (err.response?.status === 400 && err.response?.data?.includes('NO_OPEN_SESSION')) {
                setIsClosedSessionModalOpen(true);
            } else {
                addNotification('Error al registrar el egreso: ' + (err.response?.data || 'Desconocido'), 'error');
            }
        }
    };

    const handleDelete = async (id: number) => {
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await expensesService.delete(deleteId);
            addNotification('Egreso eliminado correctamente', 'success');
            setDeleteId(null);
            fetchExpenses(currentPage);
        } catch (err) {
            console.error('Error deleting expense', err);
            addNotification('Error al eliminar el egreso', 'error');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-EC', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const filteredExpenses = (expenses || []).filter(e =>
        e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.categoryName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Group categories for "Frecuentes" presentation (mock logic or simple aggregation)
    // For now, simple list.

    return (
        <>
            <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">Control de Egresos</h2>
                    <p className="text-slate-500 mt-1">Registra y visualiza los gastos de la empresa</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsCategoriesModalOpen(true)}
                        className="bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
                    >
                        <Settings size={20} />
                        Gestionar Categorías
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                    >
                        <Plus size={20} />
                        Registrar Egreso
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="p-6 md:col-span-2 border-0">
                    <div className="p-4 border-b border-indigo-50/50 bg-white/40 -mx-6 -mt-6 mb-6 flex items-center justify-between">
                        <div className="relative max-w-md w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar gastos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white/50 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table-clean w-full border-collapse">
                            <thead>
                                <tr>
                                    <th>Descripción</th>
                                    <th>Categoría</th>
                                    <th>Fecha</th>
                                    <th className="text-right">Monto</th>
                                    <th className="text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50/30">
                                {loading ? (
                                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">Cargando datos...</td></tr>
                                ) : filteredExpenses.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">No hay egresos registrados</td></tr>
                                ) : (
                                    filteredExpenses.map(expense => (
                                        <tr key={expense.id} className="cursor-default hover:bg-slate-50/50 transition-colors">
                                            <td className="font-medium text-slate-700">
                                                <div className="flex items-center gap-2">
                                                    <FileText size={16} className="text-slate-400" />
                                                    {expense.description}
                                                </div>
                                                {expense.notes && <p className="text-xs text-slate-400 ml-6">{expense.notes}</p>}
                                            </td>
                                            <td>
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                                                    <Tag size={10} />
                                                    {expense.categoryName}
                                                </span>
                                            </td>
                                            <td className="text-slate-600 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-slate-400" />
                                                    {formatDate(expense.date)}
                                                </div>
                                            </td>
                                            <td className="text-right font-bold text-rose-600">
                                                ${expense.amount.toFixed(2)}
                                            </td>
                                            <td className="text-right">
                                                <button
                                                    onClick={() => handleDelete(expense.id)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {!loading && totalPages > 1 && (
                        <div className="mt-6 flex items-center justify-between bg-white/40 p-4 rounded-2xl border border-indigo-50/50">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Mostrando <span className="text-indigo-600 font-black">{expenses.length}</span> de <span className="text-indigo-950 font-black">{totalItems}</span> egresos
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-xl border border-indigo-100 bg-white hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-400 transition-all shadow-sm"
                                >
                                    <ChevronLeft size={18} />
                                </button>

                                <div className="flex items-center px-4 bg-white border border-indigo-100 rounded-xl font-black text-[10px] text-indigo-600 shadow-sm">
                                    {currentPage} / {totalPages}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-xl border border-indigo-100 bg-white hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-400 transition-all shadow-sm"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </GlassCard>

                <div className="space-y-6">
                    <div className="p-6 rounded-[2rem] bg-gradient-to-br from-rose-600 via-rose-600 to-rose-700 text-white shadow-xl shadow-rose-600/30 relative overflow-hidden group transition-all duration-300 hover:shadow-2xl hover:shadow-rose-600/40 hover:-translate-y-1">
                        <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
                            <DollarSign size={120} />
                        </div>

                        <div className="relative z-10 flex items-center gap-5 mb-4">
                            <div className="p-3.5 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
                                <DollarSign size={32} className="text-white" strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-white/90 font-bold text-sm uppercase tracking-wider mb-1">Total Egresos</h3>
                                <p className="text-4xl font-black text-white tracking-tight drop-shadow-sm text-shadow-sm">${totalExpenses.toFixed(2)}</p>
                            </div>
                        </div>
                        <div className="relative z-10">
                            <span className="text-xs font-bold text-rose-100 bg-rose-900/30 px-3 py-1.5 rounded-lg border border-white/10 inline-block backdrop-blur-sm">
                                Suma total de gastos registrados
                            </span>
                        </div>
                    </div>

                    <GlassCard className="p-6 border-0">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Tag size={18} className="text-indigo-600" />
                            Categorías Disponibles
                        </h3>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                            {categories.map(cat => (
                                <div key={cat.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-sm font-bold text-slate-600">{cat.name}</span>
                                    {cat.description && <span className="text-xs text-slate-400 truncate max-w-[120px]" title={cat.description}>{cat.description}</span>}
                                </div>
                            ))}
                            {categories.length === 0 && <p className="text-slate-400 text-sm italic">No hay categorías.</p>}
                        </div>
                    </GlassCard>
                </div>
            </div>
            </div>

            {/* Modal for New Expense */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
                    onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
                >
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] animate-scale-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-bold text-slate-800">Registrar Nuevo Gasto</h3>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors">
                                <Plus size={20} className="rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Descripción</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="Ej: Pago de Luz"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Monto ($)</label>
                                    <input
                                        type="number"
                                        required
                                        min="0.01"
                                        step="0.01"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Fecha</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Categoría</label>
                                <select
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                    value={formData.expenseCategoryId}
                                    onChange={e => setFormData({ ...formData, expenseCategoryId: parseInt(e.target.value) })}
                                    required
                                >
                                    <option value={0} disabled>Seleccione una categoría</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Método de Pago</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, paymentMethod: 'Efectivo' })}
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold border ${formData.paymentMethod === 'Efectivo' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                                    >
                                        Efectivo (Caja Chica)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, paymentMethod: 'Transferencia', deductFromCashRegister: false })}
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold border ${formData.paymentMethod === 'Transferencia' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                                    >
                                        Transferencia
                                    </button>
                                </div>
                            </div>

                            {formData.paymentMethod === 'Efectivo' && (
                                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl animate-pop-attention">
                                    <div className="space-y-0.5">
                                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">¿Descontar de Caja Chica?</label>
                                        <span className="text-[10px] text-slate-400 font-bold block">
                                            Resta el dinero de la sesión de caja activa diaría.
                                        </span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.deductFromCashRegister || false}
                                            onChange={(e) => setFormData({ ...formData, deductFromCashRegister: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Notas Adicionales</label>
                                <textarea
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                    rows={2}
                                    value={formData.notes || ''}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                ></textarea>
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 mt-2"
                            >
                                Guardar Egreso
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <ExpenseCategoriesModal
                isOpen={isCategoriesModalOpen}
                onClose={() => setIsCategoriesModalOpen(false)}
                onUpdate={fetchCategories}
            />

            <ConfirmModal
                isOpen={isClosedSessionModalOpen}
                onClose={() => setIsClosedSessionModalOpen(false)}
                onConfirm={() => window.location.href = '/cash-register'}
                title="Caja Cerrada"
                message="Debe abrir caja antes de registrar egresos de Efectivo (Caja Chica). ¿Desea ir al Arqueo de Caja ahora?"
                confirmText="Ir a Arqueo de Caja"
                cancelText="Cerrar"
            />

            <ConfirmModal
                isOpen={deleteId !== null}
                onClose={() => setDeleteId(null)}
                onConfirm={confirmDelete}
                title="Eliminar Egreso"
                message="¿Estás seguro de que deseas eliminar este registro de egreso? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                cancelText="Cancelar"
            />
        </>
    );
}
