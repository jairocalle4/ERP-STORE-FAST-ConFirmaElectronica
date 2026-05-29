"use client";

import { ShoppingBag, Facebook, Instagram, Mail, Phone, MapPin, MessageCircle, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function Footer() {
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        async function fetchSettings() {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5140/api/v1";
                const res = await fetch(`${API_URL}/CompanySettings`);
                if (res.ok) {
                    const data = await res.json();
                    setSettings(data);
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            }
        }
        fetchSettings();
    }, []);

    const whatsappNumber = settings?.phone?.replace(/\D/g, "") || "";
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Hola,%20me%20interesa%20un%20producto%20de%20su%20tienda.`;

    return (
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">

            {/* ── Top CTA Banner ── */}
            <div className="bg-gradient-to-r from-primary via-purple-600 to-indigo-600 py-10 px-6">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="text-center sm:text-left">
                        <p className="text-white/70 text-xs uppercase tracking-widest font-bold mb-1">¿Listo para comprar?</p>
                        <h3 className="text-2xl sm:text-3xl font-outfit font-black text-white tracking-tight">
                            Explora todo nuestro catálogo
                        </h3>
                    </div>
                    <Link
                        href="/catalog"
                        className="flex items-center gap-2 bg-white text-primary font-black px-8 py-4 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 shadow-xl whitespace-nowrap text-sm"
                    >
                        <ShoppingBag size={18} />
                        Ver Productos
                        <ArrowUpRight size={16} />
                    </Link>
                </div>
            </div>

            {/* ── Main Footer Grid ── */}
            <div className="max-w-7xl mx-auto px-6 pt-16 pb-10 grid grid-cols-2 md:grid-cols-4 gap-10">

                {/* Brand Column */}
                <div className="space-y-5 col-span-2 md:col-span-1">
                    <Link href="/" className="flex items-center gap-2.5">
                        <div className="relative w-9 h-9 flex items-center justify-center">
                            <Image src="/icon-192x192.png" alt="Logo" fill className="object-contain" />
                        </div>
                        <span className="text-xl font-outfit font-black tracking-tighter text-foreground">
                            {settings?.name?.toUpperCase() || "JC"}
                            <span className="gradient-text">{settings?.name ? "" : "TECH"}</span>
                        </span>
                    </Link>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Tu destino de confianza para tecnología, accesorios y productos de calidad. Compra fácil, entrega rápida.
                    </p>

                    {/* Social Icons — always colored, animated on hover */}
                    <div className="flex gap-3">
                        <a
                            href="https://www.facebook.com/profile.php?id=61589624723900"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all duration-300 hover:scale-110 hover:-translate-y-0.5 active:scale-95 shadow-md"
                            style={{ background: '#1877F2' }}
                            aria-label="Facebook"
                        >
                            <Facebook size={18} />
                        </a>
                        <a
                            href="https://www.instagram.com/jctechsoluciones/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all duration-300 hover:scale-110 hover:-translate-y-0.5 active:scale-95 shadow-md"
                            style={{ background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }}
                            aria-label="Instagram"
                        >
                            <Instagram size={18} />
                        </a>
                        {whatsappNumber && (
                            <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all duration-300 hover:scale-110 hover:-translate-y-0.5 active:scale-95 shadow-md"
                                style={{ background: '#25D366' }}
                                aria-label="WhatsApp"
                            >
                                <MessageCircle size={18} />
                            </a>
                        )}
                    </div>
                </div>

                {/* Links Column */}
                <div>
                    <h4 className="font-outfit font-black text-foreground text-sm uppercase tracking-wider mb-5">Tienda</h4>
                    <ul className="space-y-3">
                        {[
                            { label: "Todos los Productos", href: "/catalog" },
                            { label: "Ofertas", href: "/catalog?filter=offers" },
                            { label: "Envíos y Devoluciones", href: "/shipping" },
                            { label: "Términos y Condiciones", href: "/terms" },
                        ].map((item) => (
                            <li key={item.href}>
                                <Link href={item.href} className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 group">
                                    <span className="w-0 group-hover:w-3 h-px bg-primary transition-all duration-300 rounded" />
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Company Column */}
                <div>
                    <h4 className="font-outfit font-black text-foreground text-sm uppercase tracking-wider mb-5">Nosotros</h4>
                    <ul className="space-y-3">
                        {[
                            { label: "Sobre Nosotros", href: "/about" },
                            { label: "Servicios Tech", href: "/services" },
                            { label: "Blog & Noticias", href: "/about" },
                        ].map((item) => (
                            <li key={item.href}>
                                <Link href={item.href} className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 group">
                                    <span className="w-0 group-hover:w-3 h-px bg-primary transition-all duration-300 rounded" />
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Contact Column */}
                <div>
                    <h4 className="font-outfit font-black text-foreground text-sm uppercase tracking-wider mb-5">Contacto</h4>
                    <ul className="space-y-4">
                        {settings?.address && (
                            <li>
                                <a
                                    href="https://maps.app.goo.gl/dbEidUuc9YYa3UaG6"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start gap-3 group"
                                >
                                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                        <MapPin size={14} className="text-primary" />
                                    </div>
                                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2">
                                        {settings.address}
                                    </span>
                                </a>
                            </li>
                        )}
                        {settings?.phone && (
                            <li>
                                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                        <Phone size={14} className="text-emerald-600" />
                                    </div>
                                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                        {settings.phone}
                                    </span>
                                </a>
                            </li>
                        )}
                        {settings?.email && (
                            <li>
                                <a href={`mailto:${settings.email}`} className="flex items-center gap-3 group">
                                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                        <Mail size={14} className="text-primary" />
                                    </div>
                                    <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">
                                        {settings.email}
                                    </span>
                                </a>
                            </li>
                        )}
                    </ul>
                </div>
            </div>

            {/* ── Bottom Bar ── */}
            <div className="max-w-7xl mx-auto px-6 py-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
                <p className="text-xs text-muted-foreground">
                    © 2026 <span className="font-bold">{settings?.name || "JCTech Soluciones"}</span>. Todos los derechos reservados.
                </p>
                <p className="text-xs text-muted-foreground">
                    Hecho con ❤️ en Ecuador 🇪🇨
                </p>
            </div>
        </footer>
    );
}
