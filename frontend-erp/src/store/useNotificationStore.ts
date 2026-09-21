import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationAction {
    label: string;
    onClick: () => void;
}

export interface Notification {
    id: string;
    message: string;
    type: NotificationType;
    duration?: number;
    action?: NotificationAction;
}

interface NotificationState {
    notifications: Notification[];
    addNotification: (message: string, type?: NotificationType, duration?: number, action?: NotificationAction) => void;
    removeNotification: (id: string) => void;
    clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    addNotification: (message, type = 'success', duration = 3000, action) => {
        const id = Math.random().toString(36).substring(7);
        const newNotification = { id, message, type, duration, action };

        set((state) => ({
            notifications: [...state.notifications, newNotification],
        }));

        if (duration > 0) {
            setTimeout(() => {
                set((state) => ({
                    notifications: state.notifications.filter((n) => n.id !== id),
                }));
            }, duration);
        }
    },
    removeNotification: (id) => {
        set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
        }));
    },
    clearAll: () => set({ notifications: [] }),
}));
