"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function SplashScreen() {
    const [visible, setVisible] = useState(true);
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        // Only show on first visit per session (not on every navigation)
        const shown = sessionStorage.getItem("splash_shown");
        if (shown) {
            setVisible(false);
            return;
        }

        // Start fade-out after 1.8s, remove after animation
        const fadeTimer = setTimeout(() => setFadeOut(true), 1800);
        const removeTimer = setTimeout(() => {
            setVisible(false);
            sessionStorage.setItem("splash_shown", "1");
        }, 2400);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(removeTimer);
        };
    }, []);

    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 z-[99999] flex flex-col items-center justify-center"
            style={{
                background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
                transition: "opacity 0.6s ease",
                opacity: fadeOut ? 0 : 1,
                pointerEvents: fadeOut ? "none" : "all",
            }}
        >
            {/* Ambient glow blobs */}
            <div
                className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-20"
                style={{
                    background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)",
                    filter: "blur(40px)",
                }}
            />
            <div
                className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full opacity-15"
                style={{
                    background: "radial-gradient(circle, #a855f7 0%, transparent 70%)",
                    filter: "blur(40px)",
                }}
            />

            {/* Logo container */}
            <div
                className="relative flex flex-col items-center gap-6"
                style={{
                    animation: "splashEntrance 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                }}
            >
                {/* Icon with glow ring */}
                <div className="relative">
                    {/* Outer glow ring */}
                    <div
                        className="absolute inset-0 rounded-full"
                        style={{
                            background: "radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)",
                            transform: "scale(1.8)",
                            animation: "pulseGlow 2s ease-in-out infinite",
                        }}
                    />
                    {/* Icon background */}
                    <div
                        className="relative w-28 h-28 rounded-[2rem] flex items-center justify-center overflow-hidden"
                        style={{
                            background: "linear-gradient(145deg, rgba(124,58,237,0.15) 0%, rgba(168,85,247,0.1) 100%)",
                            border: "1px solid rgba(124,58,237,0.3)",
                            backdropFilter: "blur(20px)",
                            boxShadow: "0 0 60px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
                        }}
                    >
                        <Image
                            src="/icon-192x192.png"
                            alt="Logo"
                            width={80}
                            height={80}
                            priority
                            className="object-contain"
                        />
                    </div>
                </div>

                {/* Store name */}
                <div className="text-center space-y-1">
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.4em]">
                        Bienvenido a
                    </p>
                    <div
                        className="text-3xl font-black tracking-tighter"
                        style={{
                            fontFamily: "'Outfit', sans-serif",
                            background: "linear-gradient(135deg, #ffffff 0%, #c4b5fd 60%, #a78bfa 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        JC<span style={{ WebkitTextFillColor: "#a78bfa" }}>TECH</span>
                    </div>
                </div>

                {/* Loader dots */}
                <div className="flex items-center gap-1.5 mt-2">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-violet-400"
                            style={{
                                animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                                opacity: 0.4,
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Keyframes injected inline */}
            <style>{`
                @keyframes splashEntrance {
                    from { opacity: 0; transform: scale(0.85) translateY(20px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes pulseGlow {
                    0%, 100% { opacity: 0.4; transform: scale(1.8); }
                    50%       { opacity: 0.7; transform: scale(2.1); }
                }
                @keyframes dotPulse {
                    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
                    40%           { opacity: 1;   transform: scale(1.3); }
                }
            `}</style>
        </div>
    );
}
