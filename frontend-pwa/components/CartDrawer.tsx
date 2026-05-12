"use client";

import { useCart } from "@/context/CartContext";
import { X, ShoppingBag, Trash2, Plus, Minus, ArrowRight, MapPin, User, Phone, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";

export default function CartDrawer() {
    const { cart, removeFromCart, updateQuantity, totalPrice, isCartOpen, setIsCartOpen, clearCart } = useCart();
    const [view, setView] = useState<'cart' | 'checkout' | 'success'>('cart');
    const [businessPhone, setBusinessPhone] = useState("593991693863");

    useEffect(() => {
        async function fetchSettings() {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5140/api/v1";
                const res = await fetch(`${API_URL}/CompanySettings`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.phone) {
                        let phone = data.phone.replace(/\D/g, '');
                        // Auto-fix Ecuador numbers
                        if (phone.startsWith('0')) {
                            phone = '593' + phone.substring(1);
                        }
                        setBusinessPhone(phone);
                    }
                }
            } catch (e) {
                console.error("Error fetching business phone:", e);
            }
        }
        fetchSettings();
    }, []);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
        city: ''
    });

    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        // Clear error when user types
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }

        if (name === 'phone') {
            // Solo números y máximo 10 dígitos
            const val = value.replace(/\D/g, '').slice(0, 10);
            setFormData(prev => ({ ...prev, [name]: val }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const generateWhatsAppLink = () => {
        // Fallback or ensure format
        let vendorPhone = businessPhone || "593991693863";

        // Remove non-numeric
        vendorPhone = vendorPhone.replace(/\D/g, '');

        // Fix Ecuador format if strictly missing country code but has 0 prefix
        if (vendorPhone.startsWith('0') && vendorPhone.length === 10) {
            vendorPhone = '593' + vendorPhone.substring(1);
        }

        const orderId = Math.floor(1000 + Math.random() * 9000);

        let message = `*NUEVO PEDIDO #${orderId}*\n\n`;
        message += `Cliente: ${formData.name}\n`;
        message += `WhatsApp: ${formData.phone}\n`;
        message += `Ubicacion: ${formData.address}, ${formData.city}\n\n`;
        message += `*Detalle del Pedido:*\n`;

        cart.forEach(item => {
            message += `- ${item.name} (x${item.quantity}) - $${(item.price * item.quantity).toFixed(2)}\n`;
        });

        message += `\n*TOTAL A PAGAR: $${totalPrice.toFixed(2)}*\n\n`;
        message += `---`;

        const encodedMessage = encodeURIComponent(message);
        return `https://wa.me/${vendorPhone}?text=${encodedMessage}`;
    };

    const handleConfirmOrder = () => {
        const newErrors: { [key: string]: string } = {};

        if (!formData.name.trim()) newErrors.name = "El nombre es obligatorio.";
        if (!formData.phone.trim()) newErrors.phone = "El teléfono es obligatorio.";
        else if (formData.phone.length !== 10) newErrors.phone = "El teléfono debe tener 10 dígitos.";

        if (!formData.address.trim()) newErrors.address = "La dirección es obligatoria.";
        if (!formData.city.trim()) newErrors.city = "La ciudad es obligatoria.";

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        const link = generateWhatsAppLink();
        window.open(link, '_blank');
        setView('success');
        clearCart();
    };

    if (!isCartOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={() => setIsCartOpen(false)}
            />

            {/* Drawer */}
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
                <div className="w-screen max-w-md animate-slide-in-right">
                    <div className="h-full flex flex-col bg-white dark:bg-slate-900 shadow-2xl rounded-l-[2.5rem] overflow-hidden">
                        {/* Header */}
                        <div className="px-8 py-8 border-b border-slate-50 dark:border-slate-700/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                                    <ShoppingBag size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-outfit font-black tracking-tight">Tu Carrito</h2>
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{cart.length} Artículos</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsCartOpen(false)}
                                className="p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 text-muted-foreground transition-all active:scale-90"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* List / Form View */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
                            {view === 'cart' ? (
                                cart.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                                        <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-200 dark:text-slate-600">
                                            <ShoppingBag size={40} />
                                        </div>
                                        <p className="text-muted-foreground font-medium">Tu carrito está vacío</p>
                                        <button
                                            onClick={() => setIsCartOpen(false)}
                                            className="text-primary font-bold text-sm hover:underline"
                                        >
                                            Seguir comprando
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {cart.map((item) => (
                                            <div key={item.id} className="flex gap-4 group">
                                                <div className="w-24 h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 animate-fade-in border border-slate-50 dark:border-slate-700">
                                                    <img
                                                        src={item.images?.[0]?.url || ""}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                    />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex justify-between items-start">
                                                        <h3 className="text-sm font-bold text-foreground line-clamp-1">{item.name}</h3>
                                                        <button
                                                            onClick={() => removeFromCart(item.id)}
                                                            className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">Unit: ${item.price.toFixed(2)}</p>

                                                    <div className="flex items-center justify-between pt-2">
                                                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-xl p-1 border border-slate-100 dark:border-slate-700">
                                                            <button
                                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-500 dark:text-slate-400 transition-all"
                                                            >
                                                                <Minus size={14} />
                                                            </button>
                                                            <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                                                            <button
                                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-500 dark:text-slate-400 transition-all"
                                                            >
                                                                <Plus size={14} />
                                                            </button>
                                                        </div>
                                                        <span className="text-sm font-outfit font-black text-foreground">${(item.price * item.quantity).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            ) : view === 'checkout' ? (
                                <div className="space-y-8 animate-fade-in">
                                    <div className="space-y-6">
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                <User size={14} /> Datos del Cliente
                                            </h3>
                                            <div className="space-y-3">
                                                <div className="relative">
                                                    <input
                                                        type="text" name="name" placeholder="Nombre completo"
                                                        className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 transition-all text-foreground ${errors.name ? 'ring-2 ring-rose-500/50 bg-rose-50 dark:bg-rose-900/20' : 'ring-primary/20'}`}
                                                        value={formData.name} onChange={handleInputChange}
                                                    />
                                                    {errors.name && <p className="text-[10px] text-rose-500 font-bold mt-1 ml-4 animate-pulse">{errors.name}</p>}
                                                </div>
                                                <div className="relative text-foreground font-medium">
                                                    <input
                                                        type="tel" name="phone" placeholder="Número de WhatsApp (ej: 0991693863)"
                                                        className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 transition-all text-foreground ${errors.phone ? 'ring-2 ring-rose-500/50 bg-rose-50 dark:bg-rose-900/20' : 'ring-primary/20'}`}
                                                        value={formData.phone} onChange={handleInputChange}
                                                    />
                                                    {errors.phone && <p className="text-[10px] text-rose-500 font-bold mt-1 ml-4 animate-pulse">{errors.phone}</p>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                <MapPin size={14} /> Dirección de Entrega
                                            </h3>
                                            <div className="space-y-3">
                                                <div>
                                                    <input
                                                        type="text" name="city" placeholder="Ciudad"
                                                        className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 transition-all text-foreground ${errors.city ? 'ring-2 ring-rose-500/50 bg-rose-50 dark:bg-rose-900/20' : 'ring-primary/20'}`}
                                                        value={formData.city} onChange={handleInputChange}
                                                    />
                                                    {errors.city && <p className="text-[10px] text-rose-500 font-bold mt-1 ml-4 animate-pulse">{errors.city}</p>}
                                                </div>
                                                <div>
                                                    <input
                                                        type="text" name="address" placeholder="Dirección exacta y referencia"
                                                        className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-2 transition-all text-foreground ${errors.address ? 'ring-2 ring-rose-500/50 bg-rose-50 dark:bg-rose-900/20' : 'ring-primary/20'}`}
                                                        value={formData.address} onChange={handleInputChange}
                                                    />
                                                    {errors.address && <p className="text-[10px] text-rose-500 font-bold mt-1 ml-4 animate-pulse">{errors.address}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 animate-fade-in">
                                    <div className="w-24 h-24 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                                        <CheckCircle2 size={48} />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-outfit font-black text-foreground">¡Pedido Enviado!</h3>
                                        <p className="text-muted-foreground text-sm">Hemos recibido tu orden y serás contactado por WhatsApp en breve.</p>
                                    </div>
                                    <button
                                        onClick={() => { setView('cart'); setIsCartOpen(false); }}
                                        className="premium-button px-8 py-4 rounded-xl text-sm"
                                    >
                                        Seguir Comprando
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {cart.length > 0 && view !== 'success' && (
                            <div className="px-8 py-10 border-t border-slate-50 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-800/40 space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>Subtotal</span>
                                        <span>${totalPrice.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-muted-foreground font-medium">
                                        <span>Envío</span>
                                        <span className="text-emerald-500 font-bold">Gratis</span>
                                    </div>
                                    <div className="pt-4 flex justify-between items-end">
                                        <span className="font-bold text-foreground">Total</span>
                                        <span className="text-3xl font-outfit font-black text-primary">${totalPrice.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {view === 'cart' ? (
                                        <button
                                            onClick={() => setView('checkout')}
                                            className="w-full premium-button py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-primary/20 group"
                                        >
                                            <span>Finalizar Compra</span>
                                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setView('cart')}
                                                className="px-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-muted-foreground hover:bg-white dark:hover:bg-slate-800 hover:text-foreground transition-all"
                                            >
                                                Atrás
                                            </button>
                                            <button
                                                onClick={handleConfirmOrder}
                                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                                            >
                                                <span>Confirmar WhatsApp</span>
                                                <ArrowRight size={20} />
                                            </button>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setIsCartOpen(false)}
                                        className="w-full py-4 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {view === 'checkout' ? 'Cancelar proceso' : 'Continuar Comprando'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
