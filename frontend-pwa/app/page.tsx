"use client";

import { useEffect, useState } from "react";
import ProductCard from "@/components/ProductCard";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import { Product } from "@/types/product";
import { Star, Truck, ShieldCheck, Zap, ShoppingBag } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5140/api/v1";
        // Fetch only 6 products for homepage performance
        const prodRes = await fetch(`${API_URL}/products?pageSize=6`);
        if (!prodRes.ok) throw new Error("Failed to fetch products");
        const prodData = await prodRes.json();
        setProducts(prodData.items || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    const savedScrollPos = sessionStorage.getItem("home_scroll_pos");
    if (savedScrollPos) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScrollPos));
        sessionStorage.removeItem("home_scroll_pos");
      }, 100);
    }
  }, []);

  // Guardar posición antes de salir
  const handleProductClick = () => {
    sessionStorage.setItem("home_scroll_pos", window.scrollY.toString());
  };

  const featuredProducts = products.slice(0, 6);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-grow">
        <Hero />

        {/* Categories / Filter Section Quick Access (Optional) */}

        {/* Why Choose Us */}
        <section className="py-12 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
              {[
                { icon: Truck, title: "Envío Veloz", desc: "Entrega garantizada en menos de 24 horas." },
                { icon: ShieldCheck, title: "Pago Seguro", desc: "Tus transacciones están 100% protegidas." },
                { icon: Star, title: "Variedad para Todos", desc: "Productos de todo tipo y calidad que se ajustan a ti y a tu presupuesto." },
                { icon: Zap, title: "Soporte 24/7", desc: "Estamos aquí para ayudarte en cualquier momento." },
              ].map((feature, i) => (
                <div key={i} className="space-y-3 md:space-y-4 group">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm">
                    <feature.icon size={24} className="md:w-7 md:h-7" />
                  </div>
                  <h3 className="font-outfit font-bold text-base md:text-lg">{feature.title}</h3>
                  <p className="text-muted-foreground text-[11px] md:text-sm leading-relaxed line-clamp-2 md:line-clamp-none">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Product Grid Section */}
        <section id="products" className="py-6 md:py-12 bg-slate-50/50">
          <div className="max-w-7xl mx-auto px-2 md:px-6">
            <div className="flex flex-col gap-6 mb-16">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full">
                  <Star size={12} fill="currentColor" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Favoritos</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-outfit font-black tracking-tighter">
                  PRODUCTOS <span className="gradient-text">DESTACADOS.</span>
                </h2>
                <p className="text-muted-foreground max-w-lg">
                  Nuestra selección de los artículos más buscados y mejor valorados por nuestra comunidad.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 md:gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="glass-card rounded-[2rem] p-3 h-[300px] md:h-[450px] animate-pulse">
                    <div className="aspect-[4/5] bg-slate-200 rounded-[1.8rem] mb-4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
                    <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                  </div>
                ))}
              </div>
            ) : (
              featuredProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 md:gap-3">
                  {featuredProducts.map((product: Product) => (
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
                  <h3 className="text-2xl font-outfit font-bold mb-2">No hay productos aún</h3>
                  <p className="text-muted-foreground mb-8 text-sm">Estamos preparando nuestra nueva colección. Vuelve pronto para descubrir sorpresas.</p>
                  <button className="premium-button px-8 py-4 rounded-2xl">Notificarme</button>
                </div>
              )
            )}

            {/* View More Button */}
            <div className="mt-20 text-center">
              <Link
                href="/catalog"
                className="inline-block bg-white hover:bg-slate-50 text-foreground px-12 py-5 rounded-2xl font-bold shadow-xl shadow-black/5 transition-all active:scale-95 border border-slate-100"
              >
                Ver Todo el Catálogo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
