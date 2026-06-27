import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { GlassCard } from '../components/common/GlassCard';
import type { Client, ClientCreateDto } from '../services/client.service';
import { clientService } from '../services/client.service';
import ClientFormModal from '../components/modals/ClientFormModal';
import { useNotificationStore } from '../store/useNotificationStore';

export default function ClientListPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const addNotification = useNotificationStore(s => s.addNotification);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const pageSize = 15;

    useEffect(() => {
        fetchClients(currentPage);
    }, [currentPage]);

    const fetchClients = async (page = 1) => {
        setLoading(true);
        try {
            const data = await clientService.getAll(page, pageSize);
            setClients(data.items);
            setTotalPages(data.totalPages);
            setTotalItems(data.totalCount);
        } catch (err) {
            console.error('Error fetching clients', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('¿Estás seguro de eliminar este cliente?')) {
            try {
                await clientService.delete(id);
                addNotification('Cliente eliminado correctamente', 'success');
                fetchClients(currentPage);
            } catch (err) {
                addNotification('Error al eliminar cliente', 'error');
            }
        }
    };

    const handleCreate = () => {
        setEditingClient(null);
        setIsModalOpen(true);
    };

    const handleEdit = (client: Client) => {
        setEditingClient(client);
        setIsModalOpen(true);
    };

    const handleSave = async (data: ClientCreateDto) => {
        try {
            if (editingClient) {
                await clientService.update(editingClient.id, { ...data, id: editingClient.id });
                addNotification('Cliente actualizado correctamente', 'success');
            } else {
                await clientService.create(data);
                addNotification('Cliente creado correctamente', 'success');
            }
            fetchClients(currentPage);
        } catch (err) {
            console.error('Error saving client', err);
            addNotification('Error al guardar cliente', 'error');
            throw err; // Re-throw to let modal handle error display
        }
    };

    const filteredClients = (clients || []).filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cedulaRuc?.includes(searchTerm)
    );

    return (
        <>
            <div className="space-y-6 animate-fade-in relative z-0">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-800">Clientes</h2>
                        <p className="text-slate-500 mt-1">Gestiona tu base de clientes</p>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 font-medium"
                    >
                        <Plus size={20} />
                        Nuevo Cliente
                    </button>
                </div>

                <GlassCard className="p-0 overflow-hidden border-0">
                    <div className="p-6 border-b border-indigo-50/50 bg-white/40">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o cédula..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table-clean w-full border-collapse">
                            <thead>
                                <tr>
                                    <th>Cliente</th>
                                    <th>Identificación</th>
                                    <th>Contacto</th>
                                    <th>Ubicación</th>
                                    <th className="text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50/30">
                                {loading ? (
                                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">Cargando clientes...</td></tr>
                                ) : filteredClients.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">No se encontraron clientes</td></tr>
                                ) : (
                                    filteredClients.map(client => (
                                        <tr key={client.id} className="transition-colors hover:bg-white/40">
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-indigo-100/50 flex items-center justify-center text-indigo-600">
                                                        <User size={20} />
                                                    </div>
                                                    <span className="font-medium text-slate-700">{client.name}</span>
                                                </div>
                                            </td>
                                            <td className="text-slate-600">{client.cedulaRuc || '-'}</td>
                                            <td className="text-slate-600">
                                                <div className="flex flex-col text-sm">
                                                    <span>{client.email}</span>
                                                    <span className="text-slate-400">{client.phone}</span>
                                                </div>
                                            </td>
                                            <td className="text-slate-600">{client.address || '-'}</td>
                                            <td className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEdit(client)}
                                                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(client.id)}
                                                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {!loading && totalPages > 1 && (
                        <div className="px-6 py-4 bg-slate-50/50 border-t border-indigo-50/50 flex items-center justify-between">
                            <div className="text-sm text-slate-500 font-medium">
                                Mostrando <span className="text-indigo-600 font-bold">{clients.length}</span> de <span className="text-slate-800 font-bold">{totalItems}</span> registros
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-400 transition-all shadow-sm"
                                >
                                    <ChevronLeft size={20} />
                                </button>

                                <div className="flex items-center px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm text-indigo-600 shadow-sm">
                                    {currentPage} / {totalPages}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-400 transition-all shadow-sm"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                    )}
                </GlassCard>
            </div>

            <ClientFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                initialData={editingClient}
            />
        </>
    );
}
