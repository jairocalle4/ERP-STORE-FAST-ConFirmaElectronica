"use client";

import { ArrowRight, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useCompany } from "@/context/CompanyContext";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=1000&auto=format&fit=crop";

export default function Hero() {
    const { company } = useCompany();
    const heroImage = company.coverImageUrl?.trim() || FALLBACK_IMAGE;

    return (
        <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary/20 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-400/20 rounded-full blur-[120px]"></div>

            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Content */}
                <div className="space-y-8 animate-fade-in relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/20 dark:border-slate-700/30 rounded-full shadow-sm">
                        <span className="w-2 h-2 bg-primary animate-pulse rounded-full"></span>
                        <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground">Colección 2026 Ya Disponible</span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl md:text-8xl font-outfit font-black leading-none tracking-tighter text-foreground">
                        ESTILO QUE <br />
                        <span className="gradient-text">TE DEFINE.</span>
                    </h1>

                    <p className="max-w-md text-lg text-muted-foreground leading-relaxed">
                        Explora una selección única de productos diseñados para elevar tu día a día. Calidad sin compromisos, Directo a tu puerta.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                        <Link href="/catalog" className="premium-button px-6 sm:px-10 py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-primary/30 group">
                            <span>Comprar Ahora</span>
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link href="/catalog?filter=offers" className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-foreground px-6 sm:px-10 py-4 sm:py-5 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-black/5 transition-all active:scale-95 border border-slate-100 dark:border-slate-700">
                            <ShoppingBag size={18} />
                            <span>Ver Ofertas</span>
                        </Link>
                    </div>

                    <div className="flex items-center gap-6 sm:gap-8 pt-4 sm:pt-6">
                        <div>
                            <p className="text-2xl sm:text-3xl font-outfit font-black text-foreground">15k+</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Clientes</p>
                        </div>
                        <div className="w-px h-10 bg-slate-200 dark:bg-slate-700"></div>
                        <div>
                            <p className="text-2xl sm:text-3xl font-outfit font-black text-foreground">98%</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Satisfechos</p>
                        </div>
                    </div>
                </div>

                {/* Visual / Image — controlled from ERP Settings (coverImageUrl) */}
                <div className="relative animate-fade-in [animation-delay:200ms]">
                    <div className="relative z-10 w-full aspect-square rounded-[3rem] overflow-hidden shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-700">
                        <img
                            src={heroImage}
                            alt="Imagen de portada de la tienda"
                            className="w-full h-full object-cover scale-110 hover:scale-100 transition-transform duration-1000"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                    </div>

                    {/* Floating elements */}
                    <div className="absolute -top-10 -right-10 glass-card p-6 rounded-3xl shadow-xl space-y-2 translate-y-10 hover:translate-y-0 transition-transform duration-500 z-20">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Oferta Flash</p>
                        <p className="text-xl font-outfit font-black">-40% DCTO</p>
                    </div>

                    <div className="absolute -bottom-10 -left-10 glass-card p-6 rounded-3xl shadow-xl flex items-center gap-4 -translate-y-10 hover:translate-y-0 transition-transform duration-500 z-20">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <ShoppingBag size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase">Envío Gratis</p>
                            <p className="font-outfit font-bold">Desde $99.00</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
