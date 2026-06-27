import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useNotificationStore } from '../store/useNotificationStore';

interface Subcategory {
    id: number;
    name: string;
    categoryId: number;
    isActive: boolean;
}

interface SubcategoryFormModalProps {
    subcategory: Subcategory | null;
    categoryId: number;
    onClose: () => void;
    onSuccess: () => void;
}

const SubcategoryFormModal: React.FC<SubcategoryFormModalProps> = ({ subcategory, categoryId, onClose, onSuccess }) => {
    const isEdit = Boolean(subcategory);
    const [loading, setLoading] = useState(false);
    const addNotification = useNotificationStore(s => s.addNotification);

    const [formData, setFormData] = useState({
        name: '',
        categoryId: categoryId,
        isActive: true
    });

    useEffect(() => {
        if (subcategory) {
            setFormData({
                name: subcategory.name,
                categoryId: subcategory.categoryId,
                isActive: subcategory.isActive
            });
        }
    }, [subcategory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isEdit && subcategory) {
                await api.put(`/subcategories/${subcategory.id}`, { ...formData, id: subcategory.id });
                addNotification('Subcategoría actualizada con éxito');
            } else {
                await api.post('/subcategories', formData);
                addNotification('Subcategoría creada con éxito');
            }
            onSuccess();
        } catch (err: any) {
            console.error(err);
            let errorMessage = 'Error al guardar subcategoría.';

            if (err.response?.status === 401) {
                errorMessage = 'Sesión expirada. Por favor, cierra sesión y vuelve a ingresar.';
            } else if (err.response && err.response.data) {
                errorMessage = typeof err.response.data === 'string'
                    ? err.response.data
                    : (err.response.data.title || err.response.data.message || errorMessage);
            }
            addNotification(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-scale-in border border-slate-100 dark:border-slate-700/50">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">{isEdit ? 'Editar Subcategoría' : 'Nueva Subcategoría'}</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full transition-all cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl focus:bg-white dark:focus:bg-slate-850 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all placeholder:text-slate-350 text-slate-700 dark:text-white font-medium"
                            placeholder="Ej: Auriculares, Mouse, etc."
                            required
                        />
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/50">
                        <input
                            type="checkbox"
                            id="subcatActive"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="subcatActive" className="text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">Subcategoría Activa</label>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold transition-all cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] py-4 bg-slate-900 dark:bg-indigo-600 hover:bg-black dark:hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            {isEdit ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SubcategoryFormModal;
