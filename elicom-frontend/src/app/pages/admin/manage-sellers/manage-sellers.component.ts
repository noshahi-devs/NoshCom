import { Component, OnInit, inject, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../../services/store.service';
import { StoreDto, UpdateWithdrawPermissionInput } from '../../../services/store.service';
import { catchError, of } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-manage-sellers',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './manage-sellers.component.html',
    styleUrls: ['./manage-sellers.component.scss']
})
export class ManageSellersComponent implements OnInit, OnDestroy {
    private storeService = inject(StoreService);
    private cdr = inject(ChangeDetectorRef);

    sellers: any[] = [];
    filteredSellers: any[] = [];
    isLoading = false;
    isSaving = false;

    showDetailModal = false;
    selectedSeller: any = null;

    showWithdrawModal = false;
    withdrawInput: any = {
        storeId: '',
        withdrawLimit: 0,
        withdrawAllowedUntil: '',
        adminWithdrawRemarks: ''
    };
    withdrawError = '';

    // Search, Filter and Pagination
    searchTerm = '';
    filterMode: 'all' | 'active' | 'inactive' = 'all';
    pageSize = 10;
    currentPage = 1;
    private nowEpoch = Date.now();
    private relativeTimeTimer: any;

    ngOnInit() {
        this.loadSellers();
        this.startRelativeTicker();
    }

    ngOnDestroy() {
        if (this.relativeTimeTimer) {
            clearInterval(this.relativeTimeTimer);
        }
    }

    loadSellers() {
        this.isLoading = true;
        this.storeService.getAllStores().subscribe({
            next: (res: any) => {
                this.sellers = res?.result?.items || res?.result || res || [];
                console.log('Manage Sellers Debug:', this.sellers);
                this.applyFilters();
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading sellers:', err);
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    applyFilters() {
        const term = (this.searchTerm || '').trim().toLowerCase();
        this.filteredSellers = this.sellers.filter(s => {
            // 1. Filter by Product Count
            const productCount = s.totalProducts || 0;
            if (this.filterMode === 'active' && productCount === 0) return false;
            if (this.filterMode === 'inactive' && productCount > 0) return false;

            // 2. Filter by Search Term
            if (!term) return true;
            const haystack = [
                s.name,
                s.kyc?.fullName,
                s.supportEmail,
                s.id
            ].join(' ').toLowerCase();
            return haystack.includes(term);
        });

        this.filteredSellers.sort((a, b) => {
            const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bDate - aDate;
        });

        if (this.currentPage > this.totalPages) {
            this.currentPage = Math.max(1, this.totalPages);
        }
    }

    onSearchChange() {
        this.currentPage = 1;
        this.applyFilters();
    }

    setFilter(mode: 'all' | 'active' | 'inactive') {
        this.filterMode = mode;
        this.currentPage = 1;
        this.applyFilters();
    }

    // Pagination
    get pagedSellers(): any[] {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.filteredSellers.slice(start, start + this.pageSize);
    }

    get totalPages(): number {
        return Math.max(1, Math.ceil(this.filteredSellers.length / this.pageSize));
    }

    get showingFrom(): number {
        if (!this.filteredSellers.length) return 0;
        return (this.currentPage - 1) * this.pageSize + 1;
    }

    get showingTo(): number {
        if (!this.filteredSellers.length) return 0;
        return Math.min(this.currentPage * this.pageSize, this.filteredSellers.length);
    }

    goPrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
    }

    goNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
        }
    }

    // Relative Time Helper
    getRelativeTime(value: Date | string | null): string {
        if (!value) return '-';
        const date = value instanceof Date ? value : new Date(value);
        const diffMs = Math.max(0, this.nowEpoch - date.getTime());
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;

        if (diffMs < minute) return 'just now';
        if (diffMs < hour) {
            const mins = Math.floor(diffMs / minute);
            return `${mins} minute${mins > 1 ? 's' : ''} ago`;
        }
        if (diffMs < day) {
            const hrs = Math.floor(diffMs / hour);
            return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
        }
        if (diffMs < 30 * day) {
            const days = Math.floor(diffMs / day);
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
        const months = Math.floor(diffMs / (30 * day));
        return `${months} month${months > 1 ? 's' : ''} ago`;
    }

    private startRelativeTicker() {
        this.relativeTimeTimer = setInterval(() => {
            this.nowEpoch = Date.now();
            this.cdr.detectChanges();
        }, 60 * 1000);
    }

    toggleStatus(seller: any) {
        const newStatus = !seller.isAdminActive;
        this.storeService.toggleAdminStatus(seller.id, newStatus).subscribe({
            next: () => {
                seller.isAdminActive = newStatus;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error toggling status:', err);
            }
        });
    }

    viewDetails(seller: any) {
        this.selectedSeller = seller;
        this.showDetailModal = true;
    }

    closeDetailModal() {
        this.showDetailModal = false;
        this.selectedSeller = null;
    }

    openWithdrawModal(seller: any) {
        this.selectedSeller = seller;
        this.withdrawError = '';
        this.withdrawInput = {
            storeId: seller.id,
            withdrawLimit: seller.withdrawLimit || 0,
            withdrawAllowedUntil: seller.withdrawAllowedUntil ? seller.withdrawAllowedUntil.split('T')[0] : '',
            adminWithdrawRemarks: seller.adminWithdrawRemarks || ''
        };
        this.showWithdrawModal = true;
    }

    closeWithdrawModal() {
        this.showWithdrawModal = false;
        this.withdrawInput = {
            storeId: '',
            withdrawLimit: 0,
            withdrawAllowedUntil: '',
            adminWithdrawRemarks: ''
        };
    }

    saveWithdrawPermission() {
        if (this.isSaving) return;

        this.withdrawError = '';
        const limit = Number(this.withdrawInput.withdrawLimit);

        if (limit > 0 && this.selectedSeller && limit > (this.selectedSeller.walletBalance || 0)) {
            this.withdrawError = `Limit cannot exceed seller's current balance ($${(this.selectedSeller.walletBalance || 0).toFixed(2)}).`;
            return;
        }

        this.isSaving = true;
        this.storeService.updateWithdrawPermission(this.withdrawInput).subscribe({
            next: () => {
                if (this.selectedSeller) {
                    this.selectedSeller.withdrawLimit = this.withdrawInput.withdrawLimit;
                    this.selectedSeller.withdrawAllowedUntil = this.withdrawInput.withdrawAllowedUntil;
                    this.selectedSeller.adminWithdrawRemarks = this.withdrawInput.adminWithdrawRemarks;
                }
                this.isSaving = false;
                this.closeWithdrawModal();
                this.cdr.detectChanges();

                Swal.fire({
                    title: 'Permission Saved!',
                    text: 'Withdrawal rules updated successfully.',
                    icon: 'success',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#4f46e5'
                });
            },
            error: (err) => {
                console.error('Error saving withdrawal permission:', err);
                this.isSaving = false;
                this.cdr.detectChanges();
            }
        });
    }

    formatDate(date: any): string {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-GB');
    }
}
