"use client";

import { useEffect, useState, useRef } from "react";
import { Product } from "@/types/product";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCart } from "@/context/CartContext";
import { ShoppingCart, Star, Truck, ShieldCheck, ArrowLeft, Heart, Play, Share2, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ProductDetailsClient({ id }: { id: string }) {
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<string>("");
    const [isVideoMode, setIsVideoMode] = useState(false);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

    const carouselRef = useRef<HTMLDivElement>(null);
    // Swipe state
    const swipeStartX = useRef<number>(0);
    const swipeDelta = useRef<number>(0);
    const isSwiping = useRef(false);
    const { addToCart } = useCart();
    const router = useRouter();
    const currentIndex = product?.images?.findIndex(img => img.url === selectedImage) ?? 0;

    useEffect(() => {
        async function fetchProduct() {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5140/api/v1";
                const res = await fetch(`${API_URL}/products/${id}`);
                if (!res.ok) throw new Error("Product not found");
                const data = await res.json();
                setProduct(data);
                setSelectedImage(data.images?.find((img: any) => img.isCover)?.url || data.images?.[0]?.url || "");
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        fetchProduct();
    }, [id]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isVideoModalOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isVideoModalOpen]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col bg-slate-50">
                <Navbar />
                <main className="flex-grow flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary"></div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Cargando...</p>
                    </div>
                </main>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen flex flex-col bg-slate-50">
                <Navbar />
                <main className="flex-grow flex flex-col items-center justify-center space-y-6 text-center px-4">
                    <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                        <ShoppingBag size={40} className="text-slate-400" />
                    </div>
                    <h2 className="text-3xl font-outfit font-black text-slate-800">Producto no encontrado</h2>
                    <p className="text-muted-foreground max-w-md">Lo sentimos, el producto que buscas no existe o ha sido eliminado de nuestro catálogo.</p>
                    <Link href="/" className="premium-button px-8 py-3 rounded-xl flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
                        <ArrowLeft size={16} /> Volver a la Tienda
                    </Link>
                </main>
            </div>
        );
    }

    const discountPercentage = product.discountPercentage || 0;
    const oldPrice = discountPercentage > 0 ? (product.price / (1 - discountPercentage / 100)) : 0;
    const isOutOfStock = product.stock <= 0;

    // Parse description: lines starting with - or * become elegant bullet points
    const renderDescription = (desc: string | null | undefined) => {
        if (!desc) return <p className="text-slate-400 italic">Sin descripción disponible.</p>;

        // Split by lines that start with - or * (treating them as bullet points)
        // Also handle inline separators like "- item1 - item2"
        const lines = desc
            .split(/\n/)
            .flatMap(line => line.split(/(?<=\S)\s*[-*]\s+/))
            .map(s => s.replace(/^\s*[-*]\s*/, '').trim())
            .filter(s => s.length > 0);

        // If we got multiple items, render as bullet list
        if (lines.length > 1) {
            return (
                <ul className="space-y-2.5">
                    {lines.map((line, i) => (
                        <li key={i} className="flex items-start gap-3">
                            <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary"></span>
                            <span className="text-sm md:text-base text-slate-600 leading-relaxed font-medium">{line}</span>
                        </li>
                    ))}
                </ul>
            );
        }

        // Otherwise render as plain paragraph
        return <p className="text-sm md:text-base text-slate-600 leading-relaxed font-medium">{desc}</p>;
    };

    // Pointer-controlled swipe: moves exactly ONE image at a time
    const handlePointerDown = (e: React.PointerEvent) => {
        swipeStartX.current = e.clientX;
        swipeDelta.current = 0;
        isSwiping.current = true;
        carouselRef.current?.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isSwiping.current) return;
        swipeDelta.current = e.clientX - swipeStartX.current;
    };

    const handlePointerUp = () => {
        if (!isSwiping.current || !product?.images) return;
        isSwiping.current = false;
        const THRESHOLD = 45;
        const images = product.images;
        const idx = images.findIndex(img => img.url === selectedImage);
        if (swipeDelta.current < -THRESHOLD && idx < images.length - 1) {
            // Swipe left → next
            scrollToIndex(idx + 1);
        } else if (swipeDelta.current > THRESHOLD && idx > 0) {
            // Swipe right → prev
            scrollToIndex(idx - 1);
        }
        // If below threshold, stays on current image automatically
    };

    const scrollToIndex = (index: number) => {
        if (!product?.images) return;
        setSelectedImage(product.images[index].url);
    };

    const scrollNext = () => {
        if (!product?.images) return;
        const idx = product.images.findIndex(img => img.url === selectedImage);
        if (idx < product.images.length - 1) scrollToIndex(idx + 1);
    };

    const scrollPrev = () => {
        if (!product?.images) return;
        const idx = product.images.findIndex(img => img.url === selectedImage);
        if (idx > 0) scrollToIndex(idx - 1);
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <Navbar />

            <main className="flex-grow pt-16 md:pt-20 pb-24 px-4 sm:px-6">
                <div className="max-w-7xl mx-auto">
                    {/* Navigation Header */}
                    <div className="flex items-center gap-4 mb-3">
                        <button
                            onClick={() => router.back()}
                            className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:bg-primary hover:text-white transition-all shadow-sm group"
                            aria-label="Volver atrás"
                        >
                            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        </button>

                        <nav className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-400">
                            <Link href="/" className="hover:text-primary transition-colors">Inicio</Link>
                            <span className="opacity-50">/</span>
                            <Link href="/catalog" className="hover:text-primary transition-colors">Catálogo</Link>
                            <span className="opacity-50">/</span>
                            <span className="text-slate-800 font-bold">{product.category?.name || 'General'}</span>
                        </nav>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                        {/* Left Column: Gallery (7 cols) */}
                        <div className="lg:col-span-7 space-y-4">
                            <div className="relative aspect-square md:aspect-[4/3] lg:aspect-square bg-white rounded-xl md:rounded-2xl shadow-md shadow-slate-200/50 overflow-hidden border border-slate-100 group">
                            <div
                                ref={carouselRef}
                                className="relative w-full h-full overflow-hidden select-none touch-pan-y"
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                            >
                                {/* All images stacked, only selectedImage visible via opacity transition */}
                                {product.images?.map((img, idx) => (
                                    <div
                                        key={img.id || idx}
                                        className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
                                        style={{ opacity: img.url === selectedImage ? 1 : 0, pointerEvents: img.url === selectedImage ? 'auto' : 'none' }}
                                    >
                                        <img
                                            src={img.url}
                                            alt={product.name}
                                            className="max-w-full max-h-full object-contain p-2 md:p-3 pointer-events-none select-none transition-transform duration-500 group-hover:scale-105"
                                            draggable="false"
                                            loading={idx === 0 ? 'eager' : 'lazy'}
                                        />
                                    </div>
                                ))}
                            </div>

                                {/* Desktop Navigation Arrows */}
                                {product.images && product.images.length > 1 && (
                                    <>
                                        <button
                                            onClick={scrollPrev}
                                            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur shadow-md items-center justify-center text-slate-700 hover:bg-primary hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10 hidden md:flex active:scale-95"
                                            aria-label="Anterior foto"
                                        >
                                            <span className="text-2xl mb-1">&lsaquo;</span>
                                        </button>
                                        <button
                                            onClick={scrollNext}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur shadow-md items-center justify-center text-slate-700 hover:bg-primary hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10 hidden md:flex active:scale-95"
                                            aria-label="Siguiente foto"
                                        >
                                            <span className="text-2xl mb-1">&rsaquo;</span>
                                        </button>
                                    </>
                                )}

                                {/* Mobile Pagination Dots */}
                                {product.images && product.images.length > 1 && (
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 md:hidden bg-black/20 backdrop-blur-sm px-2.5 py-1.5 rounded-full">
                                        {product.images.map((img, idx) => (
                                            <button
                                                key={`dot-${idx}`}
                                                onClick={() => scrollToIndex(idx)}
                                                className={`transition-all duration-300 rounded-full ${selectedImage === img.url
                                                        ? 'w-4 h-1.5 bg-white'
                                                        : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                                                    }`}
                                                aria-label={`Foto ${idx + 1}`}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Play Button Overlay (Temu Style) */}
                                {product.videoUrl && (
                                    <button
                                        onClick={() => setIsVideoModalOpen(true)}
                                        className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg flex items-center gap-2 group hover:scale-105 transition-all text-slate-700 hover:text-primary border border-white"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                                            <Play size={12} className="text-primary group-hover:text-white transition-colors" fill="currentColor" />
                                        </div>
                                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">Ver Video</span>
                                    </button>
                                )}

                                {/* Floating Badges */}
                                <div className="absolute top-6 left-6 flex flex-col gap-2 pointer-events-none">
                                    {product.stock > 0 ? (
                                        <span className="bg-emerald-500/90 backdrop-blur text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/30">
                                            En Stock
                                        </span>
                                    ) : (
                                        <span className="bg-rose-500/90 backdrop-blur text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/30">
                                            Agotado
                                        </span>
                                    )}
                                    {discountPercentage > 0 && (
                                        <span className="bg-white/90 backdrop-blur text-foreground px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg border border-slate-100">
                                            -{discountPercentage}% OFF
                                        </span>
                                    )}
                                </div>

                                {/* Floating Actions */}
                                <div className="absolute top-6 right-6 flex flex-col gap-2">
                                    <button className="w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:scale-110 transition-all active:scale-90">
                                        <Heart size={18} fill="currentColor" className={false ? "text-rose-500" : ""} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (navigator.share) {
                                                const category = product.category?.name || "Producto";
                                                const price = `$${product.price.toFixed(2)}`;
                                                navigator.share({
                                                    title: product.name,
                                                    text: `${category} • ${price} — JCTech Store`,
                                                    url: window.location.href,
                                                });
                                            }
                                        }}
                                        className="w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-lg flex items-center justify-center text-slate-400 hover:text-primary hover:scale-110 transition-all active:scale-90"
                                    >
                                        <Share2 size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Thumbnails Horizontal List (Desktop Only) */}
                            <div className="hidden md:flex overflow-x-auto gap-3 py-2 px-1 snap-x scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                {product.images?.map((img, idx) => (
                                    <button
                                        key={img.id || idx}
                                        onClick={() => {
                                            scrollToIndex(idx);
                                            setIsVideoMode(false);
                                        }}
                                        className={`flex-shrink-0 w-20 h-20 md:w-24 md:h-24 snap-center rounded-2xl overflow-hidden border-2 bg-white transition-all p-1 ${selectedImage === img.url && !isVideoMode ? 'border-primary ring-2 ring-primary/20 scale-95 shadow-md' : 'border-transparent hover:border-slate-200 shadow-sm opacity-80 hover:opacity-100'}`}
                                    >
                                        <img src={img.url} alt="" className="w-full h-full object-contain pointer-events-none" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right Column: Info & Buy (5 cols) */}
                        <div className="lg:col-span-5 flex flex-col h-full">
                            <div className="sticky top-32 space-y-8 bg-white/50 backdrop-blur-xl p-6 md:p-8 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50">
                                {/* Header Info */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
                                            {product.category?.name || 'General'}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <Star size={14} className="text-amber-400 fill-amber-400" />
                                            <span className="text-xs font-bold text-slate-700">4.9 (120)</span>
                                        </div>
                                    </div>

                                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-outfit font-black text-slate-900 leading-[0.95] tracking-tight uppercase">
                                        {product.name}
                                    </h1>

                                    <div className="flex items-baseline gap-3">
                                        <span className="text-4xl md:text-5xl font-outfit font-black text-primary tracking-tighter">
                                            ${product.price.toFixed(2)}
                                        </span>
                                        {oldPrice > 0 && (
                                            <span className="text-lg text-slate-400 line-through decoration-2 decoration-rose-400/50 font-medium">
                                                ${oldPrice.toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="w-full h-px bg-slate-100"></div>

                                {/* Description */}
                                <div className="space-y-3">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Sobre este producto</h3>
                                    <div>
                                        {renderDescription(product.description)}
                                    </div>
                                </div>

                                {/* Benefits Matrix */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-indigo-50/50 p-4 rounded-2xl flex flex-col gap-2 border border-indigo-100/50">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                            <Truck size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-black tracking-widest text-indigo-400">Envío</p>
                                            <p className="text-xs font-bold text-indigo-900">Nacional Rápido</p>
                                        </div>
                                    </div>
                                    <div className="bg-emerald-50/50 p-4 rounded-2xl flex flex-col gap-2 border border-emerald-100/50">
                                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                            <ShieldCheck size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-black tracking-widest text-emerald-400">Garantía</p>
                                            <p className="text-xs font-bold text-emerald-900">30 Días de Retorno</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="space-y-4 pt-4">
                                    <button
                                        onClick={() => { if (!isOutOfStock) addToCart(product); }}
                                        disabled={isOutOfStock}
                                        className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 font-black uppercase tracking-widest text-lg ${isOutOfStock
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                            : 'premium-button shadow-xl shadow-primary/20 group hover:-translate-y-1'
                                            }`}
                                    >
                                        {isOutOfStock ? (
                                            <>
                                                <ShoppingCart size={24} />
                                                <span>Producto Agotado</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="relative">
                                                    <ShoppingCart size={24} className="group-hover:scale-110 transition-transform duration-300" />
                                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping"></div>
                                                </div>
                                                <span>Añadir al Carrito</span>
                                            </>
                                        )}
                                    </button>

                                    <p className="text-center text-[10px] text-slate-400 font-medium">
                                        {isOutOfStock
                                            ? 'Este producto no está disponible en este momento.'
                                            : 'Pago seguro con encriptación SSL de 256-bits.'
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />

            {/* Video Fullscreen Modal Overlay (Temu Style) */}
            {
                isVideoModalOpen && product.videoUrl && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-fade-in">
                        <button
                            onClick={() => setIsVideoModalOpen(false)}
                            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all z-[110]"
                        >
                            <span className="text-2xl font-light">×</span>
                        </button>

                        <div className="w-full max-w-4xl h-full md:h-[80vh] flex flex-col items-center justify-center px-4 relative">
                            <video
                                src={product.videoUrl}
                                autoPlay
                                controls
                                className="w-full max-h-[70vh] object-contain rounded-2xl"
                            />

                            {/* Quick Add to Cart from Video Mode */}
                            <div className="absolute bottom-8 left-0 right-0 px-6 flex justify-center">
                                <button
                                    onClick={() => {
                                        if (!isOutOfStock) {
                                            addToCart(product);
                                            setIsVideoModalOpen(false);
                                        }
                                    }}
                                    disabled={isOutOfStock}
                                    className={`w-full max-w-md py-4 rounded-full flex items-center justify-center gap-3 transition-all duration-300 font-bold uppercase tracking-widest text-sm sm:text-base ${isOutOfStock
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-primary text-white hover:bg-primary/90 shadow-2xl shadow-primary/30 active:scale-95'
                                        }`}
                                >
                                    <ShoppingCart size={20} />
                                    {isOutOfStock ? 'Agotado' : 'Añadir al Carrito'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
