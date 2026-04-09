import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({
    providedIn: 'root'
})
export class AlertService {

    constructor() { }

    private baseConfig = {
        customClass: {
            popup: 'sui-swal-popup',
            confirmButton: 'sui-btn-primary',
            cancelButton: 'sui-btn-outline'
        },
        buttonsStyling: false,
        showClass: {
            popup: 'animate__animated animate__fadeIn animate__faster'
        },
        hideClass: {
            popup: ''
        }
    };

    private fire(config: any) {
        this.forceCleanup();

        const externalDidOpen = config?.didOpen;
        const ensureButtonsEnabled = () => {
            const confirmButton = Swal.getConfirmButton();
            const denyButton = Swal.getDenyButton();
            const cancelButton = Swal.getCancelButton();

            [confirmButton, denyButton, cancelButton].forEach((button) => {
                if (!button) return;
                button.disabled = false;
                button.removeAttribute('disabled');
                button.removeAttribute('aria-disabled');
            });
        };

        return new Promise<any>((resolve) => {
            let settled = false;

            const settle = (result: any) => {
                if (settled) {
                    return;
                }

                settled = true;
                Swal.close();
                this.forceCleanup();
                resolve(result);
            };

            Swal.fire({
                ...this.baseConfig,
                ...config,
                didOpen: (popup) => {
                    ensureButtonsEnabled();
                    setTimeout(() => ensureButtonsEnabled(), 0);
                    setTimeout(() => ensureButtonsEnabled(), 60);

                    const confirmButton = Swal.getConfirmButton();
                    const denyButton = Swal.getDenyButton();
                    const cancelButton = Swal.getCancelButton();

                    if (confirmButton && config?.showConfirmButton !== false) {
                        confirmButton.onclick = (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            settle({ isConfirmed: true, isDenied: false, isDismissed: false, value: true });
                        };
                    }

                    if (denyButton) {
                        denyButton.onclick = (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            settle({ isConfirmed: false, isDenied: true, isDismissed: false, value: false });
                        };
                    }

                    if (cancelButton) {
                        cancelButton.onclick = (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            settle({ isConfirmed: false, isDenied: false, isDismissed: true, dismiss: Swal.DismissReason.cancel });
                        };
                    }

                    externalDidOpen?.(popup);
                },
                didRender: () => {
                    ensureButtonsEnabled();
                }
            }).then((result) => {
                settle(result);
            });
        });
    }

    /**
     * Standard Landscape Alerts
     */
    success(message: string, title: string = 'SUCCESS') {
        return this.fire({
            title: title.toUpperCase(),
            text: message,
            icon: 'success',
            confirmButtonText: 'OK'
        });
    }

    error(message: string, title: string = 'ERROR') {
        return this.fire({
            title: title.toUpperCase(),
            text: message,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }

    warning(message: string, title: string = 'WARNING') {
        return this.fire({
            title: title.toUpperCase(),
            text: message,
            icon: 'warning',
            confirmButtonText: 'OK'
        });
    }

    info(message: string, title: string = 'INFO') {
        return this.fire({
            title: title.toUpperCase(),
            text: message,
            icon: 'info',
            confirmButtonText: 'OK'
        });
    }

    confirm(message: string, title: string = 'ARE YOU SURE?') {
        return this.fire({
            title: title.toUpperCase(),
            text: message,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'YES',
            cancelButtonText: 'NO'
        });
    }

    /**
     * Premium Centered Modal Notification (Landscape)
     */
    toast(message: string, title: string = 'NOTIFICATION', icon: 'success' | 'error' | 'warning' | 'info' = 'success') {
        return this.fire({
            customClass: {
                popup: 'sui-swal-modal-toast'
            },
            title: title.toUpperCase(),
            text: message,
            icon: icon,
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
            allowOutsideClick: true
        });
    }

    loading(message: string = 'PLEASE WAIT...') {
        return this.fire({
            title: message.toUpperCase(),
            showConfirmButton: false,
            allowOutsideClick: false,
            allowEscapeKey: false,
            allowEnterKey: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    }

    close() {
        Swal.close();
    }

    forceCleanup() {
        Swal.close();

        if (typeof document === 'undefined') {
            return;
        }

        document.body.classList.remove('swal2-shown', 'swal2-height-auto', 'swal2-no-backdrop');
        document.body.style.removeProperty('padding-right');

        document.querySelectorAll('.swal2-container').forEach((el) => el.remove());
    }
}
