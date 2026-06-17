import api from './api';

export interface CompanySetting {
    id: number;
    name: string;
    ruc: string;
    address: string;
    phone?: string;
    email?: string;
    legalMessage?: string;
    sriAuth?: string;
    establishment?: string;
    pointOfIssue?: string;
    currentSequence: number;
    expirationDate?: string;
    socialReason?: string;
    brevoApiKey?: string;
    coverImageUrl?: string;
    logoUrl?: string;
    sriEnvironment?: string;
}

export interface CompanySettingDto {
    name: string;
    ruc: string;
    address: string;
    phone?: string;
    email?: string;
    legalMessage?: string;
    sriAuth?: string;
    establishment?: string;
    pointOfIssue?: string;
    currentSequence: number;
    expirationDate?: string;
    socialReason?: string;
    brevoApiKey?: string;
    coverImageUrl?: string;
    logoUrl?: string;
    sriEnvironment?: string;
}

export const companyService = {
    getSettings: async () => {
        const response = await api.get<CompanySetting>('/companysettings');
        return response.data;
    },
    updateSettings: async (dto: CompanySettingDto) => {
        const response = await api.put<CompanySetting>('/companysettings', dto);
        return response.data;
    }
};
