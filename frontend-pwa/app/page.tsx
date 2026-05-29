"use client";

import { useEffect, useState } from "react";
import ProductCard from "@/components/ProductCard";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import { Product } from "@/types/product";
import {
    Star, Truck, ShieldCheck, Zap, ShoppingBag, ArrowRight,
    Cpu, Headphones, Smartphone, Monitor, Cable, Package
} from "lucide-react";
import Link from "next/link";

// Category quick-link icons mapping
const CATEGORY_ICONS: Record<string, React.ElementType> = {
    default: Package,
    "computadores": Monitor,
    "celulares": Smartphone,
    "accesorios": Headphones,
    "cables": Cable,
    "tecnología": Cpu,
};

export default function Home() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5140/api/v1";
                const [prodRes, catRes] = await Promise.all([
                    fetch(`${API_URL}/products?pageSize=8`),
                    fetch(`${API_URL}/categories`),
                ]);
                if (prodRes.ok) {
                    const prodData = await prodRes.json();
                    setProducts(prodData.items || []);
                }
                if (catRes.ok) {
                    const catData = await catRes.json();
                    setCategories(catData.slice(0, 6));
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();

        const savedScrollPos = sessionStorage.getItem("home_scroll_pos");
        if (savedScrollPos) {
            setTimeout(() => {
                window.scrollTo(0, parseInt(savedScrollPos));
                sessionStorage.removeItem("home_scroll_pos");
            }, 100);
        }
    }, []);

    const handleProductClick = () => {
        sessionStorage.setItem("home_scroll_pos", window.scrollY.toString());
    };

    const featuredProducts = products.slice(0, 8);

    return (
        <div className="flex flex-col min-h-screen">
            <Navbar />

            <main className="flex-grow">
                {/* ── 1. HERO ── */}
                <Hero />

                {/* ── 2. CATEGORY QUICK LINKS ── */}
                {!loading && categories.length > 0 && (
                    <section className="py-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Explorar por categoría</h2>
                                <Link href="/catalog" className="text-xs font-bold text-primary flex items-center gap-1 hover:gap-2 transition-all">
                                    Ver todo <ArrowRight size={12} />
                                </Link>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                {/* "Todos" option */}
                                <Link
                                    href="/catalog"
                                    className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-2xl bg-primary text-white hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-95 group"
                                >
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                        <ShoppingBag size={20} />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-wide text-center leading-tight">Todos</span>
                                </Link>

                                {categories.map((cat) => {
                                    const nameLower = cat.name.toLowerCase();
                                    const Icon = Object.entries(CATEGORY_ICONS).find(([key]) =>
                                        nameLower.includes(key)
                                    )?.[1] || CATEGORY_ICONS.default;

                                    return (
                                        <Link
                                            key={cat.id}
                                            href={`/catalog?category=${cat.id}`}
                                            className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-primary/5 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 hover:border-primary/20 transition-all active:scale-95 group"
                                        >
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                                <Icon size={20} />
                                            </div>
                                            <span className="text-[11px] font-bold text-foreground text-center leading-tight line-clamp-2">{cat.name}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                )}

                {/* ── 3. WHY CHOOSE US ── */}
                <section className="py-14 md:py-20 bg-slate-50 dark:bg-slate-950">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                            {[
                                {
                                    icon: Truck,
                                    title: "Envío Veloz",
                                    desc: "Entrega garantizada en menos de 24 horas a tu domicilio.",
                                    color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600",
                                },
                                {
                                    icon: ShieldCheck,
                                    title: "Pago Seguro",
                                    desc: "Tus transacciones están 100% protegidas y encriptadas.",
                                    color: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600",
                                },
                                {
                                    icon: Star,
                                    title: "Calidad Total",
                                    desc: "Productos seleccionados y verificados para garantizar tu satisfacción.",
                                    color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600",
                                },
                                {
                                    icon: Zap,
                                    title: "Soporte 24/7",
                                    desc: "Estamos disponibles para ayudarte en cualquier momento.",
                                    color: "bg-purple-50 dark:bg-purple-900/20 text-purple-600",
                                },
                            ].map((feature, i) => (
                                <div
                                    key={i}
                                    className="glass-card rounded-2xl md:rounded-3xl p-5 md:p-7 space-y-3 md:space-y-4 group hover:-translate-y-1 hover:shadow-xl transition-all duration-500"
                                >
                                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center ${feature.color} group-hover:scale-110 transition-transform duration-300`}>
                                        <feature.icon size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-outfit font-black text-base md:text-lg text-foreground">{feature.title}</h3>
                                        <p className="text-muted-foreground text-xs md:text-sm leading-relaxed mt-1">{feature.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── 4. FEATURED PRODUCTS ── */}
                <section id="products" className="py-10 md:py-16 bg-white dark:bg-slate-900">
                    <div className="max-w-7xl mx-auto px-2 md:px-6">
                        {/* Section Header */}
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 md:mb-12 px-2">
                            <div className="space-y-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full">
                                    <Star size={12} fill="currentColor" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Más Populares</span>
                                </div>
                                <h2 className="text-3xl md:text-5xl font-outfit font-black tracking-tighter">
                                    DESTACADOS <span className="gradient-text">HOY.</span>
                                </h2>
                                <p className="text-muted-foreground text-sm max-w-md">
                                    Los artículos más buscados y mejor valorados de nuestra comunidad.
                                </p>
                            </div>
                            <Link
                                href="/catalog"
                                className="shrink-0 hidden sm:flex items-center gap-2 px-6 py-3 bg-slate-50 dark:bg-slate-800 text-foreground rounded-2xl font-bold border border-slate-100 dark:border-slate-700 hover:border-primary/30 hover:text-primary transition-all text-sm"
                            >
                                Ver todos <ArrowRight size={16} />
                            </Link>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="glass-card rounded-2xl md:rounded-[2rem] p-2 md:p-3 h-[280px] md:h-[420px] animate-pulse">
                                        <div className="aspect-square bg-slate-200 dark:bg-slate-700 rounded-xl md:rounded-[1.5rem] mb-3" />
                                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2" />
                                        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                                    </div>
                                ))}
                            </div>
                        ) : featuredProducts.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
                                {featuredProducts.map((product: Product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        onClick={handleProductClick}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="glass-card rounded-[3rem] p-20 text-center max-w-2xl mx-auto border-dashed">
                                <ShoppingBag className="mx-auto text-muted-foreground mb-6 opacity-20" size={80} />
                                <h3 className="text-2xl font-outfit font-bold mb-2">No hay productos aún</h3>
                                <p className="text-muted-foreground mb-8 text-sm">Estamos preparando nuestra nueva colección. Vuelve pronto.</p>
                            </div>
                        )}

                        {/* ── View More CTA ── */}
                        <div className="mt-12 md:mt-16 text-center">
                            <Link
                                href="/catalog"
                                className="inline-flex items-center gap-3 premium-button px-10 py-5 rounded-2xl font-black text-sm tracking-wide shadow-2xl shadow-primary/20 group"
                            >
                                <ShoppingBag size={18} />
                                Ver Catálogo Completo
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
