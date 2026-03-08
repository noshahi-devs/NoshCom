import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
    id: number;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    duration?: number;
}

@Injectable({
    providedIn: 'root'
})
export class ToastService {
    private toastsSubject = new BehaviorSubject<Toast[]>([]);
    public toasts$ = this.toastsSubject.asObservable();
    private nextId = 1;

    showSuccess(message: string, duration: number = 5000): void {
        this.show('success', message, duration);
    }

    showError(message: string, duration: number = 7000): void {
        this.show('error', message, duration);
    }

    showInfo(message: string, duration: number = 5000): void {
        this.show('info', message, duration);
    }

    showWarning(message: string, duration: number = 5000): void {
        this.show('warning', message, duration);
    }

    private show(type: Toast['type'], message: string, duration: number): void {
        const toast: Toast = {
            id: this.nextId++,
            type,
            message,
            duration
        };

        const currentToasts = this.toastsSubject.value;
        this.toastsSubject.next([...currentToasts, toast]);

        if (duration > 0) {
            setTimeout(() => this.remove(toast.id), duration);
        }
    }

    remove(id: number): void {
        const currentToasts = this.toastsSubject.value;
        this.toastsSubject.next(currentToasts.filter(t => t.id !== id));
    }

    clear(): void {
        this.toastsSubject.next([]);
    }
}
