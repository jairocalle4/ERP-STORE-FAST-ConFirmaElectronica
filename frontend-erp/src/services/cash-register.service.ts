import api from './api';

export interface CashRegisterSession {
    id: number;
    userId: number;
    openTime: string;
    closeTime?: string;
    openAmount: number;
    closeAmount: number;
    calculatedAmount: number;
    discrepancy: number;
    status: string; // 'Open', 'Closed'
    notes?: string;
    user?: {
        username: string;
    };
}

export interface CashTransaction {
    id: number;
    cashRegisterSessionId: number;
    type: string; // 'Income', 'Expense'
    amount: number;
    description: string;
    date: string;
}

export interface CashRegisterSummary {
    sessionId: number;
    openAmount: number;
    cashSales: number;
    expenses: number;
    manualIncome: number;
    manualExpense: number;
    calculatedBalance: number;
}

export const cashRegisterService = {
    getStatus: async () => {
        const response = await api.get<CashRegisterSession>('/cash-register/status');
        return response.data;
    },

    openSession: async (amount: number) => {
        const response = await api.post<CashRegisterSession>('/cash-register/open', { amount });
        return response.data;
    },

    getSummary: async () => {
        const response = await api.get<CashRegisterSummary>('/cash-register/summary');
        return response.data;
    },

    closeSession: async (closeAmount: number, notes?: string) => {
        const response = await api.post<CashRegisterSession>('/cash-register/close', { closeAmount, notes });
        return response.data;
    },

    addTransaction: async (type: string, amount: number, description: string) => {
        const response = await api.post<CashTransaction>('/cash-register/transaction', { type, amount, description });
        return response.data;
    },

    getHistory: async () => {
        const response = await api.get<CashRegisterSession[]>('/cash-register/history');
        return response.data;
    },
    
    getSessionDetails: async (id: number) => {
        const response = await api.get<{
            session: CashRegisterSession;
            manualTransactions: CashTransaction[];
            sales: Array<{ id: number; noteNumber: string; total: number; date: string; observation: string }>;
            expenses: Array<{ id: number; description: string; amount: number; date: string; notes?: string }>;
        }>(`/cash-register/session/${id}/details`);
        return response.data;
    },

    getCurrentSessionDetails: async () => {
        const response = await api.get<{
            session: CashRegisterSession;
            manualTransactions: CashTransaction[];
            sales: Array<{ id: number; noteNumber: string; total: number; date: string; observation: string }>;
            expenses: Array<{ id: number; description: string; amount: number; date: string; notes?: string }>;
        }>('/cash-register/current/details');
        return response.data;
    }
};
