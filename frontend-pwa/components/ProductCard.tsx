"use client";

import { useState, useEffect } from 'react';
import { Product } from '@/types/product';
import { Play, ShoppingCart, Heart, Eye } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';

interface ProductCardProps {
    product: Product;
    onClick?: () => void;
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [isWishlisted, setIsWishlisted] = useState(false);
    const { addToCart } = useCart();
    const isOutOfStock = product.stock <= 0;

    useEffect(() => {
        const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
        setIsWishlisted(wishlist.includes(product.id));
    }, [product.id]);

    // Added logic: Stop video playback when scrolling the page
    useEffect(() => {
        if (!isHovered) return;

        const handleScroll = () => {
            setIsHovered(false);
        };

        // Escuchamos el scroll de la ventana y los toques en mobile (deslizamiento)
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('touchmove', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('touchmove', handleScroll);
        };
    }, [isHovered]);

    const toggleWishlist = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
        let newWishlist;

        if (wishlist.includes(product.id)) {
            newWishlist = wishlist.filter((id: number) => id !== product.id);
            setIsWishlisted(false);
        } else {
            newWishlist = [...wishlist, product.id];
            setIsWishlisted(true);
        }

        localStorage.setItem('wishlist', JSON.stringify(newWishlist));
    };

    return (
        <div
            className={`glass-card rounded-2xl md:rounded-[2rem] p-2 md:p-3 flex flex-col h-full group transition-all duration-500 ${isOutOfStock ? 'opacity-80' : 'hover:-translate-y-2'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Link
                href={`/product/${product.id}`}
                className="flex flex-col flex-1"
                onClick={onClick}
            >
                {/* Image Container */}
                <div className={`relative aspect-[4/5] bg-white dark:bg-slate-800 rounded-xl md:rounded-[1.8rem] mb-3 md:mb-4 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-700 p-4 shadow-inner ${isOutOfStock ? 'grayscale' : ''}`}>
                    {product.videoUrl && isHovered ? (
                        <div className="relative w-full h-full">
                            <video
                                src={product.videoUrl}
                                autoPlay
                                muted
                                loop
                                className="h-full w-full object-cover rounded-[1.2rem]"
                            />
                            {/* Invisible overlay to catch clicks and pause video */}
                            <button
                                className="absolute inset-0 w-full h-full z-10"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsHovered(false);
                                }}
                                aria-label="Detener video"
                            />
                        </div>
                    ) : product.images && product.images.length > 0 ? (
                        <img
                            src={product.images.find(img => img.isCover)?.url || product.images[0].url}
                            alt={product.name}
                            className="h-full w-full object-contain hover:object-cover transition-all duration-700 group-hover:scale-110 rounded-[1.2rem]"
                        />
                    ) : (
                        <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest italic opacity-50">Sin Imagen</span>
                    )}

                    {/* Out of Stock Overlay */}
                    {isOutOfStock && (
                        <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px] flex items-center justify-center z-10">
                            <span className="bg-slate-900 text-white text-xs md:text-sm font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-xl transform -rotate-12 border-2 border-white">
                                AGOTADO
                            </span>
                        </div>
                    )}

                    {/* Badges */}
                    <div className="absolute top-4 left-4 flex gap-2 z-20">
                        {product.stock <= 5 && product.stock > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg animate-pulse">ÚLTIMOS {product.stock}</span>
                        )}
                        {(product.discountPercentage || 0) > 0 && !isOutOfStock && (
                            <span className="bg-amber-400 text-amber-950 text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">-{product.discountPercentage}%</span>
                        )}
                    </div>

                    {/* Floating Actions */}
                    <div className={`absolute bottom-4 right-4 flex justify-end items-center transition-all duration-500 z-20 ${isHovered && !isOutOfStock ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                        <button
                            onClick={toggleWishlist}
                            className={`w-10 h-10 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-lg transition-all transform active:scale-90 ${isWishlisted ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
                        >
                            <Heart size={20} fill={isWishlisted ? "currentColor" : "none"} />
                        </button>
                    </div>

                    {product.videoUrl && !isHovered && !isOutOfStock && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsHovered(true);
                            }}
                            className="absolute top-4 right-4 bg-white/80 backdrop-blur-md text-foreground p-2 rounded-full shadow-lg z-30 transition-transform active:scale-90"
                        >
                            <Play size={12} fill="currentColor" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="px-1 md:px-3 flex-grow space-y-1 md:space-y-2">
                    <p className="text-[9px] md:text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{product.category?.name || 'General'}</p>
                    <h3 className={`font-outfit font-bold text-sm md:text-lg leading-tight text-foreground transition-colors group-hover:text-primary line-clamp-2 ${isOutOfStock ? 'text-slate-400' : ''}`}>{product.name}</h3>
                    <p className="hidden md:line-clamp-2 text-muted-foreground text-xs leading-relaxed">{product.description}</p>
                </div>

            </Link>

            {/* Footer */}
            <div className="px-1 md:px-3 mt-2 md:mt-4 pt-3 md:pt-4 border-t border-slate-50 dark:border-slate-700 flex items-center justify-between pb-1 md:pb-2">
                <div className="flex flex-col">
                    <span className={`text-base md:text-xl font-outfit font-black ${isOutOfStock ? 'text-slate-400 line-through decoration-2' : 'text-foreground'}`}>
                        ${product.price.toFixed(2)}
                    </span>
                    {(product.discountPercentage || 0) > 0 && !isOutOfStock && (
                        <span className="text-[10px] text-slate-400 line-through">${(product.price / (1 - (product.discountPercentage || 0) / 100)).toFixed(2)}</span>
                    )}
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering Link
                        if (!isOutOfStock) addToCart(product);
                    }}
                    disabled={isOutOfStock}
                    className={`p-3 md:p-4 rounded-xl md:rounded-2xl shadow-lg transition-all group relative overflow-hidden ${isOutOfStock ? 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500 cursor-not-allowed shadow-none' : 'premium-button shadow-primary/20'}`}
                >
                    <ShoppingCart size={16} className={`md:w-5 md:h-5 ${!isOutOfStock && 'group-active:scale-125 transition-transform'}`} />
                </button>
            </div>
        </div>
    );
}
