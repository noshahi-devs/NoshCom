import { AfterViewInit, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import Swal from 'sweetalert2';
import { Header } from '../../../shared/header/header';

@Component({
    selector: 'app-customer-layout',
    standalone: true,
    imports: [CommonModule, RouterModule, Header],
    templateUrl: './customer-layout.component.html',
    styleUrl: './customer-layout.component.scss'
})
export class CustomerLayoutComponent implements OnInit, AfterViewInit {
    userName: string = 'Customer';
    isSidebarCollapsed: boolean = true;
    sidebarStickyTop: number = 0;

    menuGroups = [
        {
            title: 'Account',
            items: [
                { label: 'Dashboard', path: '/customer/dashboard', icon: 'fa-table-cells' },
                { label: 'My Profile', path: '/customer/profile', icon: 'fa-user' },
                { label: 'Customer Service', path: '/customer/support', icon: 'fa-headset' }
            ]
        },
        {
            title: 'Orders',
            items: [
                { label: 'All Orders', path: '/customer/orders', icon: 'fa-box' },
                { label: 'Pending', path: '/customer/orders/Pending', icon: 'fa-clock' },
                { label: 'Shipped', path: '/customer/orders/Shipped', icon: 'fa-truck' },
                { label: 'Delivered', path: '/customer/orders/Delivered', icon: 'fa-check-double' },
                { label: 'Cancelled', path: '/customer/orders/Cancelled', icon: 'fa-xmark' },
                { label: 'Return', path: '/customer/orders/Return', icon: 'fa-rotate-left' }
            ]
        }
    ];

    constructor(
        private router: Router,
        private authService: AuthService
    ) { }

    ngAfterViewInit(): void {
        setTimeout(() => this.updateSidebarStickyTop());
    }

    toggleSidebar() {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }

    ngOnInit(): void {
        this.authService.currentUser$.subscribe(user => {
            if (user) {
                this.userName = user.name
                    ? `${user.name}${user.surname ? ' ' + user.surname : ''}`
                    : (user.userName || 'Customer');

                setTimeout(() => this.updateSidebarStickyTop());
            }
        });
    }

    @HostListener('window:resize')
    onWindowResize(): void {
        this.updateSidebarStickyTop();
    }

    logout() {
        Swal.fire({
            title: 'Logout',
            text: 'Are you sure you want to sign out?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, logout',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#000000',
            cancelButtonColor: '#d33'
        }).then((result) => {
            if (result.isConfirmed) {
                this.authService.logout();
                this.router.navigate(['/']);
                Swal.fire({
                    title: 'Signed Out',
                    text: 'You have been logged out successfully.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    }

    private updateSidebarStickyTop(): void {
        if (typeof window === 'undefined' || window.innerWidth <= 1200) {
            this.sidebarStickyTop = 0;
            return;
        }

        const bodyElement = document.querySelector<HTMLElement>('.cust-body');
        const bodyPaddingTop = bodyElement
            ? Number.parseFloat(window.getComputedStyle(bodyElement).paddingTop || '0')
            : 0;

        this.sidebarStickyTop = Number.isFinite(bodyPaddingTop) ? bodyPaddingTop : 0;
    }
}
