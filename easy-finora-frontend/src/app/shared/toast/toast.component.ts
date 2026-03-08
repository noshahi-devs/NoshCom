import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService, Toast } from './toast.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-toast',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './toast.component.html',
    styleUrl: './toast.component.scss'
})
export class ToastComponent implements OnInit, OnDestroy {
    toasts: Toast[] = [];
    adminRemarks: string = '';
    private subscription?: Subscription;

    constructor(
        private toastService: ToastService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.subscription = this.toastService.toast$.subscribe(toast => {
            // Using setTimeout to ensure toast is pushed in a new check cycle, avoiding NG0100
            setTimeout(() => {
                this.toasts = [...this.toasts, toast];

                // Set default remarks to "Approved" if input is required
                if (toast.showInput) {
                    this.adminRemarks = 'Approved';
                }

                this.cdr.detectChanges();
            });

            // Only auto-remove if not a modal OR if duration is explicitly provided for modal
            if (!toast.isModal || toast.duration) {
                setTimeout(() => {
                    this.removeToast(toast);
                }, toast.duration || 3000);
            }
        });
    }

    ngOnDestroy() {
        this.subscription?.unsubscribe();
    }

    removeToast(toast: Toast) {
        const index = this.toasts.indexOf(toast);
        if (index > -1) {
            this.toasts.splice(index, 1);
        }
    }

    hasToasts() {
        return this.toasts.some(t => !t.isModal);
    }

    getToasts() {
        return this.toasts.filter(t => !t.isModal);
    }

    hasModalAlerts() {
        return this.toasts.some(t => !!t.isModal);
    }

    getModalAlerts() {
        return this.toasts.filter(t => !!t.isModal);
    }

    confirm(toast: Toast, remarks: string) {
        if (toast.onConfirm) {
            toast.onConfirm(remarks);
        }
        this.removeToast(toast);
    }

    confirmWithReset(toast: Toast) {
        this.confirm(toast, this.adminRemarks);
        this.adminRemarks = ''; // Reset for next time
    }

    cancel(toast: Toast) {
        if (toast.onCancel) {
            toast.onCancel();
        }
        this.adminRemarks = ''; // Reset on cancel too
        this.removeToast(toast);
    }
}
