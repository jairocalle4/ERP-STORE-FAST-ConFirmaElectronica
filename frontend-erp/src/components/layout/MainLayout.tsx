import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Layers, LogOut, User, Briefcase, FileText, ShoppingCart, X, Settings, DollarSign, BarChart2, Plus, Truck, Download, Bell, Info, AlertTriangle, Trash2, ChevronRight, Menu, Shield, Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, type Theme } from '../../store/useThemeStore';
import { notificationService, type Notification } from '../../services/notification.service';
import { useAuthStore } from '../../store/useAuthStore';
import { Toast } from '../common/Toast';
import { companyService } from '../../services/company.service';

const THEME_CONFIG: Record<Theme, { icon: React.ElementType; label: string; next: Theme }> = {
    light: { icon: Sun, label: 'Claro', next: 'dark' },
    dark:  { icon: Moon, label: 'Oscuro', next: 'system' },
    system: { icon: Monitor, label: 'Sistema', next: 'light' },
};

function ThemeToggleButton() {
    const { theme, cycleTheme } = useThemeStore();
    const { icon: Icon, label } = THEME_CONFIG[theme];
    return (
        <button
            onClick={cycleTheme}
            title={`Tema: ${label} (click para cambiar)`}
            aria-label={`Cambiar tema — actual: ${label}`}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-all relative group shadow-sm"
        >
            <Icon size={18} className="transition-all duration-300" />
            <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                {label}
            </span>
        </button>
    );
}

export default function MainLayout() {
    const { logout, user } = useAuthStore();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [companyName, setCompanyName] = useState('ERP-STORE-FAST');
    const location = useLocation();

    useEffect(() => {
        const fetchCompanyInfo = async () => {
            try {
                const settings = await companyService.getSettings();
                if (settings?.name) {
                    setCompanyName(settings.name);
                }
            } catch (error) {
                console.error('Error loading company info', error);
            }
        };
        fetchCompanyInfo();
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const [list, count] = await Promise.all([
                notificationService.getAll(),
                notificationService.getUnreadCount()
            ]);
            setNotifications(list);
            setUnreadCount(count);
        } catch (e) {
            console.error('Error fetching notifications', e);
        }
    };

    const markAsRead = async (id: number) => {
        try {
            await notificationService.markAsRead(id);
            setUnreadCount(prev => Math.max(0, prev - 1));
            setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (e) { console.error(e); }
    };

    const deleteNotif = async (id: number) => {
        try {
            await notificationService.delete(id);
            setNotifications(notifications.filter(n => n.id !== id));
            // Re-fetch count just in case
            const count = await notificationService.getUnreadCount();
            setUnreadCount(count);
        } catch (e) { console.error(e); }
    };

    // Auto-collapse on POS
    useEffect(() => {
        if (location.pathname === '/pos') {
            setIsCollapsed(true);
        } else {
            setIsCollapsed(false);
        }
    }, [location.pathname]);

    const hasPermission = (permission: string) => {
        if (user?.role === 'Admin') return true;
        return user?.permissions?.includes(permission);
    };

    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard.view' },
        { path: '/products', icon: Package, label: 'Productos', permission: 'products.view' },
        { path: '/categories', icon: Layers, label: 'Categorías', permission: 'products.view' },
        { path: '/suppliers', icon: Truck, label: 'Proveedores', permission: 'purchases.view' },
        { path: '/purchases', icon: Download, label: 'Compras', permission: 'purchases.view' },
        { path: '/clients', icon: User, label: 'Clientes', permission: 'sales.view' },
        { path: '/employees', icon: Briefcase, label: 'Empleados', permission: 'users.manage' },
        { path: '/sales', icon: FileText, label: 'Ventas', permission: 'sales.view' },
        { path: '/expenses', icon: DollarSign, label: 'Egresos', permission: 'expenses.manage' },
        { path: '/reports', icon: BarChart2, label: 'Reportes', permission: 'reports.view' },
        { path: '/pos', icon: ShoppingCart, label: 'Punto de Venta', permission: 'pos.access' },
        { path: '/cash-register', icon: DollarSign, label: 'Arqueo de Caja', permission: 'cash.manage' },
        { path: '/profile', icon: Shield, label: 'Usuarios', permission: 'users.manage' },
    ];

    const allowedNavItems = navItems.filter(item => hasPermission(item.permission));

    const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
    const [tooltipTop, setTooltipTop] = useState(0);

    const SidebarContent = ({ forceShowLabels = false }: { forceShowLabels?: boolean }) => {
        // In mobile (forceShowLabels=true), we NEVER want the visual collapsed state
        const isVisualCollapsed = isCollapsed && !forceShowLabels;

        return (
            <>
                <div className={`p-8 flex items-center justify-center border-b border-white/10 mx-4 transition-all duration-300 ${isVisualCollapsed ? 'px-2 py-6' : ''}`}>
                    <h1 className={`font-black tracking-tighter text-white filter drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] text-center break-words leading-tight transition-all duration-300 ${isVisualCollapsed ? 'text-2xl' : 'text-xl'}`}>
                        {isVisualCollapsed ? companyName.charAt(0) : companyName.toUpperCase()}
                    </h1>
                </div>

                <nav className="flex-1 px-3 mt-4 space-y-1 overflow-y-auto custom-scrollbar scrollbar-none overflow-x-visible">
                    {allowedNavItems.map((item) => {
                        const isItemActive = item.path === '/'
                            ? location.pathname === '/' || location.pathname === '/dashboard'
                            : location.pathname.startsWith(item.path);

                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                onMouseEnter={(e) => {
                                    if (isVisualCollapsed) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoveredLabel(item.label);
                                        setTooltipTop(rect.top + rect.height / 2);
                                    }
                                }}
                                onMouseLeave={() => setHoveredLabel(null)}
                                className={`flex items-center transition-all duration-300 group font-medium text-sm relative overflow-hidden ${isItemActive
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 z-10'
                                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                    } ${isVisualCollapsed ? 'w-11 h-11 justify-center rounded-xl mx-auto' : 'px-4 py-3 gap-3 rounded-xl'}`}
                            >
                                <>
                                    {isItemActive && <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl -z-10 opacity-100 animate-pulse-subtle"></div>}
                                    <item.icon size={20} className={`shrink-0 transition-transform duration-300 ${isItemActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                    <span className={`tracking-wide whitespace-nowrap transition-all duration-300 ${isVisualCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
                                        {item.label}
                                    </span>
                                </>
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Global Tooltip for Collapsed Sidebar */}
                {hoveredLabel && isVisualCollapsed && (
                    <div
                        className="fixed left-24 px-3 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl shadow-2xl z-[9999] animate-fade-in pointer-events-none flex items-center border border-white/20"
                        style={{ top: `${tooltipTop}px`, transform: 'translateY(-50%)' }}
                    >
                        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-600 rotate-45 border-l border-b border-white/10"></div>
                        {hoveredLabel.toUpperCase()}
                    </div>
                )}

                {/* Toggle Button for Desktop */}
                <div className="p-4 hidden md:block">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="w-full flex items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all group"
                    >
                        <div className={`transition-transform duration-500 ${isCollapsed ? 'rotate-180' : ''}`}>
                            <ChevronRight size={20} />
                        </div>
                    </button>
                </div>
            </>
        );
    };

    return (
        <div className="flex h-screen overflow-hidden text-slate-800 dark:text-slate-100 bg-slate-50/0 font-sans selection:bg-indigo-500/30">
            {/* Desktop Floating Sidebar */}
            <aside className={`hidden md:flex flex-col fixed left-4 top-4 bottom-4 glass-float rounded-3xl z-30 transition-all duration-500 border border-white/10 shadow-2xl ${isCollapsed ? 'w-20' : 'w-72'}`}>
                <SidebarContent />
            </aside>

            {/* Mobile Overlay & Sidebar */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[60] md:hidden">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                    <aside className="absolute left-0 top-0 bottom-0 w-[85%] max-w-xs glass-float flex flex-col z-[70] animate-slide-in-left shadow-2xl border-r border-white/10">
                        <button
                            className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <X size={24} />
                        </button>
                        <SidebarContent forceShowLabels={true} />
                    </aside>
                </div>
            )}

            {/* Main Content Wrapper */}
            <div className={`flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-500 ${isCollapsed ? 'md:ml-28' : 'md:ml-80'}`}>

                {/* Desktop Header / Mobile Header */}
                <header className="sticky top-0 z-20 px-6 py-4 flex justify-between items-center md:bg-transparent md:backdrop-blur-none bg-white/80 dark:bg-slate-950/80 backdrop-blur-md md:pt-6">
                    <div className="md:hidden flex items-center gap-3">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                        >
                            <Menu size={24} />
                        </button>
                        <span className="text-xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent break-words leading-tight">
                            {companyName.toUpperCase()}
                        </span>
                    </div>

                    <div className="hidden md:flex items-center gap-3">
                        <NavLink
                            to="/pos"
                            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-full font-bold shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
                        >
                            <ShoppingCart size={18} strokeWidth={2.5} />
                            <span>Nueva Venta</span>
                        </NavLink>
                        <NavLink
                            to="/products/new"
                            className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 px-5 py-2.5 rounded-full font-bold shadow-sm transition-all hover:scale-105 active:scale-95"
                        >
                            <Plus size={18} strokeWidth={2.5} />
                            <span>Nuevo Producto</span>
                        </NavLink>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 hidden lg:inline-block">{new Date().toLocaleDateString()}</span>
                        <ThemeToggleButton />

                        {/* Notifications Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setIsNotifOpen(!isNotifOpen);
                                    setIsUserMenuOpen(false);
                                    if (!isNotifOpen) fetchNotifications();
                                }}
                                className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all relative"
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] font-black flex items-center justify-center border-2 border-white animate-bounce-subtle">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {isNotifOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                                    <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 p-2 animate-scale-in origin-top-right z-50 max-h-[500px] overflow-hidden flex flex-col">
                                        <div className="p-4 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/30 dark:bg-slate-700/30 rounded-t-xl shrink-0">
                                            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
                                                <Bell size={16} className="text-indigo-600" /> Notificaciones
                                            </h3>
                                            {notifications.length > 0 && (
                                                <button
                                                    onClick={async () => {
                                                        // Immediately clear UI — instant feedback
                                                        setNotifications([]);
                                                        setUnreadCount(0);
                                                        // Then persist to DB
                                                        await notificationService.deleteAll();
                                                    }}
                                                    className="group flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={12} className="group-hover:scale-110 transition-transform" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider">Borrar Todo</span>
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
                                            {notifications.length === 0 ? (
                                                <div className="py-10 text-center text-slate-400">
                                                    <Info size={32} className="mx-auto mb-2 opacity-20" />
                                                    <p className="font-bold text-sm text-slate-300 italic">No tienes notificaciones</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    {notifications.map(n => (
                                                        <div
                                                            key={n.id}
                                                            className={`p-4 rounded-2xl mx-2 my-1 transition-all cursor-pointer group flex items-start gap-3 border ${n.isRead ? 'bg-transparent border-transparent' : 'bg-indigo-50/40 border-indigo-100/50 hover:bg-white hover:shadow-lg hover:shadow-indigo-500/5'}`}
                                                            onClick={async () => {
                                                                if (!n.isRead) await markAsRead(n.id);
                                                            }}
                                                        >
                                                            <div className={`mt-0.5 p-2 rounded-xl ${n.type === 'Warning' ? 'bg-amber-100 text-amber-600' :
                                                                n.type === 'Error' ? 'bg-rose-100 text-rose-600' :
                                                                    'bg-indigo-100 text-indigo-600'
                                                                }`}>
                                                                {n.type === 'Warning' && <AlertTriangle size={14} />}
                                                                {n.type === 'Error' && <AlertTriangle size={14} />}
                                                                {n.type !== 'Warning' && n.type !== 'Error' && <Info size={14} />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <p className="font-black text-slate-800 text-[11px] tracking-tight truncate uppercase">{n.title}</p>
                                                                    <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap">
                                                                        {new Date(n.createdAt).toLocaleDateString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed font-medium">{n.message}</p>
                                                                {n.link && (
                                                                    <NavLink
                                                                        to={n.link}
                                                                        onClick={() => setIsNotifOpen(false)}
                                                                        className="inline-flex items-center gap-1 mt-2.5 text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest transition-colors"
                                                                    >
                                                                        Ver detalle <ChevronRight size={10} strokeWidth={3} />
                                                                    </NavLink>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }}
                                                                className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* User Menu Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-indigo-50 hover:ring-indigo-200 transition-all cursor-pointer"
                            >
                                {user?.username?.substring(0, 2).toUpperCase() || 'AD'}
                            </button>

                            {/* Overlay to close menu when clicking outside */}
                            {isUserMenuOpen && (
                                <div
                                    className="fixed inset-0 z-40 bg-transparent"
                                    onClick={() => setIsUserMenuOpen(false)}
                                />
                            )}

                            {/* Dropdown Content */}
                            {isUserMenuOpen && (
                                <div className="absolute right-0 top-full mt-3 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-2 animate-scale-in origin-top-right z-50">
                                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                            {user?.username?.substring(0, 2).toUpperCase() || 'AD'}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-bold text-slate-800 truncate">{user?.username || 'Admin'}</p>
                                            <p className="text-xs text-slate-500 truncate">{user?.role || 'Administrator'}</p>
                                        </div>
                                    </div>

                                    <div className="py-2">
                                        {hasPermission('settings.manage') && (
                                            <NavLink
                                                to="/settings"
                                                onClick={() => setIsUserMenuOpen(false)}
                                                className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all text-sm font-medium"
                                            >
                                                <Settings size={18} />
                                                Configuración
                                            </NavLink>
                                        )}
                                        <NavLink
                                            to="/profile"
                                            onClick={() => setIsUserMenuOpen(false)}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all text-sm font-medium"
                                        >
                                            <User size={18} />
                                            Mi Perfil
                                        </NavLink>
                                    </div>

                                    <div className="border-t border-slate-100 dark:border-slate-700 py-2">
                                        <button
                                            onClick={() => {
                                                setIsUserMenuOpen(false);
                                                logout();
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all text-sm font-medium"
                                        >
                                            <LogOut size={18} />
                                            Cerrar Sesión
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth custom-scrollbar dark:text-slate-100">
                    <Outlet />
                </main>
            </div>
            <Toast />
        </div>
    );
}
