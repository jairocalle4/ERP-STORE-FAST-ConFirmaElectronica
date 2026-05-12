"use client";

import { Search, ShoppingCart, Menu, X, Sun, Moon, Monitor } from "lucide-react";
import { CART_ICON_ID } from "@/components/FlyToCart";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { useCompany } from "@/context/CompanyContext";
import { useTheme, type Theme } from "@/context/ThemeContext";

interface NavbarProps {
    showSearch?: boolean;
    searchValue?: string;
    onSearchChange?: (val: string) => void;
}

const THEME_ICONS: Record<Theme, React.ElementType> = { light: Sun, dark: Moon, system: Monitor };
const THEME_LABELS: Record<Theme, string> = { light: 'Claro', dark: 'Oscuro', system: 'Sistema' };

export default function Navbar({ showSearch, searchValue, onSearchChange }: NavbarProps) {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { totalItems, setIsCartOpen } = useCart();
    const { company } = useCompany();
    const { theme, cycleTheme } = useTheme();
    const ThemeIcon = THEME_ICONS[theme];

    // Split name into two parts for styling: first half normal, second half gradient
    const name = company.name || "FASTSTORE";
    const half = Math.ceil(name.length / 2);
    const nameFirst = name.slice(0, half);
    const nameLast = name.slice(half);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <>
            <div className="fixed top-0 left-0 right-0 z-[60]">
                <nav
                    className={`transition-all duration-300 ease-out ${isScrolled || isMenuOpen
                        ? "glass-card mx-2 sm:mx-4 mt-2 sm:mt-4 rounded-2xl py-3 px-4 sm:px-6 shadow-lg shadow-primary/5"
                        : "bg-transparent py-4 sm:py-6 px-4 sm:px-8"
                        }`}
                >
                    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                        {/* Logo or Dynamic Search */}
                        <div className="flex-1 flex items-center min-w-0">
                            {showSearch ? (
                                <div className="flex items-center gap-2 bg-slate-100/80 backdrop-blur-md p-2.5 rounded-xl border border-slate-200 w-full max-w-sm transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                                    <Search size={16} className="text-muted-foreground ml-2 shrink-0" />
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        className="bg-transparent border-none outline-none w-full text-sm font-medium text-slate-800 placeholder:text-slate-400"
                                        value={searchValue || ""}
                                        onChange={(e) => onSearchChange?.(e.target.value)}
                                    />
                                </div>
                            ) : (
                                <Link href="/" className="flex items-center gap-2 shrink-0">
                                    <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center">
                                        <Image src="/icon-192x192.png" alt="Logo" fill className="object-contain" priority />
                                    </div>
                                    <span className="text-lg sm:text-xl font-outfit font-black tracking-tighter text-foreground truncate">
                                        {nameFirst}<span className="gradient-text">{nameLast}</span>
                                    </span>
                                </Link>
                            )}
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center gap-8">
                            {[
                                { name: "Colecciones", href: "/catalog" },
                                { name: "Nosotros", href: "/about" },
                                { name: "Ofertas", href: "/catalog?filter=offers" },
                                { name: "Servicios", href: "/services" },
                                { name: "Contacto", href: "#footer-contact" }
                            ].map((item) => (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors duration-300"
                                >
                                    {item.name}
                                </Link>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3">

                            {/* User removed as per request */}
                        {/* Theme Toggle - Visible in both modes */}
                            <button
                                onClick={cycleTheme}
                                title={`Tema: ${THEME_LABELS[theme]}`}
                                aria-label={`Cambiar tema — ${THEME_LABELS[theme]}`}
                                className="relative group p-2.5 rounded-xl bg-indigo-50 dark:bg-slate-700 border border-indigo-200 dark:border-slate-600 text-indigo-600 dark:text-slate-200 hover:bg-indigo-100 dark:hover:bg-slate-600 hover:scale-105 active:scale-95 transition-all shadow-sm"
                            >
                                <ThemeIcon size={18} className="transition-all duration-300" />
                                <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                    {THEME_LABELS[theme]}
                                </span>
                            </button>
                            <button
                                id={CART_ICON_ID}
                                onClick={() => setIsCartOpen(true)}
                                className="relative p-2.5 rounded-xl premium-button shadow-lg shadow-primary/20 group hover:scale-105 active:scale-95 transition-all"
                            >
                                <ShoppingCart size={20} className="group-hover:scale-110 transition-transform" />
                                {totalItems > 0 && (
                                    <span
                                        key={totalItems}
                                        className="absolute -top-2 -right-2 min-w-[20px] h-5 bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 px-1 z-10"
                                        style={{ animation: 'cartBump 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}
                                    >
                                        {totalItems > 99 ? '99+' : totalItems}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="md:hidden p-2.5 rounded-xl hover:bg-muted text-foreground transition-all active:scale-95"
                            >
                                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                        </div>
                    </div>
                </nav>
            </div>

            {/* Mobile Menu Overlay */}
            {
                isMenuOpen && (
                <div className="fixed inset-0 z-50 bg-white/95 dark:bg-slate-950/97 backdrop-blur-xl animate-fade-in md:hidden">
                        <div className="flex flex-col items-center justify-center h-full space-y-8 px-8">
                            {[
                                { name: "Colecciones", href: "/catalog" },
                                { name: "Nosotros", href: "/about" },
                                { name: "Ofertas", href: "/catalog?filter=offers" },
                                { name: "Servicios", href: "/services" },
                                { name: "Contacto", href: "#footer-contact" }
                            ].map((item, i) => (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setIsMenuOpen(false)}
                                    className="text-4xl font-outfit font-black tracking-tighter text-foreground hover:text-primary transition-all animate-slide-in-up"
                                    style={{ animationDelay: `${i * 100}ms` }}
                                >
                                    {item.name}
                                </Link>
                            ))}

                            {/* Theme Toggle in mobile menu */}
                            <button
                                onClick={() => { cycleTheme(); setIsMenuOpen(false); }}
                                className="mt-4 flex items-center gap-3 px-6 py-3 rounded-2xl bg-indigo-50 dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 text-indigo-600 dark:text-slate-200 font-bold text-sm animate-slide-in-up"
                                style={{ animationDelay: '500ms' }}
                            >
                                <ThemeIcon size={20} />
                                <span>Modo {THEME_LABELS[theme]}</span>
                            </button>
                        </div>
                    </div>
                )
            }
        </>
    );
}
