import api from './api';
import type { PagedResponse } from './types';

export interface Expense {
    id: number;
    description: string;
    amount: number;
    expenseCategoryId: number;
    categoryName: string;
    date: string; // ISO string
    paymentMethod: string;
    notes?: string;
    createdAt: string;
}

export interface CreateExpenseDto {
    description: string;
    amount: number;
    expenseCategoryId: number;
    date: string;
    paymentMethod: string;
    notes?: string;
    deductFromCashRegister?: boolean;
}

export const expensesService = {
    getAll: async (page = 1, pageSize = 20) => {
        const response = await api.get<PagedResponse<Expense>>('/expenses', {
            params: { page, pageSize }
        });
        return response.data;
    },

    create: async (data: CreateExpenseDto) => {
        const response = await api.post<Expense>('/expenses', data);
        return response.data;
    },

    update: async (id: number, data: CreateExpenseDto) => {
        const response = await api.put(`/expenses/${id}`, data);
        return response.data;
    },

    delete: async (id: number) => {
        await api.delete(`/expenses/${id}`);
    }
};
