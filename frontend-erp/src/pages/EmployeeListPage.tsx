import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';
import { GlassCard } from '../components/common/GlassCard';
import type { Employee, EmployeeCreateDto } from '../services/employee.service';
import { employeeService } from '../services/employee.service';
import EmployeeFormModal from '../components/modals/EmployeeFormModal';
import { useNotificationStore } from '../store/useNotificationStore';

export default function EmployeeListPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const addNotification = useNotificationStore(s => s.addNotification);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const pageSize = 15;

    useEffect(() => {
        fetchEmployees(currentPage);
    }, [currentPage]);

    const fetchEmployees = async (page = 1) => {
        setLoading(true);
        try {
            const data = await employeeService.getAll(page, pageSize);
            setEmployees(data.items);
            setTotalPages(data.totalPages);
            setTotalItems(data.totalCount);
        } catch (err) {
            console.error('Error fetching employees', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('¿Estás seguro de eliminar este empleado?')) {
            try {
                await employeeService.delete(id);
                addNotification('Empleado eliminado correctamente', 'success');
                fetchEmployees(currentPage);
            } catch (err) {
                addNotification('Error al eliminar empleado', 'error');
            }
        }
    };

    const handleCreate = () => {
        setEditingEmployee(null);
        setIsModalOpen(true);
    };

    const handleEdit = (employee: Employee) => {
        setEditingEmployee(employee);
        setIsModalOpen(true);
    };

    const handleSave = async (data: EmployeeCreateDto) => {
        try {
            if (editingEmployee) {
                await employeeService.update(editingEmployee.id, { ...data, id: editingEmployee.id });
                addNotification('Empleado actualizado correctamente', 'success');
            } else {
                await employeeService.create(data);
                addNotification('Empleado creado correctamente', 'success');
            }
            fetchEmployees(currentPage);
        } catch (err) {
            console.error('Error saving employee', err);
            addNotification('Error al guardar empleado', 'error');
            throw err;
        }
    };

    const filteredEmployees = (employees || []).filter(e =>
        e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            <div className="space-y-6 animate-fade-in relative z-0">
                <div className="flex justify-between items-center">
                    {/* ... (rest of the content remains the same) */}
                    <div>
                        <h2 className="text-3xl font-bold text-slate-800">Empleados</h2>
                        <p className="text-slate-500 mt-1">Gestiona tu equipo de trabajo</p>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 font-medium"
                    >
                        <Plus size={20} />
                        Nuevo Empleado
                    </button>
                </div>

                <GlassCard className="p-0 overflow-hidden border-0">
                    <div className="p-6 border-b border-indigo-50/50 bg-white/40">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o rol..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead className="bg-indigo-50/50 text-slate-700 font-medium">
                                <tr>
                                    <th className="px-6 py-4 text-left">Empleado</th>
                                    <th className="px-6 py-4 text-left">Rol</th>
                                    <th className="px-6 py-4 text-left">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50/30">
                                {loading ? (
                                    <tr><td colSpan={4} className="text-center py-8 text-slate-500">Cargando empleados...</td></tr>
                                ) : filteredEmployees.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-8 text-slate-500">No se encontraron empleados</td></tr>
                                ) : (
                                    filteredEmployees.map(employee => (
                                        <tr key={employee.id} className="hover:bg-white/40 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-indigo-100/50 flex items-center justify-center text-indigo-600">
                                                        <Briefcase size={20} />
                                                    </div>
                                                    <span className="font-medium text-slate-700">{employee.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                <span className="px-3 py-1 bg-slate-100 rounded-full text-slate-600 text-sm font-medium">
                                                    {employee.role || 'Sin Rol'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {employee.isActive ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-sm font-medium border border-emerald-100">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        Activo
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 text-slate-500 text-sm font-medium border border-slate-100">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                        Inactivo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEdit(employee)}
                                                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(employee.id)}
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
                                Mostrando <span className="text-indigo-600 font-bold">{employees.length}</span> de <span className="text-slate-800 font-bold">{totalItems}</span> registros
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

            <EmployeeFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                initialData={editingEmployee}
            />
        </>
    );
}
