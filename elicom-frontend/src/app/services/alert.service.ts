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
            popup: 'animate__animated animate__fadeOut animate__faster'
        }
    };

    /**
     * Standard Landscape Alerts
     */
    success(message: string, title: string = 'SUCCESS') {
        return Swal.fire({
            ...this.baseConfig,
            title: title.toUpperCase(),
            text: message,
            icon: 'success',
            confirmButtonText: 'OK'
        });
    }

    error(message: string, title: string = 'ERROR') {
        return Swal.fire({
            ...this.baseConfig,
            title: title.toUpperCase(),
            text: message,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }

    warning(message: string, title: string = 'WARNING') {
        return Swal.fire({
            ...this.baseConfig,
            title: title.toUpperCase(),
            text: message,
            icon: 'warning',
            confirmButtonText: 'OK'
        });
    }

    info(message: string, title: string = 'INFO') {
        return Swal.fire({
            ...this.baseConfig,
            title: title.toUpperCase(),
            text: message,
            icon: 'info',
            confirmButtonText: 'OK'
        });
    }

    confirm(message: string, title: string = 'ARE YOU SURE?') {
        return Swal.fire({
            ...this.baseConfig,
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
        return Swal.fire({
            ...this.baseConfig,
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
        return Swal.fire({
            ...this.baseConfig,
            title: message.toUpperCase(),
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    }

    close() {
        Swal.close();
    }
}
