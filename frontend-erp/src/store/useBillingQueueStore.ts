import { create } from 'zustand';
import { electronicBillingService, type ElectronicBillingResult } from '../services/electronic-billing.service';
import { useNotificationStore } from './useNotificationStore';

export interface BillingJob {
    id: string;
    saleId: number;
    saleNumber?: string;
    status: 'processing' | 'success' | 'error';
    result?: ElectronicBillingResult;
    errorMessage?: string;
    startTime: number;
}

interface BillingOptions {
    onSuccess?: (result: ElectronicBillingResult) => void;
    onError?: (error: any) => void;
}

interface BillingQueueState {
    activeJob: BillingJob | null;
    isModalOpen: boolean;
    viewSaleId: number | null; // Trigger global SaleDetailsModal
    
    startBilling: (saleId: number, saleNumber?: string, options?: BillingOptions) => Promise<ElectronicBillingResult>;
    minimizeToBackground: () => void;
    reopenModal: () => void;
    closeModal: () => void;
    clearJob: () => void;
    setGlobalViewSaleId: (saleId: number | null) => void;
}

export const useBillingQueueStore = create<BillingQueueState>((set, get) => ({
    activeJob: null,
    isModalOpen: false,
    viewSaleId: null,

    startBilling: async (saleId: number, saleNumber?: string, options?: BillingOptions) => {
        const jobId = Math.random().toString(36).substring(7);
        const newJob: BillingJob = {
            id: jobId,
            saleId,
            saleNumber: saleNumber || `#${saleId}`,
            status: 'processing',
            startTime: Date.now()
        };

        set({
            activeJob: newJob,
            isModalOpen: true
        });

        try {
            const result = await electronicBillingService.emitirFactura(saleId);
            const currentJob = get().activeJob;

            // Only process if it's still the active job
            if (currentJob?.id === jobId) {
                const wasMinimized = !get().isModalOpen;

                if (result.success) {
                    set({
                        activeJob: {
                            ...currentJob,
                            status: 'success',
                            result
                        }
                    });

                    if (wasMinimized) {
                        // Notify in top-right with "Ver factura" action button
                        useNotificationStore.getState().addNotification(
                            `¡Factura autorizada por el SRI! Venta ${newJob.saleNumber}`,
                            'success',
                            10000,
                            {
                                label: 'Ver factura',
                                onClick: () => get().setGlobalViewSaleId(saleId)
                            }
                        );
                        // Clean up after 1s
                        setTimeout(() => {
                            if (get().activeJob?.id === jobId) {
                                set({ activeJob: null });
                            }
                        }, 1000);
                    }

                    options?.onSuccess?.(result);
                } else {
                    const errorMsg = result.errorMessage || 'Comprobante no autorizado por el SRI';
                    set({
                        activeJob: {
                            ...currentJob,
                            status: 'error',
                            result,
                            errorMessage: errorMsg
                        }
                    });

                    if (wasMinimized) {
                        useNotificationStore.getState().addNotification(
                            `Error al facturar Venta ${newJob.saleNumber}: ${errorMsg}`,
                            'error',
                            9000,
                            {
                                label: 'Ver detalles',
                                onClick: () => get().setGlobalViewSaleId(saleId)
                            }
                        );
                        setTimeout(() => {
                            if (get().activeJob?.id === jobId) {
                                set({ activeJob: null });
                            }
                        }, 1000);
                    }

                    options?.onError?.(result);
                }
            }

            return result;
        } catch (err: any) {
            const serverError = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Error de conexión con el servicio SRI';
            const currentJob = get().activeJob;

            if (currentJob?.id === jobId) {
                const wasMinimized = !get().isModalOpen;
                set({
                    activeJob: {
                        ...currentJob,
                        status: 'error',
                        errorMessage: serverError
                    }
                });

                if (wasMinimized) {
                    useNotificationStore.getState().addNotification(
                        `Error al emitir factura para Venta ${newJob.saleNumber}: ${serverError}`,
                        'error',
                        9000,
                        {
                            label: 'Ver venta',
                            onClick: () => get().setGlobalViewSaleId(saleId)
                        }
                    );
                    setTimeout(() => {
                        if (get().activeJob?.id === jobId) {
                            set({ activeJob: null });
                        }
                    }, 1000);
                }

                options?.onError?.(err);
            }

            return {
                success: false,
                status: 'ERROR',
                errorMessage: serverError
            };
        }
    },

    minimizeToBackground: () => {
        set({ isModalOpen: false });
    },

    reopenModal: () => {
        if (get().activeJob) {
            set({ isModalOpen: true });
        }
    },

    closeModal: () => {
        set({ isModalOpen: false });
    },

    clearJob: () => {
        set({ activeJob: null, isModalOpen: false });
    },

    setGlobalViewSaleId: (saleId: number | null) => {
        set({ viewSaleId: saleId });
    }
}));
