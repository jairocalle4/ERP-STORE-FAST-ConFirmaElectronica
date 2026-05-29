"use client";

import { ArrowRight, ShoppingBag, Star, Zap } from "lucide-react";
import Link from "next/link";
import { useCompany } from "@/context/CompanyContext";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=1000&auto=format&fit=crop";

export default function Hero() {
    const { company } = useCompany();
    const heroImage = company.coverImageUrl?.trim() || FALLBACK_IMAGE;

    return (
        <section className="relative overflow-hidden bg-background">

            {/* ── Ambient blobs (desktop only) ── */}
            <div className="hidden lg:block absolute top-0 -left-40 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[160px] pointer-events-none" />
            <div className="hidden lg:block absolute bottom-0 -right-40 w-[500px] h-[500px] bg-indigo-400/8 rounded-full blur-[140px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6">

                {/* ══════════ MOBILE layout ══════════ */}
                <div className="lg:hidden pt-20 pb-8 space-y-5">

                    {/* Badge */}
                    <div className="flex justify-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/15 rounded-full">
                            <Zap size={10} className="text-primary fill-primary" />
                            <span className="text-[9px] uppercase font-black tracking-[0.2em] text-primary">Colección 2026</span>
                        </div>
                    </div>

                    {/* Headline */}
                    <div className="text-center space-y-2">
                        <h1 className="text-[2.6rem] leading-none font-outfit font-black tracking-tighter text-foreground">
                            TODO LO QUE<br />
                            <span className="gradient-text">NECESITAS.</span>
                        </h1>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                            Tecnología y productos de calidad,{" "}
                            <span className="font-semibold text-foreground">directo a tu puerta</span>.
                        </p>
                    </div>

                    {/* Image — after title, elegant */}
                    <div className="relative mx-auto w-full max-w-sm">
                        <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-primary/10 aspect-[4/3]">
                            <img
                                src={heroImage}
                                alt={`Tienda ${company.name || "JCTech"}`}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                            {/* Stats strip at bottom of image */}
                            <div className="absolute bottom-0 left-0 right-0 flex justify-around py-3 px-4 bg-black/25 backdrop-blur-sm">
                                {[["15k+", "Clientes"], ["98%", "Satisfechos"], ["24h", "Entrega"]].map(([val, label]) => (
                                    <div key={label} className="text-center">
                                        <p className="text-sm font-outfit font-black text-white">{val}</p>
                                        <p className="text-[8px] text-white/70 uppercase font-bold tracking-widest">{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex gap-3">
                        <Link
                            href="/catalog"
                            className="premium-button flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/25 font-bold text-sm group"
                        >
                            <ShoppingBag size={16} />
                            Explorar
                            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                        <Link
                            href="/catalog?filter=offers"
                            className="flex-1 bg-white dark:bg-slate-800 text-foreground py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 text-sm active:scale-95 transition-all"
                        >
                            <Star size={14} className="text-amber-500 fill-amber-500" />
                            Ofertas
                        </Link>
                    </div>
                </div>

                {/* ══════════ DESKTOP layout ══════════ */}
                <div className="hidden lg:grid grid-cols-2 gap-16 items-center min-h-screen py-0">

                    {/* Left: Text */}
                    <div className="space-y-8 animate-fade-in relative z-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
                            <Zap size={12} className="text-primary fill-primary" />
                            <span className="text-[10px] uppercase font-black tracking-[0.2em] text-primary">
                                Colección 2026 Ya Disponible
                            </span>
                        </div>

                        <div>
                            <h1 className="text-7xl xl:text-8xl font-outfit font-black leading-none tracking-tighter text-foreground">
                                TODO LO QUE<br />
                                <span className="gradient-text">NECESITAS.</span>
                            </h1>
                            <p className="mt-6 max-w-md text-lg text-muted-foreground leading-relaxed">
                                Tecnología, accesorios y productos de calidad,{" "}
                                <span className="font-semibold text-foreground">directo a tu puerta</span>.
                                Compra fácil, rápido y seguro.
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <Link href="/catalog" className="premium-button px-10 py-5 rounded-2xl flex items-center gap-3 shadow-2xl shadow-primary/30 group font-bold text-base">
                                <ShoppingBag size={20} />
                                Explorar Tienda
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link href="/catalog?filter=offers" className="bg-white dark:bg-slate-800 text-foreground px-10 py-5 rounded-2xl font-bold flex items-center gap-3 border border-slate-200 dark:border-slate-700 shadow-md transition-all active:scale-95 text-base">
                                <Star size={18} className="text-amber-500 fill-amber-500" />
                                Ver Ofertas
                            </Link>
                        </div>

                        <div className="flex items-center gap-8 pt-1">
                            {[["15k+", "Clientes"], ["98%", "Satisfechos"], ["24h", "Entrega"]].map(([val, label], i, arr) => (
                                <div key={label} className="flex items-center gap-8">
                                    <div>
                                        <p className="text-2xl font-outfit font-black text-foreground">{val}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{label}</p>
                                    </div>
                                    {i < arr.length - 1 && <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Image */}
                    <div className="relative animate-fade-in [animation-delay:200ms]">
                        <div className="relative z-10 w-full aspect-square rounded-[3rem] overflow-hidden shadow-2xl shadow-primary/10 rotate-2 hover:rotate-0 transition-all duration-700">
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
                            <div className="flex gap-1 mt-1">
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
            </div>
        </section>
    );
}
