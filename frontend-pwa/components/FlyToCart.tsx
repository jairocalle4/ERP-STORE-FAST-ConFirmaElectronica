"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/context/CartContext";
import { ShoppingCart } from "lucide-react";

// ID del icono del carrito en el Navbar (lo usamos para calcular posición destino)
export const CART_ICON_ID = "navbar-cart-icon";

export default function FlyToCart() {
    const { flyOrigin, clearFlyOrigin } = useCart();
    const [isAnimating, setIsAnimating] = useState(false);
    const animRef = useRef<HTMLDivElement>(null);
    const prevIdRef = useRef<number>(0);

    useEffect(() => {
        if (!flyOrigin || flyOrigin.id === prevIdRef.current) return;
        prevIdRef.current = flyOrigin.id;

        const cartIcon = document.getElementById(CART_ICON_ID);
        if (!cartIcon || !animRef.current) return;

        const cartRect = cartIcon.getBoundingClientRect();

        // Size of the flying dot
        const SIZE = 48;

        // Start position: center of the add button
        const startX = flyOrigin.x + flyOrigin.width / 2 - SIZE / 2;
        const startY = flyOrigin.y + flyOrigin.height / 2 - SIZE / 2;

        // End position: center of the cart icon
        const endX = cartRect.x + cartRect.width / 2 - SIZE / 2;
        const endY = cartRect.y + cartRect.height / 2 - SIZE / 2;

        const el = animRef.current;

        // Reset to start
        el.style.transform = `translate(${startX}px, ${startY}px) scale(1)`;
        el.style.opacity = "1";
        el.style.display = "flex";

        setIsAnimating(true);

        // Slight delay to allow repaint
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.style.transition = "transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.55s ease";
                el.style.transform = `translate(${endX}px, ${endY}px) scale(0.2)`;
                el.style.opacity = "0";
            });
        });

        const timeout = setTimeout(() => {
            el.style.transition = "none";
            el.style.display = "none";
            setIsAnimating(false);
            clearFlyOrigin();
        }, 600);

        return () => clearTimeout(timeout);
    }, [flyOrigin, clearFlyOrigin]);

    return (
        <div
            ref={animRef}
            className="fixed top-0 left-0 z-[9999] pointer-events-none"
            style={{
                display: "none",
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 20px rgba(124,58,237,0.5)",
                willChange: "transform, opacity",
            }}
            aria-hidden="true"
        >
            <ShoppingCart size={20} color="white" />
        </div>
    );
}
