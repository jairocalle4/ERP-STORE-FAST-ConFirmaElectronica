"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
    theme: Theme;
    resolvedTheme: "light" | "dark";
    setTheme: (theme: Theme) => void;
    cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: "system",
    resolvedTheme: "light",
    setTheme: () => {},
    cycleTheme: () => {},
});

const STORAGE_KEY = "pwa-theme";
const CYCLE_ORDER: Theme[] = ["light", "dark", "system"];

function getSystemPreference(): "light" | "dark" {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyToDOM(theme: Theme): "light" | "dark" {
    if (typeof document === "undefined") return "light";
    const resolved = theme === "system" ? getSystemPreference() : theme;
    document.documentElement.classList.toggle("dark", resolved === "dark");
    return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("system");
    const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

    const applyTheme = useCallback((t: Theme) => {
        const resolved = applyToDOM(t);
        setResolvedTheme(resolved);
    }, []);

    // Leer preferencia guardada al montar
    useEffect(() => {
        const saved = (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
        setThemeState(saved);
        applyTheme(saved);

        // Escuchar cambios de preferencia del sistema
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = () => {
            // Solo reaccionar si el tema actual es "system"
            setThemeState((current) => {
                if (current === "system") applyTheme("system");
                return current;
            });
        };
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }, [applyTheme]);

    const setTheme = useCallback((t: Theme) => {
        localStorage.setItem(STORAGE_KEY, t);
        setThemeState(t);
        applyTheme(t);
    }, [applyTheme]);

    const cycleTheme = useCallback(() => {
        setThemeState((current) => {
            const next = CYCLE_ORDER[(CYCLE_ORDER.indexOf(current) + 1) % CYCLE_ORDER.length];
            localStorage.setItem(STORAGE_KEY, next);
            applyTheme(next);
            return next;
        });
    }, [applyTheme]);

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, cycleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
