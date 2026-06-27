import { useState, useEffect } from 'react';
import {
    Search, ShoppingCart, Plus, Minus, Trash2,
    User, Check, Package, Tag,
    ChevronRight, CreditCard, X, LayoutGrid, Eye, FileText
} from 'lucide-react';
import { productService, type Product } from '../services/product.service';
import { clientService, type Client, type ClientCreateDto } from '../services/client.service';
import { saleService, type CreateSaleDto, type Sale } from '../services/sale.service';
import { useNotificationStore } from '../store/useNotificationStore';
import ClientFormModal from '../components/modals/ClientFormModal';
import SaleDetailsModal from '../components/modals/SaleDetailsModal';
import api from '../services/api';
import ConfirmModal from '../components/modals/ConfirmModal';
import { electronicBillingService } from '../services/electronic-billing.service';
import type { ElectronicBillingResult } from '../services/electronic-billing.service';

interface CartItem {
    product: Product;
    quantity: number;
    price: number; // Editable price
}

interface Category {
    id: number;
    name: string;
}

export default function PointOfSalePage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const addNotification = useNotificationStore(s => s.addNotification);

    // Cart & Sale State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientSearch, setClientSearch] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [completedSale, setCompletedSale] = useState<Sale | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [shouldAutoPrintPOS, setShouldAutoPrintPOS] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Transferencia'>('Efectivo');
    const [isClosedSessionModalOpen, setIsClosedSessionModalOpen] = useState(false);
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
    // === Facturación Electrónica ===
    const [emitirFE, setEmitirFE] = useState(false);
    const [feResult, setFeResult] = useState<ElectronicBillingResult | null>(null);
    const [emittingFe, setEmittingFe] = useState(false);

    // Pagination / Infinite Scroll
    const [visibleLimit, setVisibleLimit] = useState(24);

    useEffect(() => {
        // Reset limit when searching or changing category
        setVisibleLimit(24);
    }, [searchTerm, selectedCategory]);

    const fetchData = async () => {
        try {
            const [productsData, clientsData, categoriesRes] = await Promise.all([
                productService.getAll(false, 1, 1000),
                clientService.getAll(1, 1000),
                api.get('/categories', { params: { pageSize: 1000 } })
            ]);
            setProducts(productsData.items);
            setClients(clientsData.items);
            setCategories(categoriesRes.data.items);

            // Set Consumidor Final as default
            const cf = clientsData.items.find((c: any) => c.cedulaRuc === '9999999999');
            if (cf) setSelectedClient(cf);
        } catch (err) {
            console.error('Error fetching POS data', err);
            addNotification('Error al cargar datos del punto de venta', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Intersection Observer for Infinite Scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleLimit(prev => prev + 24);
                }
            },
            { threshold: 0.1 }
        );

        const target = document.querySelector('#pos-scroll-end');
        if (target) observer.observe(target);

        return () => observer.disconnect();
    }, [products, searchTerm, selectedCategory]);

    const addToCart = (product: Product) => {
        if (!product.isService && product.stock <= 0) {
            addNotification('Producto sin stock disponible', 'error');
            return;
        }

        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                if (!product.isService && existing.quantity >= product.stock) {
                    addNotification('Máximo stock alcanzado', 'warning');
                    return prev;
                }
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1, price: product.price }];
        });
    };

    const removeFromCart = (productId: number) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newQty = Math.max(1, item.quantity + delta);
                if (!item.product.isService && delta > 0 && newQty > item.product.stock) {
                    addNotification('Stock insuficiente', 'warning');
                    return item;
                }
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const updatePrice = (productId: number, newPrice: number) => {
        setCart(prev => prev.map(item =>
            item.product.id === productId ? { ...item, price: newPrice } : item
        ));
    };

    const calculateTotal = () => {
        return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        if (!selectedClient) {
            addNotification('Por favor selecciona un cliente', 'warning');
            return;
        }

        setIsProcessing(true);
        setFeResult(null);
        try {
            const saleData: CreateSaleDto = {
                employeeId: 1, // To be replaced by auth context
                clientId: selectedClient.id,
                observation: 'Venta realizada desde el POS Profesional',
                paymentMethod: paymentMethod,
                details: cart.map(item => ({
                    productId: item.product.id,
                    quantity: item.quantity,
                    unitPrice: item.price
                }))
            };

            const newSale = await saleService.create(saleData);

            // === Emitir Factura Electrónica (si el toggle está activo) ===
            if (emitirFE && newSale?.id) {
                setEmittingFe(true);
                try {
                    const result = await electronicBillingService.emitirFactura(newSale.id);
                    setFeResult(result);
                } catch (feErr: any) {
                    setFeResult({
                        success: false,
                        status: 'ERROR',
                        errorMessage: feErr?.response?.data?.message ?? 'Error al emitir FE'
                    });
                } finally {
                    setEmittingFe(false);
                }
            }

            setCompletedSale(newSale);
            setShowSuccess(true);
            setCart([]);
            setSelectedClient(null);
            // We don't auto-hide anymore so user can print

            // Refresh products to update stock
            const updatedProducts = await productService.getAll(false, 1, 1000);
            setProducts(updatedProducts.items);
        } catch (err: any) {
            console.error('Checkout error', err);

            if (err.response?.status === 400 && err.response?.data?.includes('NO_OPEN_SESSION')) {
                setIsClosedSessionModalOpen(true);
            } else {
                addNotification(err.response?.data || 'Error al procesar la venta', 'error');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    // Load full sale details before opening the modal (ensures saleDetails are present for printing)
    const handleOpenDetailsModal = async (autoPrint: boolean = false) => {
        if (!completedSale?.id) return;
        try {
            const fullSale = await saleService.getById(completedSale.id);
            setCompletedSale(fullSale);
            setShouldAutoPrintPOS(autoPrint);
            setIsDetailsModalOpen(true);
        } catch (err) {
            console.error('Error loading sale details for print', err);
            // Fallback: open with what we have
            setShouldAutoPrintPOS(autoPrint);
            setIsDetailsModalOpen(true);
        }
    };

    const handleSaveClient = async (data: ClientCreateDto) => {
        try {
            const newClient = await clientService.create(data);
            setClients(prev => [...prev, newClient]);
            setSelectedClient(newClient);
            addNotification('Cliente creado y seleccionado', 'success');
        } catch (err) {
            console.error('Error creating client from POS', err);
            throw err;
        }
    };

    const normalizeString = (str: string) => {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    };

    const filteredProducts = (products || []).filter(p => {
        const searchLower = normalizeString(searchTerm || '');
        const matchesSearch = normalizeString(p.name || '').includes(searchLower) ||
            normalizeString(p.sku || '').includes(searchLower);
        const matchesCategory = selectedCategory ? p.categoryId === selectedCategory : true;
        return matchesSearch && matchesCategory;
    });

    const filteredClients = (clients || []).filter(c =>
        c.name?.toLowerCase().includes((clientSearch || '').toLowerCase()) ||
        (c.cedulaRuc && c.cedulaRuc.includes(clientSearch || ''))
    );

    return (
        <div className="h-auto md:h-[calc(100vh-100px)] flex flex-col gap-0 animate-fade-in relative">

            <div className="h-auto md:h-[calc(100vh-40px)] grid grid-cols-12 gap-4 md:overflow-hidden pt-2 px-2 md:pl-4 md:pr-0.5 pb-4">

                {/* LEFT COLUMN: HEADER + CATEGORIES + PRODUCTS */}
                <div className="col-span-12 md:col-span-7 xl:col-span-8 2xl:col-span-9 flex flex-col gap-6 h-auto md:h-full min-h-0">

                    <div className="flex justify-between items-center bg-white/40 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-sm shrink-0">
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="h-10 w-10 md:h-12 md:w-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 shrink-0">
                                <ShoppingCart size={20} className="md:scale-125" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight truncate">Caja</h1>
                                <p className="text-slate-500 text-[10px] md:text-sm font-medium truncate">Nueva transacción</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-1 justify-end ml-2 md:ml-4">
                            <div className="relative group w-full max-w-[350px]">
                                <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-600" size={16} />
                                <input
                                    type="text"
                                    className="w-full pl-9 md:pl-11 pr-3 py-2 md:py-3 bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 outline-none text-slate-700 dark:text-slate-200 text-sm md:text-base font-medium transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    placeholder="Buscar..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 px-1 custom-scrollbar shrink-0 no-scrollbar">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl border transition-all flex items-center gap-2 whitespace-nowrap group font-bold text-xs md:text-sm tracking-tight ${selectedCategory === null
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-900/20'
                                : 'bg-white/60 dark:bg-slate-800/60 border-white/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:border-slate-200'
                                }`}
                        >
                            <LayoutGrid size={14} className={selectedCategory === null ? 'text-indigo-400' : 'text-slate-400'} />
                            Todas
                        </button>

                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl border transition-all flex items-center gap-2 whitespace-nowrap group font-bold text-xs md:text-sm tracking-tight ${selectedCategory === cat.id
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-600/20'
                                    : 'bg-white/60 dark:bg-slate-800/60 border-white/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:border-slate-200'
                                    }`}
                            >
                                <Tag size={14} className={selectedCategory === cat.id ? 'text-indigo-200' : 'text-slate-400 group-hover:text-indigo-50'} />
                                {cat.name}
                            </button>
                        ))}
                    </div>


                    {/* PRODUCTS GRID (RESPONSIVE) */}
                    <div className="grow md:overflow-y-auto pr-0 md:pr-2 custom-scrollbar">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-4">
                            {loading ? (
                                Array(6).fill(0).map((_, i) => (
                                    <div key={i} className="bg-white/40 h-48 rounded-3xl animate-pulse"></div>
                                ))
                            ) : filteredProducts.length === 0 ? (
                                <div className="col-span-full h-64 flex flex-col items-center justify-center text-slate-400">
                                    <Package size={48} className="mb-4 opacity-20" />
                                    <p className="font-bold">No se encontraron productos</p>
                                </div>
                            ) : (
                                <>
                                    {filteredProducts.slice(0, visibleLimit).map(product => {
                                        const inCart = cart.find(item => item.product.id === product.id);
                                        return (
                                            <div
                                                key={product.id}
                                                onClick={() => addToCart(product)}
                                                className={`group relative bg-white/60 dark:bg-slate-800/70 border-2 rounded-3xl p-4 transition-all hover:-translate-y-1 cursor-pointer overflow-hidden ${(!product.isService && product.stock <= 0)
                                                    ? 'opacity-60 grayscale border-slate-100 dark:border-slate-700 cursor-not-allowed'
                                                    : inCart
                                                        ? 'border-indigo-500 bg-white dark:bg-slate-700 ring-4 ring-indigo-500/5'
                                                        : 'border-white/60 dark:border-slate-700/60 hover:border-indigo-200 hover:bg-white dark:hover:bg-slate-700 hover:shadow-2xl hover:shadow-indigo-500/5'
                                                    }`}
                                            >
                                                {inCart && (
                                                    <div className="absolute top-2 right-2 h-7 w-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-600/20 z-10 animate-scale-in">
                                                        {inCart.quantity}
                                                    </div>
                                                )}

                                                <div className="aspect-square rounded-2xl bg-slate-50 dark:bg-slate-700 mb-3 overflow-hidden flex items-center justify-center border border-slate-100 dark:border-slate-600 relative group-hover:bg-white dark:group-hover:bg-slate-600 transition-colors">
                                                    {product.images?.[0] ? (
                                                        <img src={product.images[0].url} alt={product.name} className="w-full h-full object-contain p-2 mix-blend-multiply dark:mix-blend-normal transition-transform duration-500 group-hover:scale-110" />
                                                    ) : (
                                                        <Package className="text-slate-200" size={32} />
                                                    )}

                                                    {!product.isService && product.stock <= 5 && product.stock > 0 && (
                                                        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-black rounded-lg uppercase tracking-wider">
                                                            Stock Bajo
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1">
                                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight h-10 line-clamp-2 transition-colors group-hover:text-indigo-400">{product.name}</h3>
                                                    <div className="flex justify-between items-end gap-2">
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <Package size={12} className={product.isService ? 'text-blue-500' : (product.stock <= 5 ? 'text-rose-500' : 'text-indigo-500')} />
                                                                <p className={`text-[11px] font-bold ${product.isService ? 'text-blue-600' : (product.stock <= 5 ? 'text-rose-500' : 'text-slate-600')}`}>
                                                                    {product.isService ? 'Servicio (∞)' : `Stock: ${product.stock}`}
                                                                </p>
                                                            </div>
                                                            <p className="text-lg font-black text-slate-900 dark:text-slate-100">${product.price.toFixed(2)}</p>
                                                        </div>
                                                        <div className={`p-2 rounded-xl transition-all ${inCart ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/50 group-hover:text-indigo-600'}`}>
                                                            <Plus size={16} strokeWidth={3} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {/* Sentinel for Infinite Scroll */}
                                    <div id="pos-scroll-end" className="col-span-full h-10 flex items-center justify-center">
                                        {visibleLimit < filteredProducts.length && (
                                            <div className="flex gap-2 items-center text-slate-400 text-xs font-bold animate-pulse">
                                                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                                                Cargando más productos...
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: CART & CHECKOUT (Responsive: Floating Modal on Mobile, Column on Desktop) */}
                <div
                    id="cart-section"
                    className={`
                        fixed top-0 left-0 w-full h-full z-[100] bg-white dark:bg-slate-900 flex flex-col transition-transform duration-500
                        md:static md:z-auto md:w-auto md:bg-transparent dark:md:bg-transparent md:col-span-5 xl:col-span-4 2xl:col-span-3 md:translate-y-0
                        ${isMobileCartOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
                    `}
                >
                    {/* max-h on desktop is set via inline style since tailwind calc() can't reference CSS vars easily */}
                    <div
                        className="h-full flex flex-col bg-white dark:bg-slate-900 md:bg-white/60 dark:md:bg-slate-900/80 backdrop-blur-xl md:rounded-[2.5rem] border-t md:border border-white/60 dark:border-slate-700/50 shadow-2xl shadow-indigo-500/5 overflow-hidden"
                        style={{ maxHeight: 'calc(100vh - 100px)' }}
                    >

                        {/* Mobile Cart Header (Only visible on mobile) */}
                        <div className="md:hidden flex items-center justify-between p-4 border-b border-indigo-50 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm shrink-0">
                            <button
                                onClick={() => setIsMobileCartOpen(false)}
                                className="flex items-center gap-1 text-indigo-600 font-bold px-3 py-1.5 bg-indigo-50 rounded-xl active:scale-95 transition-all"
                            >
                                <ChevronRight className="rotate-180" size={18} strokeWidth={3} />
                                <span className="text-sm">Volver</span>
                            </button>

                            <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                                <ShoppingCart size={18} className="text-indigo-600" />
                                Carrito
                                <span className="bg-rose-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black">
                                    {cart.length}
                                </span>
                            </h2>

                            {cart.length > 0 ? (
                                <button
                                    onClick={() => setCart([])}
                                    className="text-xs font-black text-rose-400 hover:text-rose-600 px-2 py-1 bg-rose-50 rounded-lg transition-colors"
                                >
                                    Vaciar
                                </button>
                            ) : (
                                <div className="w-16"></div>
                            )}
                        </div>


                        {/* Consumidor Final Toggle & Selected Client */}
                        <div className="p-6 border-b border-indigo-100/30 shrink-0">
                            {(!selectedClient || selectedClient.cedulaRuc === '9999999999') && (
                                <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-3xl border border-indigo-50 dark:border-slate-700 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${selectedClient?.cedulaRuc === '9999999999' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-100 text-slate-400'}`}>
                                            <User size={14} />
                                        </div>
                                        <p className="text-sm font-bold text-slate-800">Consumidor Final</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {cart.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setCart([])}
                                                className="text-[10px] font-black text-rose-400 hover:text-rose-600 px-2 py-1 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors uppercase tracking-wider"
                                            >
                                                Vaciar todo
                                            </button>
                                        )}
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={selectedClient?.cedulaRuc === '9999999999'}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        const cf = clients.find(c => c.cedulaRuc === '9999999999');
                                                        if (cf) setSelectedClient(cf);
                                                    } else {
                                                        setSelectedClient(null);
                                                        setClientSearch('');
                                                    }
                                                }}
                                            />
                                            <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Selected non-CF client display */}
                            {selectedClient && selectedClient.cedulaRuc !== '9999999999' && (
                                <div className="flex items-center gap-3 bg-emerald-50 p-3 rounded-2xl border border-emerald-100 shadow-sm animate-scale-in">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                        <User size={14} />
                                    </div>
                                    <div className="grow min-w-0">
                                        <p className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">{selectedClient?.name}</p>
                                        <p className="text-[9px] font-bold text-emerald-500 tracking-widest">{selectedClient?.cedulaRuc}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {cart.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setCart([])}
                                                className="text-[10px] font-black text-rose-400 hover:text-rose-600 px-2 py-1 bg-white hover:bg-rose-50 rounded-lg transition-colors uppercase tracking-wider shadow-sm border border-rose-100"
                                            >
                                                Vaciar todo
                                            </button>
                                        )}
                                        <button onClick={() => { setSelectedClient(null); setClientSearch(''); }} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Client Search — only when no client selected and not CF */}
                            {!selectedClient && (
                                <div className="mt-3 flex gap-2">
                                    <div className="relative grow">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="text"
                                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="Buscar cliente por nombre o CI..."
                                            value={clientSearch}
                                            onChange={e => setClientSearch(e.target.value)}
                                        />
                                        {clientSearch && (
                                            <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl mt-1 shadow-2xl z-30 max-h-40 overflow-y-auto p-1.5 space-y-1">
                                                {filteredClients.length === 0 ? (
                                                    <p className="p-2 text-xs text-slate-400 text-center">Sin resultados</p>
                                                ) : filteredClients.map(client => (
                                                    <div
                                                        key={client.id}
                                                        className="p-2 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors group"
                                                        onClick={() => {
                                                            setSelectedClient(client);
                                                            setClientSearch('');
                                                        }}
                                                    >
                                                        <div className="font-bold text-slate-800 text-[11px] group-hover:text-indigo-600">{client.name}</div>
                                                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{client.cedulaRuc}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setIsClientModalOpen(true)}
                                        className="p-2.5 bg-white border border-slate-100 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm flex items-center justify-center shrink-0"
                                    >
                                        <Plus size={16} strokeWidth={3} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Cart Items List — scrollable, grows to fill space but bottom sections stay fixed */}
                        <div className="grow min-h-0 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                        <ShoppingCart size={32} className="text-slate-200" />
                                    </div>
                                    <p className="font-black text-slate-400 uppercase tracking-widest text-xs">El carrito está vacío</p>
                                    <p className="text-sm text-slate-400 mt-2 font-medium">Agregue productos para comenzar la venta</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.product.id} className="group flex gap-3 p-3 bg-white/40 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-indigo-50 hover:shadow-sm">
                                        <div className="h-12 w-12 bg-white rounded-xl p-1 shrink-0 border border-slate-100 flex items-center justify-center">
                                            {item.product.images?.[0] ? (
                                                <img src={item.product.images[0].url} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                                            ) : <Package className="text-slate-200" size={16} />}
                                        </div>

                                        <div className="grow min-w-0 flex flex-col justify-center gap-1">
                                            <h4 className="font-bold text-slate-800 text-[13px] truncate leading-tight">{item.product.name}</h4>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-0.5 bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-100 focus-within:border-indigo-300 transition-all">
                                                    <span className="text-[10px] font-bold text-slate-400">$</span>
                                                    <input
                                                        type="number"
                                                        value={item.price}
                                                        onChange={(e) => updatePrice(item.product.id, parseFloat(e.target.value) || 0)}
                                                        className="w-12 bg-transparent text-[11px] font-bold text-indigo-600 outline-none"
                                                    />
                                                </div>
                                                <div className="flex items-center bg-white rounded-lg border border-slate-100 p-0.5 shadow-sm">
                                                    <button onClick={() => updateQuantity(item.product.id, -1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"><Minus size={10} strokeWidth={3} /></button>
                                                    <span className="text-xs font-bold w-5 text-center text-slate-700">{item.quantity}</span>
                                                    <button onClick={() => updateQuantity(item.product.id, 1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"><Plus size={10} strokeWidth={3} /></button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end justify-between py-0.5">
                                            <button onClick={() => removeFromCart(item.product.id)} className="text-rose-300 hover:text-rose-500 transition-colors p-1"><Trash2 size={14} /></button>
                                            <span className="font-bold text-slate-900 text-sm tracking-tight">${(item.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Payment Method Selection - Compact */}
                        <div className="px-5 py-3 border-t border-indigo-50/50 bg-slate-50/30 shrink-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Método de Pago</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setPaymentMethod('Efectivo')}
                                    className={`py-2 px-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold text-sm ${paymentMethod === 'Efectivo'
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:border-indigo-200'
                                        }`}
                                >
                                    <div className={`p-1 rounded-lg ${paymentMethod === 'Efectivo' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                        <CreditCard size={14} />
                                    </div>
                                    Efectivo
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('Transferencia')}
                                    className={`py-2 px-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold text-sm ${paymentMethod === 'Transferencia'
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:border-indigo-200'
                                        }`}
                                >
                                    <div className={`p-1 rounded-lg ${paymentMethod === 'Transferencia' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                        <ChevronRight size={14} className="rotate-45" />
                                    </div>
                                    Transferencia
                                </button>
                            </div>
                        </div>

                        {/* Summary & Checkout - Compact, always visible at bottom */}
                        <div className="p-5 bg-white dark:bg-slate-900 border-t-2 border-slate-50 dark:border-slate-700/50 shadow-[0_-20px_50px_rgba(0,0,0,0.03)] shrink-0">
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between items-end px-1">
                                    <span className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">Total a Pagar</span>
                                    <span className="text-3xl font-black text-indigo-600 tracking-tighter">
                                        <span className="text-lg font-bold mr-1">$</span>
                                        {calculateTotal().toFixed(2)}
                                    </span>
                                </div>
                                {/* FE Toggle */}
                                <div className="flex items-center justify-between px-3 py-2.5 bg-indigo-50/70 rounded-xl border border-indigo-100">
                                    <div className="flex items-center gap-2">
                                        <FileText size={14} className="text-indigo-500" />
                                        <span className="text-xs font-black text-indigo-800 dark:text-indigo-300">Factura Electrónica</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEmitirFE(v => !v)}
                                        className={`relative w-11 h-6 rounded-full transition-all duration-300 ${emitirFE ? 'bg-indigo-600' : 'bg-slate-300'
                                            }`}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${emitirFE ? 'translate-x-5' : 'translate-x-0'
                                            }`} />
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleCheckout}
                                disabled={cart.length === 0 || isProcessing || !selectedClient}
                                className="group relative w-full bg-slate-900 dark:bg-indigo-600 disabled:bg-slate-200 dark:disabled:bg-slate-700 py-4 rounded-2xl font-black text-white disabled:text-slate-400 dark:disabled:text-slate-500 transition-all hover:bg-slate-800 dark:hover:bg-indigo-700 active:scale-95 shadow-xl shadow-slate-900/20 flex items-center justify-center gap-4"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                {isProcessing ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <div className="p-1.5 bg-white/10 rounded-lg">
                                            <CreditCard size={18} className="text-indigo-300" />
                                        </div>
                                        <span className="uppercase tracking-widest text-xs">Completar Venta</span>
                                        <ChevronRight size={18} className="text-white/40 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-fade-in text-center">
                    <div className="bg-white p-10 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.3)] max-w-md w-full animate-scale-in border-4 border-emerald-500/10">
                        <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/40 relative">
                            <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
                            <Check size={40} className="text-white" strokeWidth={4} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">¡Venta Exitosa!</h2>
                        <p className="text-slate-500 font-bold mb-4">La transacción ha sido procesada correctamente.</p>

                        {/* FE Result */}
                        {emitirFE && (
                            <div className={`mb-6 p-4 rounded-2xl border text-sm font-bold flex items-center gap-3 text-left ${emittingFe
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                    : feResult?.status === 'AUTORIZADO'
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                        : 'bg-rose-50 border-rose-200 text-rose-700'
                                }`}>
                                {emittingFe ? (
                                    <><div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin shrink-0" /><span>Emitiendo factura electrónica...</span></>
                                ) : feResult?.status === 'AUTORIZADO' ? (
                                    <><Check size={20} className="text-emerald-600 shrink-0" /><div><p>✅ Factura Autorizada por el SRI</p><p className="text-xs font-mono mt-1 text-emerald-600 truncate">{feResult.authorizationNumber}</p>{feResult.emailSent === false ? <p className="text-xs text-rose-500 mt-1">⚠ Error enviando correo: {feResult.emailError}</p> : <p className="text-xs text-emerald-600 mt-1">✉ Correo enviado al cliente</p>}</div></>
                                ) : (
                                    <><FileText size={20} className="text-rose-500 shrink-0" /><div><p>⚠ {feResult?.errorMessage ?? 'Sin respuesta del SRI'}</p><p className="text-[10px] font-normal mt-1">Puedes reintentar desde Historial de Ventas.</p></div></>
                                )}
                            </div>
                        )}

                        <div className="space-y-3">
                            <button
                                onClick={() => handleOpenDetailsModal(false)}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3"
                            >
                                <Eye size={16} />
                                Ver Detalles / Imprimir
                            </button>
                            <button
                                onClick={() => { setShowSuccess(false); setCompletedSale(null); setFeResult(null); }}
                                className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all"
                            >
                                Nueva Venta
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Client Creation Modal */}
            <ClientFormModal
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
                onSave={handleSaveClient}
            />

            {/* Sale Details & Printing Modal */}
            <SaleDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => { setIsDetailsModalOpen(false); setShouldAutoPrintPOS(false); }}
                sale={completedSale}
                autoPrint={shouldAutoPrintPOS}
            />

            {cart.length > 0 && !isMobileCartOpen && (
                <button
                    onClick={() => setIsMobileCartOpen(true)}
                    className="fixed bottom-6 right-6 md:hidden z-30 bg-indigo-600 text-white p-4 rounded-full shadow-2xl shadow-indigo-600/40 animate-bounce-subtle flex items-center gap-2 group"
                >
                    <div className="relative">
                        <ShoppingCart size={24} />
                        <span className="absolute -top-2 -right-2 bg-rose-500 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-white">
                            {cart.length}
                        </span>
                    </div>
                    <span className="font-bold text-sm tracking-tight pr-2">Ver Carrito</span>
                </button>
            )}

            <ConfirmModal
                isOpen={isClosedSessionModalOpen}
                onClose={() => setIsClosedSessionModalOpen(false)}
                onConfirm={() => window.location.href = '/cash-register'}
                title="Caja Cerrada"
                message="Debe abrir caja antes de realizar ventas en efectivo. ¿Desea ir al Arqueo de Caja ahora?"
                confirmText="Ir a Arqueo de Caja"
                cancelText="Cerrar"
            />
        </div>
    );
}
