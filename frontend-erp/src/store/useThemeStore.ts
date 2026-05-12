import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    setTheme: (theme: Theme) => void;
    cycleTheme: () => void;
    applyTheme: () => void;
}

const CYCLE_ORDER: Theme[] = ['light', 'dark', 'system'];

const getSystemPreference = (): 'light' | 'dark' =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

const applyToDOM = (theme: Theme): 'light' | 'dark' => {
    const resolved = theme === 'system' ? getSystemPreference() : theme;
    if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', resolved === 'dark');
    }
    return resolved;
};

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: 'system',
            resolvedTheme: 'light',

            applyTheme: () => {
                const resolved = applyToDOM(get().theme);
                set({ resolvedTheme: resolved });
            },

            setTheme: (theme) => {
                const resolved = applyToDOM(theme);
                set({ theme, resolvedTheme: resolved });
            },

            cycleTheme: () => {
                const current = get().theme;
                const next = CYCLE_ORDER[(CYCLE_ORDER.indexOf(current) + 1) % CYCLE_ORDER.length];
                get().setTheme(next);
            },
        }),
        {
            name: 'erp-theme',
            partialize: (state) => ({ theme: state.theme }),
        }
    )
);
