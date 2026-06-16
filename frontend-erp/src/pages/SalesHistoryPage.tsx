import { useEffect, useState } from 'react';
import { Eye, Search, Calendar, User, Printer, ChevronLeft, ChevronRight, FileText, Download } from 'lucide-react';
import { GlassCard } from '../components/common/GlassCard';
import type { Sale } from '../services/sale.service';
import { saleService } from '../services/sale.service';
import SaleDetailsModal from '../components/modals/SaleDetailsModal';
import { electronicBillingService } from '../services/electronic-billing.service';

export default function SalesHistoryPage() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [shouldAutoPrint, setShouldAutoPrint] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const pageSize = 10;

    useEffect(() => {
        fetchSales(currentPage);
    }, [currentPage]);

    const fetchSales = async (page: number) => {
        setLoading(true);
        try {
            const data = await saleService.getAll(page, pageSize);
            setSales(data.items);
            setTotalPages(data.totalPages);
            setTotalItems(data.totalCount);
        } catch (err) {
            console.error('Error fetching sales', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSeeDetails = async (id: number, autoPrint: boolean = false) => {
        try {
            const fullSale = await saleService.getById(id);
            setSelectedSale(fullSale);
            setShouldAutoPrint(autoPrint);
            setIsModalOpen(true);
        } catch (err) {
            console.error('Error fetching sale details', err);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-EC', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filteredSales = (sales || []).filter(s =>
        s.noteNumber?.includes(searchTerm) ||
        s.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.employee?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">Historial de Ventas</h2>
                    <p className="text-slate-500 mt-1">Revisa y administra tus transacciones</p>
                </div>
            </div>

            <GlassCard className="p-0 overflow-hidden border-0">
                <div className="p-6 border-b border-indigo-50/50 bg-white/40">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por # Nota, Cliente o Vendedor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="table-clean w-full border-collapse">
                        {/* ... (existing thead) */}
                        <thead>
                            <tr>
                                <th># Nota</th>
                                <th>Fecha</th>
                                <th>Cliente</th>
                                <th>Vendedor</th>
                                <th className="text-right">Total</th>
                                <th className="text-center">Estado</th>
                                <th className="text-center">FE</th>
                                <th className="text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-indigo-50/30">
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-8 text-slate-500">Cargando ventas...</td></tr>
                            ) : filteredSales.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-8 text-slate-500">No se encontraron ventas</td></tr>
                            ) : (
                                filteredSales.map(sale => (
                                    <tr key={sale.id} className="cursor-default transition-colors">
                                        <td className="font-mono text-slate-600">{sale.noteNumber || `N-${sale.id}`}</td>
                                        <td className="text-slate-600 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-slate-400" />
                                                {formatDate(sale.date)}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="font-medium text-slate-700">{sale.client?.name || 'Consumidor Final'}</div>
                                        </td>
                                        <td className="text-slate-600 text-sm">
                                            <div className="flex items-center gap-2">
                                                <User size={14} className="text-slate-400" />
                                                {sale.employee?.name}
                                            </div>
                                        </td>
                                        <td className="text-right font-bold text-slate-800">
                                            ${sale.total.toFixed(2)}
                                        </td>
                                        <td className="text-center">
                                            {sale.isVoid ? (
                                                <span className="inline-flex px-2 py-1 rounded bg-rose-100 text-rose-600 text-xs font-bold uppercase tracking-wider">
                                                    Anulada
                                                </span>
                                            ) : (
                                                <span className="inline-flex px-2 py-1 rounded bg-emerald-100 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                                                    Completada
                                                </span>
                                            )}
                                        </td>
                                        {/* FE Status Badge */}
                                        <td className="text-center">
                                            {(sale as any).isElectronic ? (
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${(sale as any).electronicStatus === 'AUTORIZADO'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : (sale as any).electronicStatus === 'PENDIENTE'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : (sale as any).electronicStatus === 'NO_AUTORIZADO'
                                                                ? 'bg-orange-100 text-orange-700'
                                                                : 'bg-rose-100 text-rose-700'
                                                    }`}>
                                                    <FileText size={10} />
                                                    {(sale as any).electronicStatus ?? 'FE'}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleSeeDetails(sale.id)}
                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Ver Detalle"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleSeeDetails(sale.id, true)}
                                                    className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                                                    title="Imprimir Ticket"
                                                >
                                                    <Printer size={18} />
                                                </button>
                                                {(sale as any).isElectronic && (sale as any).electronicStatus === 'AUTORIZADO' && (
                                                    <>
                                                        <button
                                                            onClick={() => electronicBillingService.descargarXml(sale.id, sale.noteNumber || String(sale.id))}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Descargar XML"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {!loading && totalPages > 1 && (
                    <div className="px-6 py-4 bg-slate-50/50 border-t border-indigo-50/50 flex items-center justify-between">
                        <div className="text-sm text-slate-500 font-medium">
                            Mostrando <span className="text-indigo-600 font-bold">{filteredSales.length}</span> de <span className="text-slate-800 font-bold">{totalItems}</span> registros
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-400 transition-all shadow-sm"
                            >
                                <ChevronLeft size={20} />
                            </button>

                            <div className="flex items-center px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm text-indigo-600 shadow-sm">
                                {currentPage} / {totalPages}
                            </div>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-400 transition-all shadow-sm"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </GlassCard>

            <SaleDetailsModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setShouldAutoPrint(false);
                }}
                sale={selectedSale}
                autoPrint={shouldAutoPrint}
                onVoid={() => fetchSales(currentPage)}
            />
        </div>
    );
}
