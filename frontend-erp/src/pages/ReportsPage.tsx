import { useEffect, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, ComposedChart, Line
} from 'recharts';
import {
    FileText, TrendingUp, Package, DollarSign, Calendar,
    ArrowDownRight, CreditCard, Activity, Download, Loader2
} from 'lucide-react';
import { GlassCard } from '../components/common/GlassCard';
import {
    reportsService,
    type KpiStats,
    type SalesTrend,
    type TopProduct,
    type InventoryValuation,
    type SaleProfit
} from '../services/reports.service';
import { productService, type Product } from '../services/product.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = ['#4f46e5', '#ec4899', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function ReportsPage() {
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [activeQuickFilter, setActiveQuickFilter] = useState<'today' | '7' | '30' | 'custom'>('custom');

    const [kpi, setKpi] = useState<KpiStats | null>(null);
    const [trends, setTrends] = useState<SalesTrend[]>([]);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [inventoryValuation, setInventoryValuation] = useState<InventoryValuation[]>([]);
    const [salesProfit, setSalesProfit] = useState<SaleProfit[]>([]);

    const [activeTab, setActiveTab] = useState<'financial' | 'inventory' | 'details'>('financial');
    const [isExportingPDF, setIsExportingPDF] = useState(false);

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    const fetchData = async () => {
        try {
            const start = new Date(dateRange.start);
            const end = new Date(dateRange.end);

            const [kpiData, trendData, topData, invData, profitData] = await Promise.all([
                reportsService.getKpiStats(start, end),
                reportsService.getSalesTrend(start, end),
                reportsService.getTopProducts(start, end),
                reportsService.getInventoryValuation(), // Inventory is point-in-time, rarely range based (for now)
                reportsService.getSalesProfit(start, end)
            ]);

            setKpi(kpiData);
            setTrends(trendData);
            setTopProducts(topData);
            setInventoryValuation(invData);
            setSalesProfit(profitData);
        } catch (error) {
            console.error("Error loading reports", error);
        }
    };

    const handleQuickFilter = (filter: 'today' | '7' | '30') => {
        const end = new Date();
        const start = new Date();
        if (filter === 'today') {
            // same day
        } else if (filter === '7') {
            start.setDate(end.getDate() - 7);
        } else if (filter === '30') {
            start.setDate(end.getDate() - 30);
        }
        setActiveQuickFilter(filter);
        setDateRange({
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        });
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-EC', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    };

    // Format a YYYY-MM-DD string safely without UTC shift
    const formatDateLabel = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString('es-EC', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
    };

    const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

    // ─── PDF Export: sales transactions ────────────────────────────────────────
    const handleExportTransactionsPDF = () => {
        if (!salesProfit.length) return;

        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const today = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
        const rangeLabel = `${new Date(dateRange.start).toLocaleDateString('es-EC')} — ${new Date(dateRange.end).toLocaleDateString('es-EC')}`;

        // Header bar
        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, pageW, 54, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        doc.setTextColor(255, 255, 255);
        doc.text('DETALLE DE TRANSACCIONES DE VENTAS', 32, 28);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Período: ${rangeLabel}   |   Generado: ${today}`, 32, 45);

        // Summary KPI strip
        const totalRevenue = salesProfit.reduce((s, r) => s + r.totalRevenue, 0);
        const totalCost    = salesProfit.reduce((s, r) => s + r.totalCost, 0);
        const totalProfit  = salesProfit.reduce((s, r) => s + r.grossProfit, 0);
        const totalQty     = salesProfit.reduce((s, r) => s + r.totalQuantity, 0);
        const kpis = [
            { label: 'Total Transacciones', value: String(salesProfit.length) },
            { label: 'Unidades Vendidas',   value: String(totalQty) },
            { label: 'Total Ingresos',      value: formatCurrency(totalRevenue) },
            { label: 'Total Costo',         value: formatCurrency(totalCost) },
            { label: 'Ganancia Bruta',      value: formatCurrency(totalProfit) },
        ];
        const summaryY = 66;
        const cW = (pageW - 64) / kpis.length;
        kpis.forEach((k, i) => {
            const x = 32 + i * cW;
            doc.setFillColor(241, 245, 249);
            doc.roundedRect(x, summaryY, cW - 8, 38, 5, 5, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(30, 41, 59);
            doc.text(k.value, x + (cW - 8) / 2, summaryY + 17, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(k.label.toUpperCase(), x + (cW - 8) / 2, summaryY + 30, { align: 'center' });
        });

        // Table
        const tableBody = salesProfit.map((item, idx) => [
            String(idx + 1),
            item.noteNumber || '—',
            formatDate(item.date),
            item.employeeName || '—',
            item.productNames || '—',
            String(item.totalQuantity),
            item.paymentMethod || '—',
            formatCurrency(item.totalRevenue),
            formatCurrency(item.totalCost),
            formatCurrency(item.grossProfit),
            item.marginPercentage != null ? `${item.marginPercentage.toFixed(1)}%` : '—',
        ]);

        autoTable(doc, {
            startY: summaryY + 50,
            head: [['#', 'N° Nota', 'Fecha', 'Vendedor', 'Productos', 'Cant.', 'Pago', 'Total Venta', 'Costo', 'Ganancia', 'Margen']],
            body: tableBody,
            styles: { fontSize: 7.5, cellPadding: 4, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.3 },
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0:  { halign: 'center', cellWidth: 20 },
                1:  { halign: 'center', cellWidth: 52, fontStyle: 'bold', textColor: [79, 70, 229] },
                2:  { cellWidth: 70, fontSize: 7 },
                3:  { cellWidth: 62 },
                4:  { cellWidth: 115 },
                5:  { halign: 'center', cellWidth: 30 },
                6:  { cellWidth: 54 },
                7:  { halign: 'right', cellWidth: 55, fontStyle: 'bold' },
                8:  { halign: 'right', cellWidth: 50, textColor: [239, 68, 68] },
                9:  { halign: 'right', cellWidth: 55, textColor: [16, 185, 129], fontStyle: 'bold' },
                10: { halign: 'center', cellWidth: 40 },
            },
            margin: { left: 32, right: 32 },
            didDrawPage: (data) => {
                const footerY = doc.internal.pageSize.getHeight() - 18;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(148, 163, 184);
                doc.text(`ERP-STORE-FAST · Transacciones de Ventas · ${today}`, 32, footerY);
                doc.text(`Pág. ${data.pageNumber}`, pageW - 32, footerY, { align: 'right' });
            },
        });

        doc.save(`transacciones_ventas_${dateRange.start}_${dateRange.end}.pdf`);
    };
    // ─── PDF Export: full product inventory ────────────────────────────────────
    const handleExportInventoryPDF = async () => {
        setIsExportingPDF(true);
        try {
            // Fetch ALL active products (large page size)
            let allProducts: Product[] = [];
            let page = 1;
            while (true) {
                const data = await productService.getAll(false, page, 500);
                allProducts = [...allProducts, ...(data.items || [])];
                if (page >= data.totalPages) break;
                page++;
            }

            const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const today = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });

            // ── Header bar ──────────────────────────────────────────────────────
            doc.setFillColor(79, 70, 229); // indigo-600
            doc.rect(0, 0, pageW, 54, 'F');

            // Title
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.setTextColor(255, 255, 255);
            doc.text('REPORTE DE INVENTARIO DE PRODUCTOS', 32, 30);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Generado: ${today}`, 32, 46);

            // ── Summary stats ────────────────────────────────────────────────────
            const totalStock = allProducts.reduce((s, p) => s + p.stock, 0);
            const totalCostValue = allProducts.reduce((s, p) => s + p.cost * p.stock, 0);
            const totalSaleValue = allProducts.reduce((s, p) => s + p.price * p.stock, 0);
            const lowStock = allProducts.filter(p => p.stock > 0 && p.stock <= (p.minStock || 5)).length;
            const outOfStock = allProducts.filter(p => p.stock === 0).length;

            const summaryY = 70;
            const colW = (pageW - 64) / 5;
            const stats = [
                { label: 'Total Productos', value: String(allProducts.length) },
                { label: 'Total Unidades', value: String(totalStock) },
                { label: 'Valor en Costo', value: formatCurrency(totalCostValue) },
                { label: 'Valor en Venta', value: formatCurrency(totalSaleValue) },
                { label: 'Stock Bajo / Agotado', value: `${lowStock} / ${outOfStock}` },
            ];

            stats.forEach((stat, i) => {
                const x = 32 + i * colW;
                doc.setFillColor(241, 245, 249); // slate-100
                doc.roundedRect(x, summaryY, colW - 8, 42, 6, 6, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.setTextColor(30, 41, 59); // slate-800
                doc.text(stat.value, x + (colW - 8) / 2, summaryY + 20, { align: 'center' });
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139); // slate-500
                doc.text(stat.label.toUpperCase(), x + (colW - 8) / 2, summaryY + 34, { align: 'center' });
            });

            // ── Product Table ────────────────────────────────────────────────────
            const tableData = allProducts.map((p, idx) => [
                String(idx + 1),
                p.name,
                p.barcode || p.sku || '—',
                p.category?.name || '—',
                p.subcategory?.name || '—',
                formatCurrency(p.cost),
                formatCurrency(p.price),
                String(p.stock),
                formatCurrency(p.cost * p.stock),
                formatCurrency(p.price * p.stock),
                p.stock === 0 ? 'AGOTADO' : p.stock <= (p.minStock || 5) ? 'BAJO' : 'OK',
            ]);

            autoTable(doc, {
                startY: summaryY + 58,
                head: [['#', 'Producto', 'SKU/Cód.', 'Categoría', 'Subcategoría', 'Costo U.', 'Precio U.', 'Stock', 'Val. Costo', 'Val. Venta', 'Estado']],
                body: tableData,
                styles: { fontSize: 7.5, cellPadding: 4, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.3 },
                headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 22 },
                    1: { cellWidth: 110, fontStyle: 'bold' },
                    2: { halign: 'center', cellWidth: 62, font: 'courier' },
                    3: { cellWidth: 70 },
                    4: { cellWidth: 70 },
                    5: { halign: 'right', cellWidth: 50 },
                    6: { halign: 'right', cellWidth: 50 },
                    7: { halign: 'center', cellWidth: 32 },
                    8: { halign: 'right', cellWidth: 60 },
                    9: { halign: 'right', cellWidth: 60, textColor: [16, 185, 129], fontStyle: 'bold' },
                    10: { halign: 'center', cellWidth: 40 },
                },
                didDrawCell: (data) => {
                    if (data.section === 'body' && data.column.index === 10) {
                        const val = data.cell.raw as string;
                        if (val === 'AGOTADO') {
                            data.cell.styles.textColor = [239, 68, 68];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (val === 'BAJO') {
                            data.cell.styles.textColor = [245, 158, 11];
                            data.cell.styles.fontStyle = 'bold';
                        } else {
                            data.cell.styles.textColor = [16, 185, 129];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                },
                margin: { left: 32, right: 32 },
                didDrawPage: (data) => {
                    // Footer on each page
                    const footerY = doc.internal.pageSize.getHeight() - 18;
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7);
                    doc.setTextColor(148, 163, 184);
                    doc.text(`ERP-STORE-FAST · Reporte de Inventario · ${today}`, 32, footerY);
                    doc.text(`Pág. ${data.pageNumber}`, pageW - 32, footerY, { align: 'right' });
                },
            });

            doc.save(`inventario_productos_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            console.error('Error generando PDF:', err);
        } finally {
            setIsExportingPDF(false);
        }
    };
    // ───────────────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">Reportes Avanzados</h2>
                    <p className="text-slate-500 mt-1">Análisis financiero y operativo de tu negocio</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-xl">
                        <Calendar size={16} className="text-slate-500" />
                        <span className="text-xs font-bold text-slate-500 uppercase">Rango:</span>
                    </div>
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => { setDateRange({ ...dateRange, start: e.target.value }); setActiveQuickFilter('custom'); }}
                        className="bg-transparent text-sm font-medium text-slate-700 outline-none border-b border-transparent focus:border-indigo-500 transition-colors"
                    />
                    <span className="text-slate-300">|</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => { setDateRange({ ...dateRange, end: e.target.value }); setActiveQuickFilter('custom'); }}
                        className="bg-transparent text-sm font-medium text-slate-700 outline-none border-b border-transparent focus:border-indigo-500 transition-colors"
                    />
                    <div className="h-6 w-px bg-slate-200 mx-1"></div>
                    <button
                        onClick={() => handleQuickFilter('today')}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                            activeQuickFilter === 'today'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                                : 'text-slate-500 hover:bg-slate-100'
                        }`}
                    >Hoy</button>
                    <button
                        onClick={() => handleQuickFilter('7')}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                            activeQuickFilter === '7'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                                : 'text-slate-500 hover:bg-slate-100'
                        }`}
                    >7 Días</button>
                    <button
                        onClick={() => handleQuickFilter('30')}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                            activeQuickFilter === '30'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                                : 'text-slate-500 hover:bg-slate-100'
                        }`}
                    >30 Días</button>
                </div>
            </div>

            {/* KPI Cards */}
            {kpi && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Fixed Card Background - Using standard div instead of GlassCard to ensure gradient is visible */}
                    <div className="rounded-2xl p-5 bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 transition-transform hover:-translate-y-1 duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                <DollarSign size={20} className="text-white" />
                            </div>
                            <span className="bg-white/20 text-xs font-bold px-2 py-1 rounded-lg backdrop-blur-sm">+100%</span>
                        </div>
                        <p className="text-indigo-100 text-sm font-medium mb-1">Ingresos Totales</p>
                        <h3 className="text-3xl font-black">{formatCurrency(kpi.totalRevenue)}</h3>
                    </div>

                    <GlassCard className="p-5 border-0">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-emerald-100 rounded-xl">
                                <TrendingUp size={20} className="text-emerald-600" />
                            </div>
                        </div>
                        <p className="text-slate-400 text-sm font-bold mb-1">Ganancia Bruta</p>
                        <h3 className="text-3xl font-black text-slate-800">{formatCurrency(kpi.grossProfit)}</h3>
                        <p className="text-xs text-slate-400 mt-1">Ventas - Costo Mercancía</p>
                    </GlassCard>

                    <GlassCard className="p-5 border-0">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-rose-100 rounded-xl">
                                <ArrowDownRight size={20} className="text-rose-600" />
                            </div>
                        </div>
                        <p className="text-slate-400 text-sm font-bold mb-1">Gastos Operativos</p>
                        <h3 className="text-3xl font-black text-rose-600">-{formatCurrency(kpi.totalExpenses)}</h3>
                        <p className="text-xs text-slate-400 mt-1">Servicios, Alquiler, etc.</p>
                    </GlassCard>

                    <GlassCard className="p-5 border-0 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
                            <Activity size={100} />
                        </div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="p-2 bg-slate-900 rounded-xl">
                                <Activity size={20} className="text-white" />
                            </div>
                        </div>
                        <p className="text-slate-500 text-sm font-bold mb-1 relative z-10">Utilidad Neta</p>
                        <h3 className={`text-3xl font-black relative z-10 ${kpi.netProfit >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                            {formatCurrency(kpi.netProfit)}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 relative z-10">Margen Real: {((kpi.netProfit / (kpi.totalRevenue || 1)) * 100).toFixed(1)}%</p>
                    </GlassCard>
                </div>
            )}

            {/* Main Tabs */}
            <div className="flex gap-4 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('financial')}
                    className={`pb-3 px-2 text-sm font-bold transition-all relative ${activeTab === 'financial' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Análisis Financiero
                    {activeTab === 'financial' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('inventory')}
                    className={`pb-3 px-2 text-sm font-bold transition-all relative ${activeTab === 'inventory' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Inventario y Productos
                    {activeTab === 'inventory' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('details')}
                    className={`pb-3 px-2 text-sm font-bold transition-all relative ${activeTab === 'details' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Detalle de Transacciones
                    {activeTab === 'details' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
                </button>
            </div>

            {/* Content per Tab */}
            {activeTab === 'financial' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                    <GlassCard className="p-6 border-0 lg:col-span-2 h-[450px] flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <TrendingUp size={20} className="text-indigo-600" />
                                    Flujo de Caja: Ingresos vs Egresos
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">Comparativa de dinero entrando vs saliendo de la caja.</p>
                            </div>
                            <div className="text-xs bg-slate-100 px-3 py-1 rounded-lg text-slate-500 font-medium">
                                Flujo Neto = Ingresos - Gastos
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trends} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                                    labelStyle={{ color: '#64748b', marginBottom: '0.5rem' }}
                                />
                                <Legend verticalAlign="top" height={36} iconType="circle" />
                                {/* Changed Area to Bar for Revenue for better visibility and comparison */}
                                <Bar dataKey="revenue" name="Ingresos" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="expenses" name="Gastos" fill="#fb7185" radius={[4, 4, 0, 0]} barSize={20} />
                                <Line type="monotone" dataKey="netProfit" name="Flujo Neto" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </GlassCard>

                    <GlassCard className="p-6 border-0 h-[450px] flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <CreditCard size={20} className="text-indigo-600" />
                            Métodos de Pago
                        </h3>
                        {(() => {
                            // Aggregate from salesProfit (each row has paymentMethod + totalRevenue)
                            const methodMap: Record<string, number> = {};
                            salesProfit.forEach(row => {
                                const m = row.paymentMethod || 'Otros';
                                methodMap[m] = (methodMap[m] || 0) + row.totalRevenue;
                            });
                            const entries = Object.entries(methodMap).sort((a, b) => b[1] - a[1]);
                            const grandTotal = entries.reduce((s, [, v]) => s + v, 0);
                            const paymentColors: Record<string, string> = {
                                'Efectivo': '#10b981',
                                'Transferencia': '#4f46e5',
                                'Tarjeta': '#f59e0b',
                                'Credito': '#ec4899',
                                'Otros': '#94a3b8'
                            };
                            const piePay = entries.map(([name, value]) => ({
                                name,
                                value,
                                pct: grandTotal > 0 ? Math.round((value / grandTotal) * 100) : 0,
                                color: paymentColors[name] ?? COLORS[entries.indexOf([name, value].slice() as [string, number]) % COLORS.length]
                            }));

                            if (piePay.length === 0) {
                                return (
                                    <div className="flex-1 flex items-center justify-center flex-col text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        <CreditCard size={48} className="text-slate-300 mb-4" />
                                        <p className="text-slate-500 font-medium">Sin datos para el período seleccionado</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="flex-1 flex flex-col">
                                    <div className="flex-1 relative">
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="text-center">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total</p>
                                                <p className="text-xl font-black text-slate-700">{formatCurrency(grandTotal)}</p>
                                            </div>
                                        </div>
                                        <ResponsiveContainer width="100%" height={200}>
                                            <PieChart>
                                                <Pie data={piePay} cx="50%" cy="50%" innerRadius={65} outerRadius={88} paddingAngle={3} dataKey="value" nameKey="name">
                                                    {piePay.map((entry, index) => (
                                                        <Cell key={`pm-${index}`} fill={entry.color} strokeWidth={0} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} contentStyle={{ borderRadius: '10px', border: 'none', fontSize: '12px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="space-y-2 mt-2">
                                        {piePay.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-sm bg-slate-50 rounded-xl px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                                    <span className="font-bold text-slate-700">{item.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-slate-400 font-bold">{item.pct}%</span>
                                                    <span className="font-black text-slate-800 text-xs">{formatCurrency(item.value)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </GlassCard>
                </div>
            )}

            {activeTab === 'inventory' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Download button row */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleExportInventoryPDF}
                            disabled={isExportingPDF}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/25 transition-all active:scale-95"
                        >
                            {isExportingPDF
                                ? <><Loader2 size={16} className="animate-spin" /> Generando PDF...</>
                                : <><Download size={16} /> Descargar Inventario PDF</>}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <GlassCard className="p-6 border-0 h-[400px] flex flex-col relative">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Package size={20} className="text-indigo-600" />
                                Valoración de Inventario
                            </h3>
                        </div>

                        {/* Total Value Display */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-10">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total</p>
                            <p className="text-2xl font-black text-slate-700">
                                {formatCurrency(inventoryValuation.reduce((acc, curr) => acc + curr.totalValue, 0))}
                            </p>
                        </div>

                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={inventoryValuation}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80} // Increased inner radius for more space
                                    outerRadius={110}
                                    paddingAngle={2}
                                    dataKey="totalValue"
                                    nameKey="categoryName"
                                >
                                    {inventoryValuation.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: '11px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </GlassCard>

                    <GlassCard className="p-6 border-0 h-[400px] flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <TrendingUp size={20} className="text-indigo-600" />
                            Top 5 Productos Más Vendidos
                        </h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topProducts} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="productName" type="category" width={120} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                                <Bar dataKey="totalRevenue" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} name="Ingresos Generados" />
                            </BarChart>
                        </ResponsiveContainer>
                    </GlassCard>
                    </div>
                </div>
            )}

            {activeTab === 'details' && (
                <GlassCard className="p-6 border-0 animate-fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <FileText size={20} className="text-indigo-600" />
                                Detalle de Transacciones
                            </h3>
                            <p className="text-xs text-slate-400 font-medium mt-1">
                                Registro línea por línea de cada venta: vendedor, productos, ingresos, costo y ganancia bruta —
                                período <span className="text-indigo-500 font-bold">{formatDateLabel(dateRange.start)} al {formatDateLabel(dateRange.end)}</span>
                                · <span className="font-bold text-slate-600">{salesProfit.length} registros</span>
                            </p>
                        </div>
                        <button
                            onClick={handleExportTransactionsPDF}
                            disabled={!salesProfit.length}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-95 whitespace-nowrap"
                        >
                            <Download size={16} />
                            Exportar PDF
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="table-clean w-full">
                            <thead>
                                <tr>
                                    <th>N° Nota</th>
                                    <th>Fecha</th>
                                    <th>Vendedor</th>
                                    <th>Producto</th>
                                    <th className="text-center">Cant.</th>
                                    <th className="text-right">Total Venta</th>
                                    <th className="text-right text-rose-500">Costo</th>
                                    <th className="text-right text-emerald-600 bg-emerald-50/50">Ganancia Bruta</th>
                                </tr>
                            </thead>
                            <tbody>
                                {salesProfit.map((item) => (
                                    <tr key={`${item.saleId}-${item.productNames}`} className="hover:bg-slate-50/50">
                                        <td className="font-bold text-indigo-600 text-xs">{item.noteNumber}</td>
                                        <td className="text-xs text-slate-500">{formatDate(item.date)}</td>
                                        <td>
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">
                                                {item.employeeName}
                                            </span>
                                        </td>
                                        <td className="font-medium text-slate-700 text-sm max-w-[200px] truncate" title={item.productNames}>
                                            {item.productNames}
                                        </td>
                                        <td className="text-center font-bold text-slate-600">{item.totalQuantity}</td>
                                        <td className="text-right font-bold text-slate-800">{formatCurrency(item.totalRevenue)}</td>
                                        <td className="text-right text-rose-400 text-xs">{formatCurrency(item.totalCost)}</td>
                                        <td className="text-right font-black text-emerald-600 bg-emerald-50/30">
                                            +{formatCurrency(item.grossProfit)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </GlassCard>
            )}
        </div>
    );
}
