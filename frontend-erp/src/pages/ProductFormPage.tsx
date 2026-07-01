import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, Save, Loader2, Plus, Trash2, PlayCircle, Image as ImageIcon, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../components/common/GlassCard';
import { useNotificationStore } from '../store/useNotificationStore';
import CategoryFormModal from '../components/CategoryFormModal';
import SubcategoryFormModal from '../components/SubcategoryFormModal';


interface Category {
    id: number;
    name: string;
}

interface Subcategory {
    id: number;
    name: string;
    categoryId: number;
}

interface ProductImage {
    id?: number;
    url: string;
    isCover: boolean;
    order: number;
}

export default function ProductFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const addNotification = useNotificationStore(s => s.addNotification);
    const isEdit = Boolean(id);

    const [categories, setCategories] = useState<Category[]>([]);
    const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);

    const [formData, setFormData] = useState({
        id: 0,
        name: '',
        description: '',
        price: 0,
        cost: 0,
        stock: 0,
        sku: '',
        barcode: '',
        categoryId: 0,
        subcategoryId: 0,
        isActive: true,
        isService: false,
        videoUrl: '',
        minStock: 3,
        discountPercentage: 0
    });

    const [images, setImages] = useState<ProductImage[]>([]);
    const [newImageUrl, setNewImageUrl] = useState('');
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [uploading, setUploading] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [showVideoUrlInput, setShowVideoUrlInput] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        if (images.length >= 6) {
            addNotification('Máximo 6 imágenes permitidas', 'error');
            return;
        }

        const file = files[0];
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            addNotification('Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WEBP)', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            addNotification('La imagen es demasiado grande. Máximo 5MB', 'error');
            return;
        }

        setUploading(true);
        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);

            const res = await api.post('/media/upload-image', formDataUpload, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            const uploadedUrl = res.data?.url;
            if (uploadedUrl) {
                const isFirst = images.length === 0;
                setImages([...images, { url: uploadedUrl, isCover: isFirst, order: images.length }]);
                addNotification('Imagen subida correctamente');
            } else {
                addNotification('No se recibió la URL de la imagen subida', 'error');
            }
        } catch (err: any) {
            console.error('Error uploading image to Cloudinary', err);
            const errMsg = err.response?.data?.message || err.message || 'Error al conectar con el servidor de medios';
            addNotification(`No se pudo subir la imagen: ${errMsg}`, 'error');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
        if (!validTypes.includes(file.type)) {
            addNotification('Tipo de archivo no permitido. Solo se aceptan videos (MP4, WEBM, MOV)', 'error');
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            addNotification('El video es demasiado grande. Máximo 20MB', 'error');
            return;
        }

        setUploadingVideo(true);
        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);

            const res = await api.post('/media/upload-video', formDataUpload, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            const uploadedUrl = res.data?.url;
            if (uploadedUrl) {
                setFormData(prev => ({ ...prev, videoUrl: uploadedUrl }));
                addNotification('Video subido correctamente');
            } else {
                addNotification('No se recibió la URL del video subido', 'error');
            }
        } catch (err: any) {
            console.error('Error uploading video to Cloudinary', err);
            const errMsg = err.response?.data?.message || err.message || 'Error al conectar con el servidor de medios';
            addNotification(`No se pudo subir el video: ${errMsg}`, 'error');
        } finally {
            setUploadingVideo(false);
            e.target.value = '';
        }
    };

    // Modals for quick creation
    const [catModalOpen, setCatModalOpen] = useState(false);
    const [subModalOpen, setSubModalOpen] = useState(false);

    useEffect(() => {
        fetchCategories();
        if (isEdit) {
            fetchProduct();
        } else {
            // Auto-generate SKU for new products
            api.get('/products/next-sku').then(res => {
                setFormData(prev => ({ ...prev, sku: res.data?.nextSku ?? '' }));
            }).catch(() => {});
        }
    }, [id]);

    const fetchCategories = async () => {
        try {
            const res = await api.get('/categories', { params: { pageSize: 1000 } });
            setCategories(res.data.items);
        } catch (err) {
            console.error('Error categories', err);
        }
    };

    const fetchSubcategories = async (catId: number) => {
        try {
            const res = await api.get(`/subcategories?categoryId=${catId}`);
            setSubcategories(res.data);
        } catch (err) {
            console.error('Error subcategories', err);
        }
    };

    const handleCategoryChange = (catId: number) => {
        setFormData({ ...formData, categoryId: catId, subcategoryId: 0 });
        if (catId > 0) fetchSubcategories(catId);
        else setSubcategories([]);
        if (errors.categoryId) setErrors({ ...errors, categoryId: '' });
    };

    const fetchProduct = async () => {
        try {
            const res = await api.get(`/products/${id}`);
            const data = res.data;
            setFormData({
                id: data.id,
                name: data.name,
                description: data.description || '',
                price: data.price,
                cost: data.cost,
                stock: data.stock,
                sku: data.sku || '',
                barcode: data.barcode || '',
                categoryId: data.categoryId,
                subcategoryId: data.subcategoryId || 0,
                isActive: data.isActive,
                isService: data.isService || false,
                videoUrl: data.videoUrl || '',
                minStock: data.minStock || 3,
                discountPercentage: data.discountPercentage || 0
            });

            if (data.categoryId) fetchSubcategories(data.categoryId);

            if (data.images && data.images.length > 0) {
                setImages(data.images.map((img: any) => ({
                    id: img.id,
                    url: img.url,
                    isCover: img.isCover,
                    order: img.order || 0
                })));
            }
        } catch (err) {
            console.error('Error product', err);
            navigate('/products');
        } finally {
            setFetching(false);
        }
    };

    const addImage = () => {
        if (!newImageUrl.trim()) return;
        // Basic URL validation
        try {
            new URL(newImageUrl);
        } catch (_) {
            alert('Por favor, ingresa una URL válida');
            return;
        }

        if (images.length >= 6) {
            alert('Máximo 6 imágenes permitidas');
            return;
        }

        const isFirst = images.length === 0;
        setImages([...images, { url: newImageUrl, isCover: isFirst, order: images.length }]);
        setNewImageUrl('');
    };

    const removeImage = (index: number) => {
        const newImages = images.filter((_, i) => i !== index);
        if (newImages.length > 0 && !newImages.some(img => img.isCover)) {
            newImages[0].isCover = true;
        }
        setImages(newImages);
    };

    const setCover = (index: number) => {
        const newImages = images.map((img, i) => ({
            ...img,
            isCover: i === index
        }));
        setImages(newImages);
    };

    const validate = () => {
        const newErrors: { [key: string]: string } = {};

        if (!formData.name.trim()) newErrors.name = 'El nombre es obligatorio';
        if (formData.name.trim().length < 3) newErrors.name = 'El nombre debe tener al menos 3 caracteres';

        if (!formData.categoryId) newErrors.categoryId = 'Debes seleccionar una categoría';

        if (formData.price <= 0) newErrors.price = 'El precio debe ser mayor a 0';
        if (formData.cost < 0) newErrors.cost = 'El costo no puede ser negativo';
        if (formData.stock < 0) newErrors.stock = 'El stock no puede ser negativo';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            // Scroll to top or show toast
            alert('Por favor corrige los errores antes de guardar.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                ...formData,
                price: Number(formData.price),
                cost: Number(formData.cost),
                stock: formData.isService ? 0 : Number(formData.stock),
                categoryId: Number(formData.categoryId),
                subcategoryId: formData.subcategoryId ? Number(formData.subcategoryId) : null,
                minStock: formData.isService ? 0 : Number(formData.minStock),
                discountPercentage: Number(formData.discountPercentage),
                images: images
            };

            if (isEdit) {
                await api.put(`/products/${id}`, payload);
                addNotification('Producto actualizado correctamente');
            } else {
                await api.post('/products', payload);
                addNotification('Producto creado con éxito');
            }
            navigate('/products');
        } catch (err: any) {
            console.error(err);
            let errorMessage = 'Ocurrió un error al guardar el producto.';
            if (err.response && err.response.data) {
                if (typeof err.response.data === 'string') {
                    errorMessage = err.response.data;
                } else if (err.response.data.title) {
                    errorMessage = err.response.data.title;
                }
            } else {
                errorMessage = 'Error de conexión con el servidor.';
            }
            addNotification(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) return <div className="p-8 text-center text-indigo-600 font-medium">Cargando datos...</div>;

    return (
        <>
            <div className="space-y-6 animate-fade-in pb-10 relative z-0">
                <div className="flex items-center gap-4">
                    <Link to="/products" className="p-2 bg-white/50 rounded-xl shadow-sm text-indigo-600 hover:bg-indigo-50 transition-colors">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-3xl font-bold text-indigo-950">{isEdit ? 'Editar Producto' : 'Nuevo Producto'}</h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Información Básica */}
                            <GlassCard>
                                <h2 className="text-xl font-bold mb-6 text-indigo-900 border-b border-indigo-100 pb-2">Información Básica</h2>
                                <div className="grid grid-cols-1 gap-6">
                                    {/* Is Service Toggle */}
                                    <div className="flex items-center justify-between bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                                        <div>
                                            <h3 className="font-bold text-indigo-900">Es un Servicio</h3>
                                            <p className="text-xs text-indigo-700/70 mt-0.5">No maneja stock (infinito) y no se muestra en la tienda online.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={formData.isService}
                                                onChange={(e) => {
                                                    const isService = e.target.checked;
                                                    setFormData({
                                                        ...formData,
                                                        isService,
                                                        cost: isService ? 0 : formData.cost,
                                                        discountPercentage: isService ? 0 : formData.discountPercentage,
                                                        stock: isService ? 0 : formData.stock,
                                                        minStock: isService ? 0 : formData.minStock
                                                    });
                                                }}
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>

                                    <div>
                                        <label className="label-premium">
                                            Nombre del Producto <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => {
                                                setFormData({ ...formData, name: e.target.value });
                                                if (errors.name) setErrors({ ...errors, name: '' });
                                            }}
                                            className={`input-premium ${errors.name ? 'border-rose-400 focus:ring-rose-200' : ''}`}
                                            placeholder="Ej: Camiseta Polo Premium"
                                        />
                                        {errors.name && <p className="text-xs text-rose-500 font-bold mt-2 ml-1">{errors.name}</p>}
                                    </div>
                                    <div>
                                        <label className="label-premium">Descripción</label>
                                        <textarea
                                            rows={3}
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="input-premium"
                                            placeholder="Detalles del producto..."
                                        />
                                    </div>
                                    <div>
                                        <label className="label-premium">
                                            Categoría <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="flex gap-2">
                                            <select
                                                value={formData.categoryId || ''}
                                                onChange={e => handleCategoryChange(parseInt(e.target.value))}
                                                className={`select-premium flex-1 ${errors.categoryId ? 'border-rose-400 ring-rose-200' : ''}`}
                                            >
                                                <option value="">Seleccionar categoría</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setCatModalOpen(true)}
                                                className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100 flex items-center justify-center shrink-0"
                                                title="Nueva Categoría"
                                            >
                                                <Plus size={20} />
                                            </button>
                                        </div>
                                        {errors.categoryId && <p className="text-xs text-rose-500 font-bold mt-2 ml-1">{errors.categoryId}</p>}
                                    </div>

                                    <div>
                                        <label className="label-premium">Subcategoría</label>
                                        <div className="flex gap-2">
                                            <select
                                                value={formData.subcategoryId || 0}
                                                onChange={e => setFormData({ ...formData, subcategoryId: parseInt(e.target.value) })}
                                                className="select-premium flex-1 disabled:opacity-50"
                                                disabled={!formData.categoryId}
                                            >
                                                <option value="0">Ninguna / Seleccionar</option>
                                                {subcategories.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                disabled={!formData.categoryId}
                                                onClick={() => setSubModalOpen(true)}
                                                className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100 flex items-center justify-center shrink-0 disabled:opacity-50 disabled:grayscale"
                                                title="Nueva Subcategoría"
                                            >
                                                <Plus size={20} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </GlassCard>

                            {/* Precios e Inventario */}
                            <GlassCard>
                                <h2 className="text-xl font-bold mb-6 text-indigo-900 border-b border-indigo-100 pb-2">Precios e Inventario</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                                    {!formData.isService && (
                                        <div className="animate-scale-in">
                                            <label className="block text-sm font-semibold text-indigo-900/70 mb-2">
                                                Costo Compra ($) <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="number" step="0.01"
                                                value={formData.cost}
                                                onChange={e => {
                                                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                    setFormData({ ...formData, cost: val });
                                                    if (errors.cost) setErrors({ ...errors, cost: '' });
                                                }}
                                                className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:ring-2 outline-none transition-all text-indigo-950 font-mono ${errors.cost ? 'border-rose-400 focus:ring-rose-200' : 'border-indigo-100 focus:ring-indigo-500/50 focus:border-indigo-500'}`}
                                            />
                                            {errors.cost && <p className="text-xs text-rose-500 font-bold mt-1 ml-1">{errors.cost}</p>}
                                        </div>
                                    )}
                                    <div className={`transition-all duration-300 ${formData.isService ? 'md:col-span-3' : ''}`}>
                                        <label className="block text-sm font-semibold text-indigo-900/70 mb-2">
                                            Precio Venta ($) <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="number" step="0.01"
                                            value={formData.price}
                                            onChange={e => {
                                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                setFormData({ ...formData, price: val });
                                                if (errors.price) setErrors({ ...errors, price: '' });
                                            }}
                                            className={`w-full px-4 py-3 bg-white/50 border rounded-xl focus:ring-2 outline-none transition-all text-indigo-950 font-mono font-bold ${errors.price ? 'border-rose-400 focus:ring-rose-200' : 'border-indigo-100 focus:ring-indigo-500/50 focus:border-indigo-500'}`}
                                        />
                                        {errors.price && <p className="text-xs text-rose-500 font-bold mt-1 ml-1">{errors.price}</p>}
                                    </div>
                                    {!formData.isService && (
                                        <div className="animate-scale-in">
                                            <label className="block text-sm font-semibold text-indigo-900/70 mb-2">
                                                Descuento (%)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.discountPercentage}
                                                onChange={e => {
                                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                    setFormData({ ...formData, discountPercentage: val });
                                                }}
                                                className="w-full px-4 py-3 bg-white/50 border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all text-indigo-950 font-mono"
                                                placeholder="0"
                                                min="0"
                                                max="100"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {!formData.isService && (
                                        <>
                                            <div className="animate-scale-in">
                                                <label className="block text-sm font-semibold text-indigo-900/70 mb-2">
                                                    {isEdit ? 'Stock Actual' : 'Stock Inicial'} <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={formData.stock}
                                                    readOnly={isEdit}
                                                    onChange={e => {
                                                        if (isEdit) return;
                                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                        setFormData({ ...formData, stock: val });
                                                        if (errors.stock) setErrors({ ...errors, stock: '' });
                                                    }}
                                                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 outline-none transition-all font-mono ${isEdit ? 'bg-slate-100/50 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-white/50 border-indigo-100 focus:ring-indigo-500/50 focus:border-indigo-500 text-indigo-950'} ${errors.stock ? 'border-rose-400 focus:ring-rose-200' : ''}`}
                                                />
                                                {isEdit ? (
                                                    <p className="text-[10px] text-slate-400 mt-1 font-bold italic">* El stock se gestiona mediante Compras o Ajustes</p>
                                                ) : errors.stock && (
                                                    <p className="text-xs text-rose-500 font-bold mt-1 ml-1">{errors.stock}</p>
                                                )}
                                            </div>
                                            <div className="animate-scale-in">
                                                <label className="block text-sm font-semibold text-indigo-900/70 mb-2">
                                                    Stock Mínimo <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={formData.minStock}
                                                    onChange={e => {
                                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                        setFormData({ ...formData, minStock: val });
                                                    }}
                                                    className="w-full px-4 py-3 bg-white/50 border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all text-indigo-950 font-mono"
                                                    placeholder="Ej: 3"
                                                />
                                                <p className="text-[10px] text-slate-400 mt-1 italic">Nivel para alerta de stock bajo</p>
                                            </div>
                                        </>
                                    )}
                                    <div>
                                        <label className="block text-sm font-semibold text-indigo-900/70 mb-2">Código Barras</label>
                                        <input
                                            type="text"
                                            value={formData.barcode}
                                            onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                            className="w-full px-4 py-3 bg-white/50 border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all text-indigo-950 font-mono"
                                            placeholder="Escanea o escribe..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-indigo-900/70 mb-2">SKU (Interno)</label>
                                        <input
                                            type="text"
                                            value={formData.sku}
                                            onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                            className="w-full px-4 py-3 bg-white/50 border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all text-indigo-950 font-mono"
                                            placeholder="Generado autom. si vacío"
                                        />
                                    </div>
                                </div>
                            </GlassCard>
                        </div>

                        <div className="space-y-6">
                            {/* Media Section */}
                            <GlassCard>
                                <h2 className="text-lg font-bold mb-4 text-indigo-900 flex items-center justify-between">
                                    <span className="flex items-center gap-2"><ImageIcon size={20} className="text-indigo-600" /> Galería (Max 6)</span>
                                    <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full">{images.length}/6</span>
                                </h2>

                                <div className="mb-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-bold text-indigo-400 dark:text-indigo-300 uppercase tracking-wider">Imágenes</label>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowUrlInput(!showUrlInput)}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 underline font-semibold"
                                        >
                                            {showUrlInput ? 'Subir desde Archivo' : 'Agregar desde URL externa'}
                                        </button>
                                    </div>

                                    {showUrlInput ? (
                                        <div className="flex gap-2">
                                            <input
                                                type="url"
                                                placeholder="https://ejemplo.com/imagen.jpg"
                                                className="flex-1 px-3 py-2 bg-white/50 dark:bg-slate-900/50 border border-indigo-100 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none dark:text-white"
                                                value={newImageUrl}
                                                onChange={e => setNewImageUrl(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addImage())}
                                            />
                                            <button
                                                type="button"
                                                onClick={addImage}
                                                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"
                                            >
                                                <Plus size={20} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative border-2 border-dashed border-indigo-200 dark:border-slate-700 rounded-xl p-5 text-center hover:border-indigo-400 hover:bg-indigo-50/20 dark:hover:bg-slate-800/20 transition-all cursor-pointer group">
                                            <input 
                                                type="file" 
                                                accept="image/*"
                                                onChange={handleFileUpload}
                                                disabled={uploading || images.length >= 6}
                                                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                            />
                                            {uploading ? (
                                                <div className="flex flex-col items-center justify-center py-2">
                                                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-1" />
                                                    <p className="text-xs font-medium text-indigo-900/70 dark:text-slate-350">Subiendo a Cloudinary...</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-1">
                                                    <ImageIcon className="w-8 h-8 text-indigo-400 group-hover:text-indigo-600 transition-colors mb-1" />
                                                    <p className="text-xs font-semibold text-indigo-900/70 dark:text-slate-200">
                                                        Haga clic para buscar o arrastre aquí
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">
                                                        Max 5MB (JPG, PNG, WEBP)
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-indigo-200">
                                    {images.map((img, idx) => (
                                        <div key={idx} className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${img.isCover ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white/40 border-slate-100 hover:bg-white'}`}>
                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shrink-0">
                                                <img src={img.url} className="w-full h-full object-cover" alt="Preview" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-slate-500 truncate" title={img.url}>{img.url}</p>
                                                {img.isCover && <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">Portada Principal</span>}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {!img.isCover && (
                                                    <button type="button" onClick={() => setCover(idx)} className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg" title="Hacer Portada">
                                                        <Star size={16} />
                                                    </button>
                                                )}
                                                <button type="button" onClick={() => removeImage(idx)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg" title="Eliminar">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {images.length === 0 && (
                                        <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-indigo-100 rounded-xl">
                                            No hay imágenes
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6 border-t border-indigo-50 dark:border-slate-800 pt-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-bold text-indigo-400 dark:text-indigo-300 uppercase tracking-wider">Video Promocional</label>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowVideoUrlInput(!showVideoUrlInput)}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 underline font-semibold"
                                        >
                                            {showVideoUrlInput ? 'Subir Video desde Archivo' : 'Agregar desde URL externa'}
                                        </button>
                                    </div>

                                    {showVideoUrlInput ? (
                                        <div className="flex gap-2">
                                            <div className="p-2 bg-indigo-50 dark:bg-slate-800 rounded-lg text-indigo-400 dark:text-indigo-350"><PlayCircle size={20} /></div>
                                            <input
                                                type="url"
                                                value={formData.videoUrl}
                                                onChange={e => setFormData({ ...formData, videoUrl: e.target.value })}
                                                className="w-full px-3 py-2 bg-white/50 border border-indigo-100 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none dark:text-white"
                                                placeholder="https://youtube.com/..."
                                            />
                                        </div>
                                    ) : (
                                        <div className="relative border-2 border-dashed border-indigo-200 dark:border-slate-700 rounded-xl p-4 text-center hover:border-indigo-400 hover:bg-indigo-50/20 dark:hover:bg-slate-800/20 transition-all cursor-pointer group">
                                            <input 
                                                type="file" 
                                                accept="video/*"
                                                onChange={handleVideoUpload}
                                                disabled={uploadingVideo}
                                                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                            />
                                            {uploadingVideo ? (
                                                <div className="flex flex-col items-center justify-center py-2">
                                                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mb-1" />
                                                    <p className="text-xs font-medium text-indigo-900/70 dark:text-slate-350">Subiendo video...</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-1">
                                                    <PlayCircle className="w-6 h-6 text-indigo-400 group-hover:text-indigo-600 transition-colors mb-1" />
                                                    <p className="text-xs font-semibold text-indigo-900/70 dark:text-slate-200">
                                                        {formData.videoUrl ? 'Cambiar Video / Subir nuevo' : 'Haga clic para buscar o arrastre video'}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">
                                                        Max 20MB (MP4, WEBM)
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {formData.videoUrl && (
                                        <div className="mt-2 p-2 bg-indigo-50/30 dark:bg-slate-800/30 rounded-lg border border-indigo-100 dark:border-slate-800/50 flex items-center justify-between">
                                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={formData.videoUrl}>
                                                {formData.videoUrl}
                                            </span>
                                            <button 
                                                type="button" 
                                                onClick={() => setFormData({ ...formData, videoUrl: '' })}
                                                className="text-[10px] font-bold text-rose-500 hover:underline"
                                            >
                                                Eliminar Video
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </GlassCard>

                            <GlassCard>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                        <input
                                            type="checkbox"
                                            id="isActive"
                                            checked={formData.isActive}
                                            onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                            className="w-5 h-5 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500"
                                        />
                                        <label htmlFor="isActive" className="text-indigo-900 font-semibold cursor-pointer select-none">Disponible en Tienda</label>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95 disabled:opacity-50 transition-all"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                                        {isEdit ? 'Actualizar Producto' : 'Crear Producto'}
                                    </button>
                                </div>
                            </GlassCard>
                        </div>
                    </div>
                </form>
            </div>
            {catModalOpen && (
                <CategoryFormModal
                    category={null}
                    onClose={() => setCatModalOpen(false)}
                    onSuccess={() => {
                        setCatModalOpen(false);
                        fetchCategories();
                    }}
                />
            )}

            {subModalOpen && formData.categoryId > 0 && (
                <SubcategoryFormModal
                    subcategory={null}
                    categoryId={formData.categoryId}
                    onClose={() => setSubModalOpen(false)}
                    onSuccess={() => {
                        setSubModalOpen(false);
                        if (formData.categoryId) fetchSubcategories(formData.categoryId);
                    }}
                />
            )}
        </>
    );
}
