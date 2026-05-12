"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Product } from "@/types/product";

interface CartItem extends Product {
    quantity: number;
}

// Fly-to-cart animation source rect
export interface FlyOrigin {
    x: number;
    y: number;
    width: number;
    height: number;
    imageUrl?: string;
    id: number; // unique per trigger
}

interface CartContextType {
    cart: CartItem[];
    addToCart: (product: Product, origin?: DOMRect) => void;
    removeFromCart: (productId: number) => void;
    updateQuantity: (productId: number, quantity: number) => void;
    clearCart: () => void;
    totalItems: number;
    totalPrice: number;
    isCartOpen: boolean;
    setIsCartOpen: (isOpen: boolean) => void;
    flyOrigin: FlyOrigin | null;
    clearFlyOrigin: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [flyOrigin, setFlyOrigin] = useState<FlyOrigin | null>(null);
    const flyIdRef = useRef(0);

    // Load cart from local storage on mount
    useEffect(() => {
        const savedCart = localStorage.getItem("faststore_cart");
        if (savedCart) {
            try {
                setCart(JSON.parse(savedCart));
            } catch (e) {
                console.error("Failed to parse cart", e);
            }
        }
    }, []);

    // Save cart to local storage on change
    useEffect(() => {
        localStorage.setItem("faststore_cart", JSON.stringify(cart));
    }, [cart]);

    const addToCart = useCallback((product: Product, origin?: DOMRect) => {
        setCart((prev) => {
            const existing = prev.find((item) => item.id === product.id);
            if (existing) {
                return prev.map((item) =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });

        // Trigger fly animation if origin provided — do NOT open the cart drawer
        if (origin) {
            flyIdRef.current += 1;
            setFlyOrigin({
                x: origin.x,
                y: origin.y,
                width: origin.width,
                height: origin.height,
                imageUrl: product.images?.[0]?.url,
                id: flyIdRef.current,
            });
        }
        // Note: we intentionally do NOT call setIsCartOpen(true) here anymore
    }, []);

    const removeFromCart = (productId: number) => {
        setCart((prev) => prev.filter((item) => item.id !== productId));
    };

    const updateQuantity = (productId: number, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(productId);
            return;
        }
        setCart((prev) =>
            prev.map((item) =>
                item.id === productId ? { ...item, quantity } : item
            )
        );
    };

    const clearCart = () => setCart([]);
    const clearFlyOrigin = useCallback(() => setFlyOrigin(null), []);

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <CartContext.Provider
            value={{
                cart,
                addToCart,
                removeFromCart,
                updateQuantity,
                clearCart,
                totalItems,
                totalPrice,
                isCartOpen,
                setIsCartOpen,
                flyOrigin,
                clearFlyOrigin,
            }}
        >
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error("useCart must be used within a CartProvider");
    }
    return context;
}
