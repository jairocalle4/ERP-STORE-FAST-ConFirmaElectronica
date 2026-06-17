import api from './api';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ElectronicBillingResult {
    success: boolean;
    accessKey?: string;
    authorizationNumber?: string;
    authorizationDate?: string;
    status: 'AUTORIZADO' | 'PENDIENTE' | 'NO_AUTORIZADO' | 'ERROR';
    errorMessage?: string;
    emailSent?: boolean;
    emailError?: string;
}

export interface ElectronicBillingStatus {
    isElectronic: boolean;
    electronicStatus?: string;
    accessKey?: string;
    authorizationNumber?: string;
    authorizationDate?: string;
    sriErrorMessage?: string;
    noteNumber?: string;
}

export interface ElectronicBillingSettings {
    electronicBillingEnabled: boolean;
    tributaryRegime?: string;
    sriEnvironment?: string;
    commercialName?: string;
    sriEstablishment?: string;
    sriPointOfIssue?: string;
    /** IVA como porcentaje (ej. 15.00 = 15%) */
    ivaRate: number;
    /** Si hay firma .p12 configurada */
    hasSignature: boolean;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const electronicBillingService = {

    /** Emite la factura electrónica al SRI para una venta existente */
    emitirFactura: async (saleId: number): Promise<ElectronicBillingResult> => {
        const response = await api.post<ElectronicBillingResult>(
            `/electronic-billing/emit/${saleId}`
        );
        return response.data;
    },

    /** Obtiene el estado de FE de una venta */
    obtenerEstado: async (saleId: number): Promise<ElectronicBillingStatus> => {
        const response = await api.get<ElectronicBillingStatus>(
            `/electronic-billing/status/${saleId}`
        );
        return response.data;
    },

    /** URL para descarga del XML autorizado */
    getXmlUrl: (saleId: number): string =>
        `${api.defaults.baseURL}/electronic-billing/xml/${saleId}`,

    /** URL para descarga del PDF RIDE */
    getRideUrl: (saleId: number): string =>
        `${api.defaults.baseURL}/electronic-billing/ride/${saleId}`,

    /** Descarga el XML en el navegador */
    descargarXml: async (saleId: number, noteNumber?: string) => {
        const response = await api.get(`/electronic-billing/xml/${saleId}`, {
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `factura_${noteNumber || saleId}.xml`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    /** Descarga el PDF RIDE en el navegador */
    descargarRide: async (saleId: number, noteNumber?: string) => {
        const response = await api.get(`/electronic-billing/ride/${saleId}`, {
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `RIDE_${noteNumber || saleId}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    /** Sube el archivo .p12 de firma electrónica */
    subirFirma: async (file: File, password: string) => {
        const formData = new FormData();
        formData.append('File', file);
        formData.append('Password', password);
        const response = await api.post('/electronic-billing/upload-signature', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    /** Obtiene la configuración de FE de la empresa */
    obtenerConfiguracion: async (): Promise<ElectronicBillingSettings> => {
        const response = await api.get<ElectronicBillingSettings>('/electronic-billing/settings');
        return response.data;
    },

    /** Guarda la configuración de FE */
    guardarConfiguracion: async (settings: Omit<ElectronicBillingSettings, 'hasSignature'>) => {
        const response = await api.put('/electronic-billing/settings', settings);
        return response.data;
    },

    /** Reenvía el correo electrónico de la factura al cliente */
    reenviarCorreo: async (saleId: number | string) => {
        const response = await api.post(`/electronic-billing/resend-email/${saleId}`);
        return response.data;
    },
};
