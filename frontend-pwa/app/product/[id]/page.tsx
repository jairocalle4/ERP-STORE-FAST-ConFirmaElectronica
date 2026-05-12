import { Metadata } from 'next';
import ProductDetailsClient from '@/components/ProductDetailsClient';

type Props = {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata(
    { params }: Props
): Promise<Metadata> {
    const { id } = await params;

    try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5140/api/v1";
        const res = await fetch(`${API_URL}/products/${id}`, { next: { revalidate: 3600 } });
        if (!res.ok) return { title: "Producto | JCTech Store" };

        const product = await res.json();
        const coverImage = product.images?.find((img: any) => img.isCover)?.url || product.images?.[0]?.url;
        const category = product.category?.name || "Producto";
        const price = product.price ? `$${Number(product.price).toFixed(2)}` : "";

        // Minimal, elegant tagline — no long description
        const tagline = price
            ? `${category} • ${price} — JCTech Store`
            : `${category} — JCTech Store`;

        const productUrl = `https://tienda-pwa.vercel.app/product/${id}`;

        return {
            title: `${product.name} | JCTech Store`,
            description: tagline,
            openGraph: {
                title: product.name,
                description: tagline,
                images: coverImage
                    ? [{ url: coverImage, width: 800, height: 800, alt: product.name }]
                    : [],
                url: productUrl,
                type: 'website',
                siteName: 'JCTech Store',
                locale: 'es_EC',
            },
            twitter: {
                card: "summary_large_image",
                title: product.name,
                description: tagline,
                images: coverImage ? [coverImage] : [],
            },
        };
    } catch (error) {
        return {
            title: "Producto | JCTech Store",
            description: "Descubre nuestros productos en JCTech Store.",
        };
    }
}

export default async function Page({ params }: Props) {
    const { id } = await params;
    return <ProductDetailsClient id={id} />;
}
