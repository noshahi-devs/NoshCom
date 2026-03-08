import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Toast {
    message: string;
    title?: string;
    type: 'success' | 'error' | 'info' | 'warning';
    isModal?: boolean;
    duration?: number;
    icon?: string;
    showInput?: boolean;
    confirmText?: string;
    onConfirm?: (remarks: string) => void;
    onCancel?: () => void;
}

@Injectable({
    providedIn: 'root'
})
export class ToastService {
    private toastSubject = new Subject<Toast>();
    toast$ = this.toastSubject.asObservable();

    showSuccess(message: string, title?: string, duration = 3000) {
        this.toastSubject.next({ message, title, type: 'success', duration });
    }

    showError(message: string, title?: string, duration = 4000) {
        this.toastSubject.next({ message, title, type: 'error', duration });
    }

    showInfo(message: string, title?: string, duration = 3000) {
        this.toastSubject.next({ message, title, type: 'info', duration });
    }

    showWarning(message: string, title?: string, duration = 3500) {
        this.toastSubject.next({ message, title, type: 'warning', duration });
    }

    showModal(message: string, title: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
        this.toastSubject.next({ message, title, type, isModal: true });
    }

    showConfirm(title: string, message: string, onConfirm: (remarks: string) => void, onCancel?: () => void) {
        this.toastSubject.next({
            title,
            message,
            type: 'info',
            isModal: true,
            showInput: true,
            confirmText: 'Confirm',
            onConfirm,
            onCancel
        });
    }
}
