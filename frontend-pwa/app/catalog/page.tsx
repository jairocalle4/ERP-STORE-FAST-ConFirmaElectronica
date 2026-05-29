"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import ProductCard from "@/components/ProductCard";
import Navbar from "@/components/Navbar";
import InstallPwaPrompt from "@/components/InstallPwaPrompt";
import Footer from "@/components/Footer";
import { Product } from "@/types/product";
import { Search, SlidersHorizontal, ShoppingBag, Star } from "lucide-react";
import { useSearchParams } from "next/navigation";

function CatalogContent() {
    const searchParams = useSearchParams();
    const initialFilter = searchParams.get("filter");
    const initialSearch = searchParams.get("search");

    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<{ id: number, name: string }[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [isOffersOnly, setIsOffersOnly] = useState(initialFilter === "offers");
    const [searchQuery, setSearchQuery] = useState(initialSearch || "");
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [scrolledPastSearch, setScrolledPastSearch] = useState(false);
    const [isRestored, setIsRestored] = useState(false);
    const justRestored = useRef(false);
    const PAGE_SIZE = 8;

    // Categorías se cargan una sola vez: solo las que tienen productos activos
    useEffect(() => {
        async function fetchCategories() {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5140/api/v1";
                const res = await fetch(`${API_URL}/categories?onlyWithProducts=true`);
                if (res.ok) {
                    const data = await res.json();
                    setCategories(data.items || []);
                }
            } catch (e) { console.error(e); }
        }
        fetchCategories();
    }, []);

    // Carga de productos (inicial y paginada)
    const fetchProducts = async (pageNum: number, isInitial = false, catId: number | null = null, search: string = searchQuery, offersOnly: boolean = isOffersOnly) => {
        if (pageNum > 1) setLoadingMore(true);
        else if (isInitial) setLoading(true);

        try {
            const categoryParam = catId ? `&categoryId=${catId}` : "";
            const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
            const offersParam = offersOnly ? `&onlyOffers=true` : "";

            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5140/api/v1";
            const res = await fetch(`${API_URL}/products?page=${pageNum}&pageSize=${PAGE_SIZE}${categoryParam}${searchParam}${offersParam}`);
            if (!res.ok) throw new Error("Failed");
            const newProducts = await res.json();

            setHasMore((newProducts.items || []).length === PAGE_SIZE);

            if (isInitial) {
                setProducts(newProducts.items || []);
            } else {
                setProducts(prev => [...prev, ...(newProducts.items || [])]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Al cambiar la categoría, reseteamos todo
    const handleCategoryChange = (id: number | null) => {
        setSelectedCategoryId(id);
        setIsOffersOnly(false); // Clear offers when switching to a category
        setPage(1);
        setHasMore(true);
        setProducts([]);
        fetchProducts(1, true, id, "", false); // Also clear search query locally for cleaner switching? 
        // User might want to keep search, but let's clear it if they click a specific category for better UX
        setSearchQuery("");
    };

    // Al cambiar a ofertas
    const handleOffersChange = () => {
        setIsOffersOnly(true);
        setSelectedCategoryId(null);
        setPage(1);
        setHasMore(true);
        setProducts([]);
        setSearchQuery("");
        fetchProducts(1, true, null, "", true);
    };

    // React to URL parameter changes (Search from Navbar or Filters)
    useEffect(() => {
        if (!isRestored || justRestored.current) return;

        const filterParam = searchParams.get("filter");
        const srchParam = searchParams.get("search");

        if (filterParam === "offers") {
            if (!isOffersOnly) {
                setIsOffersOnly(true);
                setSelectedCategoryId(null);
                setProducts([]);
                setPage(1);
                fetchProducts(1, true, null, "", true);
            }
        } else if (srchParam !== null) {
            if (srchParam !== searchQuery) {
                setSearchQuery(srchParam);
                setIsOffersOnly(false);
                setSelectedCategoryId(null);
                setProducts([]);
                setPage(1);
                fetchProducts(1, true, null, srchParam, false);
            }
        } else if (!filterParam && srchParam === null && products.length === 0 && loading) {
            // Initial load without params
            fetchProducts(1, true, null, "", false);
        }
    }, [searchParams, isRestored]);

    // Local Search Effect (Debounced)
    useEffect(() => {
        if (!isRestored || justRestored.current) return;

        const timer = setTimeout(() => {
            const urlSearch = searchParams.get("search") || "";
            if (searchQuery !== urlSearch && searchQuery !== "") {
                setPage(1);
                setHasMore(true);
                setProducts([]);
                fetchProducts(1, true, selectedCategoryId, searchQuery, isOffersOnly);
            } else if (searchQuery === "" && urlSearch !== "") {
                // User cleared search locally
                setPage(1);
                setHasMore(true);
                setProducts([]);
                fetchProducts(1, true, selectedCategoryId, "", isOffersOnly);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery, isRestored]);


    // Infinite Scroll Observer
    useEffect(() => {
        if (!isRestored || justRestored.current || !hasMore || loadingMore || loading) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                const nextPage = page + 1;
                setPage(nextPage);
                fetchProducts(nextPage, false, selectedCategoryId, searchQuery, isOffersOnly);
            }
        }, { threshold: 0.1 });

        const loader = document.getElementById("scroll-loader");
        if (loader) observer.observe(loader);

        return () => observer.disconnect();
    }, [page, hasMore, loadingMore, loading, selectedCategoryId, searchQuery, isOffersOnly, isRestored]);

    // Restore logic on mount
    useEffect(() => {
        const shouldRestore = sessionStorage.getItem("catalog_should_restore") === "true";
        if (shouldRestore) {
            const savedSearch = sessionStorage.getItem("catalog_search_query") || "";
            const savedCategory = sessionStorage.getItem("catalog_selected_category_id");
            const savedOffers = sessionStorage.getItem("catalog_is_offers_only");
            const savedPage = sessionStorage.getItem("catalog_page");
            const savedProducts = sessionStorage.getItem("catalog_products");
            const savedHasMore = sessionStorage.getItem("catalog_has_more");

            setSearchQuery(savedSearch);
            setSelectedCategoryId(savedCategory === "null" || !savedCategory ? null : Number(savedCategory));
            setIsOffersOnly(savedOffers === "true");
            setPage(savedPage ? Number(savedPage) : 1);
            setProducts(savedProducts ? JSON.parse(savedProducts) : []);
            setHasMore(savedHasMore === "true");
            setLoading(false);

            justRestored.current = true;

            const savedScrollPos = sessionStorage.getItem("catalog_scroll_pos");
            if (savedScrollPos) {
                setTimeout(() => {
                    window.scrollTo(0, parseInt(savedScrollPos));
                }, 100);
            }

            // Clean up
            sessionStorage.removeItem("catalog_should_restore");
            sessionStorage.removeItem("catalog_scroll_pos");
            sessionStorage.removeItem("catalog_search_query");
            sessionStorage.removeItem("catalog_selected_category_id");
            sessionStorage.removeItem("catalog_is_offers_only");
            sessionStorage.removeItem("catalog_page");
            sessionStorage.removeItem("catalog_products");
            sessionStorage.removeItem("catalog_has_more");
        }
        setIsRestored(true);
    }, []);

    // Reset justRestored ref after initial render effects run
    useEffect(() => {
        if (isRestored && justRestored.current) {
            const timer = setTimeout(() => {
                justRestored.current = false;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isRestored]);

    // Guardar posición y estado antes de salir
    const handleProductClick = () => {
        sessionStorage.setItem("catalog_scroll_pos", window.scrollY.toString());
        sessionStorage.setItem("catalog_search_query", searchQuery);
        sessionStorage.setItem("catalog_selected_category_id", selectedCategoryId !== null ? selectedCategoryId.toString() : "null");
        sessionStorage.setItem("catalog_is_offers_only", isOffersOnly ? "true" : "false");
        sessionStorage.setItem("catalog_page", page.toString());
        sessionStorage.setItem("catalog_products", JSON.stringify(products));
        sessionStorage.setItem("catalog_has_more", hasMore ? "true" : "false");
        sessionStorage.setItem("catalog_should_restore", "true");
    };

    // const normalizeString = (str: string) => {
    //     return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    // };

    // const filteredProducts = products.filter(p => {
    //     const normalizedName = normalizeString(p.name);
    //     const normalizedDesc = normalizeString(p.description || "");
    //     const normalizedQuery = normalizeString(searchQuery);

    //     return normalizedName.includes(normalizedQuery) || normalizedDesc.includes(normalizedQuery);
    // });
    const filteredProducts = products; // Use backend results directly

    // Scroll detection for Navbar Dynamic Search
    useEffect(() => {
        const handleScroll = () => {
            // About 180px is where the search bar usually scrolls out of view on mobile
            setScrolledPastSearch(window.scrollY > 180);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
            <Navbar
                showSearch={scrolledPastSearch}
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
            />
            <InstallPwaPrompt />

            <main className="flex-grow pt-20 md:pt-28 pb-24">
                <div className="max-w-7xl mx-auto px-2 sm:px-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8 px-2">
                        <div className="space-y-3">
                            <h1 className="text-4xl sm:text-5xl md:text-6xl font-outfit font-black tracking-tighter uppercase leading-none">
                                CATÁLOGO <span className="gradient-text">COMPLETO.</span>
                            </h1>
                            <p className="text-sm sm:text-base text-muted-foreground max-w-lg">
                                Explora nuestra colección completa de productos de alta calidad, seleccionados especialmente para ti.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100 w-full sm:w-96 shadow-sm focus-within:ring-2 ring-primary/20 transition-all">
                            <Search size={18} className="ml-3 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar productos..."
                                className="bg-transparent border-none outline-none w-full py-2 text-sm font-medium"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* ── Sticky Filters Bar ── */}
                    <div className="sticky top-[64px] md:top-[80px] z-40 -mx-2 sm:-mx-6 px-2 sm:px-6 py-3 bg-white/90 dark:bg-slate-950/90 backdrop-blur-lg border-b border-slate-100 dark:border-slate-800 shadow-sm mb-6">
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar max-w-7xl mx-auto">
                            <button
                                onClick={() => handleCategoryChange(null)}
                                className={`px-4 py-2 rounded-xl border text-xs font-black transition-all shadow-sm flex-shrink-0 uppercase tracking-wide ${selectedCategoryId === null && !isOffersOnly ? 'bg-primary text-white border-primary shadow-primary/20 shadow-md' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-primary hover:text-primary text-foreground'}`}
                            >
                                Todos
                            </button>

                            <button
                                onClick={handleOffersChange}
                                className={`px-4 py-2 rounded-xl border text-xs font-black transition-all shadow-sm flex-shrink-0 uppercase tracking-wide flex items-center gap-1.5 ${isOffersOnly ? 'bg-amber-400 text-amber-950 border-amber-400 shadow-amber-300/30 shadow-md' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-amber-400 hover:text-amber-600 text-foreground'}`}
                            >
                                <Star size={12} className={isOffersOnly ? "fill-amber-950" : "text-amber-500"} />
                                Ofertas
                            </button>

                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => handleCategoryChange(cat.id)}
                                    className={`px-4 py-2 rounded-xl border text-xs font-black transition-all shadow-sm flex-shrink-0 uppercase tracking-wide ${selectedCategoryId === cat.id ? 'bg-primary text-white border-primary shadow-primary/20 shadow-md' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-primary hover:text-primary text-foreground'}`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Results Info */}
                    <div className="flex justify-between items-center mb-6 px-2">
                        <p className="text-xs font-black text-muted-foreground">
                            <span className="text-foreground">{filteredProducts.length}</span> producto{filteredProducts.length !== 1 ? 's' : ''}
                            {isOffersOnly ? ' en ofertas' : selectedCategoryId ? ` en ${categories.find(c => c.id === selectedCategoryId)?.name || ''}` : ' en total'}
                            {searchQuery && <span className="text-primary"> para &ldquo;{searchQuery}&rdquo;</span>}
                        </p>
                    </div>

                    {/* Grid */}
                    {loading && products.length === 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-8">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="glass-card rounded-2xl md:rounded-[2rem] p-2 md:p-3 h-[300px] md:h-[450px] animate-pulse">
                                    <div className="aspect-[4/5] bg-slate-200 rounded-xl md:rounded-[1.8rem] mb-4"></div>
                                    <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
                                    <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            {filteredProducts.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-8 transition-all">
                                    {filteredProducts.map((product) => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            onClick={handleProductClick}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="glass-card rounded-[3rem] p-20 text-center max-w-2xl mx-auto border-dashed">
                                    <ShoppingBag className="mx-auto text-muted-foreground mb-6 opacity-20" size={80} />
                                    <h3 className="text-2xl font-outfit font-bold mb-2">No se encontraron productos</h3>
                                    <p className="text-muted-foreground mb-8 text-sm">Intenta ajustar tus filtros o búsqueda para encontrar lo que necesitas.</p>
                                    <button
                                        onClick={() => { handleCategoryChange(null); setSearchQuery(""); }}
                                        className="premium-button px-8 py-4 rounded-2xl"
                                    >
                                        Limpiar Filtros
                                    </button>
                                </div>
                            )}

                            {/* Loader for Infinite Scroll */}
                            <div id="scroll-loader" className="py-20 flex flex-col items-center justify-center gap-4">
                                {loadingMore ? (
                                    <>
                                        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Cargando más tesoros...</p>
                                    </>
                                ) : hasMore && filteredProducts.length > 0 && searchQuery === "" ? (
                                    <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                                ) : null}
                            </div>
                        </>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}

export default function CatalogPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        }>
            <CatalogContent />
        </Suspense>
    );
}
