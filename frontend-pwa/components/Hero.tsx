"use client";

import { ArrowRight, ShoppingBag, Star, Zap } from "lucide-react";
import Link from "next/link";
import { useCompany } from "@/context/CompanyContext";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=1000&auto=format&fit=crop";

export default function Hero() {
    const { company } = useCompany();
    const heroImage = company.coverImageUrl?.trim() || FALLBACK_IMAGE;

    return (
        <section className="relative flex flex-col lg:flex-row items-center pt-16 lg:pt-0 lg:min-h-screen overflow-hidden bg-background">

            {/* Ambient blobs — desktop only to avoid mobile perf hit */}
            <div className="hidden lg:block absolute top-1/4 -left-32 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="hidden lg:block absolute bottom-0 right-0 w-[400px] h-[400px] bg-indigo-400/10 rounded-full blur-[120px] pointer-events-none" />

            {/* ── MOBILE: Image banner (full-width, compact) ── */}
            <div className="w-full lg:hidden relative">
                <div className="relative w-full h-52 sm:h-64 overflow-hidden">
                    <img
                        src={heroImage}
                        alt={`Tienda ${company.name || "JCTech"}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-background" />

                    {/* Badge on image */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/20">
                        <Zap size={10} className="text-amber-400 fill-amber-400" />
                        <span className="text-[9px] uppercase font-black tracking-widest text-white">Colección 2026</span>
                    </div>

                    {/* Stats strip on image */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-around py-2.5 px-4 bg-black/30 backdrop-blur-md">
                        <div className="text-center">
                            <p className="text-base font-outfit font-black text-white">15k+</p>
                            <p className="text-[9px] text-white/70 uppercase font-bold tracking-widest">Clientes</p>
                        </div>
                        <div className="w-px bg-white/20" />
                        <div className="text-center">
                            <p className="text-base font-outfit font-black text-white">98%</p>
                            <p className="text-[9px] text-white/70 uppercase font-bold tracking-widest">Satisfechos</p>
                        </div>
                        <div className="w-px bg-white/20" />
                        <div className="text-center">
                            <p className="text-base font-outfit font-black text-white">24h</p>
                            <p className="text-[9px] text-white/70 uppercase font-bold tracking-widest">Entrega</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── MOBILE + DESKTOP: Content ── */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-16 items-center py-6 lg:py-0 lg:min-h-screen">

                {/* Left column: text */}
                <div className="space-y-4 sm:space-y-6 animate-fade-in relative z-10 text-center lg:text-left">

                    {/* Pill — only desktop (mobile shows it on image) */}
                    <div className="hidden lg:inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
                        <Zap size={12} className="text-primary fill-primary" />
                        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-primary">
                            Colección 2026 Ya Disponible
                        </span>
                    </div>

                    {/* Headline */}
                    <div>
                        <h1 className="text-4xl sm:text-5xl lg:text-7xl xl:text-8xl font-outfit font-black leading-none tracking-tighter text-foreground">
                            TODO LO QUE<br />
                            <span className="gradient-text">NECESITAS.</span>
                        </h1>
                        <p className="mt-3 lg:mt-5 max-w-md mx-auto lg:mx-0 text-sm sm:text-base text-muted-foreground leading-relaxed">
                            Tecnología, accesorios y productos de calidad,{" "}
                            <span className="font-semibold text-foreground">directo a tu puerta</span>.
                        </p>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex flex-row gap-2.5 justify-center lg:justify-start">
                        <Link
                            href="/catalog"
                            className="premium-button flex-1 sm:flex-none px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-primary/25 group font-bold text-sm"
                        >
                            <ShoppingBag size={16} />
                            <span>Explorar</span>
                            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                        <Link
                            href="/catalog?filter=offers"
                            className="flex-1 sm:flex-none bg-white dark:bg-slate-800 text-foreground px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md border border-slate-200 dark:border-slate-700 transition-all active:scale-95 text-sm"
                        >
                            <Star size={15} className="text-amber-500 fill-amber-500" />
                            <span>Ofertas</span>
                        </Link>
                    </div>

                    {/* Stats — desktop only (mobile shows on image) */}
                    <div className="hidden lg:flex items-center gap-8 justify-start pt-1">
                        {[
                            { val: "15k+", label: "Clientes" },
                            { val: "98%", label: "Satisfechos" },
                            { val: "24h", label: "Entrega" },
                        ].map((stat, i, arr) => (
                            <div key={i} className="flex items-center gap-8">
                                <div>
                                    <p className="text-2xl font-outfit font-black text-foreground">{stat.val}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{stat.label}</p>
                                </div>
                                {i < arr.length - 1 && <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right column: Image — desktop only */}
                <div className="relative animate-fade-in [animation-delay:200ms] hidden lg:block">
                    <div className="relative z-10 w-full aspect-square rounded-[3rem] overflow-hidden shadow-2xl shadow-primary/10 hover:shadow-primary/20 rotate-2 hover:rotate-0 transition-all duration-700">
                        <img
                            src={heroImage}
                            alt={`Tienda ${company.name || "JCTech"}`}
                            className="w-full h-full object-cover scale-110 hover:scale-100 transition-transform duration-1000"
                            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    </div>

                    {/* Floating: Deal */}
                    <div className="absolute -top-6 -right-8 glass-card p-4 rounded-2xl shadow-2xl z-20 hover:-translate-y-1 transition-transform duration-500">
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest">Oferta Activa</p>
                        <p className="text-xl font-outfit font-black text-foreground mt-0.5">-40% DCTO</p>
                        <div className="flex items-center gap-1 mt-1">
                            {[...Array(5)].map((_, i) => <Star key={i} size={10} className="text-amber-400 fill-amber-400" />)}
                        </div>
                    </div>

                    {/* Floating: Shipping */}
                    <div className="absolute -bottom-6 -left-8 glass-card p-4 rounded-2xl shadow-2xl z-20 flex items-center gap-3 hover:-translate-y-1 transition-transform duration-500">
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
