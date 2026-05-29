"use client";

import { ArrowRight, ShoppingBag, Star, Zap } from "lucide-react";
import Link from "next/link";
import { useCompany } from "@/context/CompanyContext";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=1000&auto=format&fit=crop";

export default function Hero() {
    const { company } = useCompany();
    const heroImage = company.coverImageUrl?.trim() || FALLBACK_IMAGE;

    return (
        <section className="relative min-h-screen flex items-center pt-20 overflow-hidden bg-background">
            {/* Ambient blobs */}
            <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-indigo-400/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-300/5 rounded-full blur-[160px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center py-10 lg:py-0">

                {/* ── LEFT: Content ── */}
                <div className="space-y-6 sm:space-y-8 animate-fade-in relative z-10 text-center lg:text-left">

                    {/* Pill badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
                        <Zap size={12} className="text-primary fill-primary" />
                        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-primary">
                            Colección 2026 Ya Disponible
                        </span>
                    </div>

                    {/* Headline */}
                    <div>
                        <h1 className="text-5xl sm:text-6xl md:text-7xl xl:text-8xl font-outfit font-black leading-none tracking-tighter text-foreground">
                            TODO LO QUE<br />
                            <span className="gradient-text">NECESITAS.</span>
                        </h1>
                        <p className="mt-4 sm:mt-6 max-w-md mx-auto lg:mx-0 text-base sm:text-lg text-muted-foreground leading-relaxed">
                            Tecnología, accesorios y productos de calidad,{" "}
                            <span className="font-semibold text-foreground">directo a tu puerta</span>.
                            Compra fácil, rápido y seguro.
                        </p>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2">
                        <Link
                            href="/catalog"
                            className="premium-button px-8 py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-primary/30 group text-base font-bold"
                        >
                            <ShoppingBag size={20} />
                            <span>Explorar Tienda</span>
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link
                            href="/catalog?filter=offers"
                            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-foreground px-8 py-4 sm:py-5 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-black/5 transition-all active:scale-95 border border-slate-200 dark:border-slate-700 text-base"
                        >
                            <Star size={18} className="text-amber-500 fill-amber-500" />
                            <span>Ver Ofertas</span>
                        </Link>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 sm:gap-10 justify-center lg:justify-start pt-2">
                        <div className="text-center lg:text-left">
                            <p className="text-2xl sm:text-3xl font-outfit font-black text-foreground">15k+</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">Clientes</p>
                        </div>
                        <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />
                        <div className="text-center lg:text-left">
                            <p className="text-2xl sm:text-3xl font-outfit font-black text-foreground">98%</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">Satisfechos</p>
                        </div>
                        <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />
                        <div className="text-center lg:text-left">
                            <p className="text-2xl sm:text-3xl font-outfit font-black text-foreground">24h</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">Entrega</p>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Image ── */}
                <div className="relative animate-fade-in [animation-delay:200ms] hidden sm:block">
                    {/* Main image */}
                    <div className="relative z-10 w-full aspect-square rounded-[3rem] overflow-hidden shadow-2xl shadow-primary/10 hover:shadow-primary/20 rotate-2 hover:rotate-0 transition-all duration-700">
                        <img
                            src={heroImage}
                            alt={`Tienda ${company.name || "JCTech"}`}
                            className="w-full h-full object-cover scale-110 hover:scale-100 transition-transform duration-1000"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    </div>

                    {/* Floating card: Deals */}
                    <div className="absolute -top-6 -right-4 lg:-right-8 glass-card p-4 rounded-2xl shadow-2xl z-20 hover:-translate-y-1 transition-transform duration-500">
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest">Oferta Activa</p>
                        <p className="text-xl font-outfit font-black text-foreground mt-0.5">-40% DCTO</p>
                        <div className="flex items-center gap-1 mt-1">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} size={10} className="text-amber-400 fill-amber-400" />
                            ))}
                        </div>
                    </div>

                    {/* Floating card: Shipping */}
                    <div className="absolute -bottom-6 -left-4 lg:-left-8 glass-card p-4 rounded-2xl shadow-2xl z-20 flex items-center gap-3 hover:-translate-y-1 transition-transform duration-500 [transition-delay:100ms]">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 shrink-0">
                            <ShoppingBag size={20} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Envío Gratis</p>
                            <p className="font-outfit font-bold text-foreground text-sm">Desde $50.00</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
