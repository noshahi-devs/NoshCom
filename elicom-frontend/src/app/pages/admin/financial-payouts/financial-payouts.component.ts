import { Component, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WithdrawalService, WithdrawRequestDto } from '../../../services/withdrawal.service';
import { AlertService } from '../../../services/alert.service';
import { Router } from '@angular/router';

interface WithdrawalRequest {
    id: string;
    sellerName: string;
    amount: number;
    method: string;
    accountDetails: string;
    status: 'pending' | 'approved' | 'rejected';
    requestDate: Date;
}

@Component({
    selector: 'app-financial-payouts',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './financial-payouts.component.html',
    styleUrls: ['./financial-payouts.component.scss']
})
export class FinancialPayoutsComponent implements OnInit, OnDestroy {
    private withdrawalService = inject(WithdrawalService);
    private alert = inject(AlertService);
    private cdr = inject(ChangeDetectorRef);
    private router = inject(Router);

    requests: WithdrawalRequest[] = [];
    filteredRequests: WithdrawalRequest[] = [];

    totalPendingVolume = 0;
    showReviewModal = false;
    selectedRequest: WithdrawalRequest | null = null;
    reviewComment: string = '';
    isLoading = false;
    isApproving = false;
    isRejecting = false;

    // Search and Pagination
    searchTerm = '';
    pageSize = 10;
    currentPage = 1;
    private nowEpoch = Date.now();
    private relativeTimeTimer: any;

    ngOnInit() {
        this.loadRequests();
        this.startRelativeTicker();
    }

    ngOnDestroy() {
        if (this.relativeTimeTimer) {
            clearInterval(this.relativeTimeTimer);
        }
    }

    loadRequests() {
        this.isLoading = true;
        this.withdrawalService.getAllWithdrawRequests().subscribe({
            next: (res: WithdrawRequestDto[]) => {
                this.requests = res.map(r => ({
                    id: r.id,
                    sellerName: r.userName || `User #${r.userId ?? ''}`,
                    amount: r.amount,
                    method: r.method || 'N/A',
                    accountDetails: r.paymentDetails || 'N/A',
                    status: (r.status || 'pending').toLowerCase() as 'pending' | 'approved' | 'rejected',
                    requestDate: new Date(r.creationTime)
                }));
                this.calculateStats();
                this.applyFilters();
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.isLoading = false;
                this.alert.error('Failed to load withdrawal requests.');
                this.cdr.detectChanges();
            }
        });
    }

    calculateStats() {
        this.totalPendingVolume = this.requests
            .filter(r => r.status === 'pending')
            .reduce((acc, curr) => acc + curr.amount, 0);
    }

    applyFilters() {
        const term = (this.searchTerm || '').trim().toLowerCase();
        this.filteredRequests = this.requests.filter(r => {
            if (!term) return true;
            const haystack = [
                r.id,
                r.sellerName,
                r.method,
                r.status,
                r.accountDetails
            ].join(' ').toLowerCase();
            return haystack.includes(term);
        });

        this.filteredRequests.sort((a, b) => b.requestDate.getTime() - a.requestDate.getTime());

        if (this.currentPage > this.totalPages) {
            this.currentPage = Math.max(1, this.totalPages);
        }
    }

    onSearchChange() {
        this.currentPage = 1;
        this.applyFilters();
    }

    // Pagination
    get pagedRequests(): WithdrawalRequest[] {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.filteredRequests.slice(start, start + this.pageSize);
    }

    get totalPages(): number {
        return Math.max(1, Math.ceil(this.filteredRequests.length / this.pageSize));
    }

    get showingFrom(): number {
        if (!this.filteredRequests.length) return 0;
        return (this.currentPage - 1) * this.pageSize + 1;
    }

    get showingTo(): number {
        if (!this.filteredRequests.length) return 0;
        return Math.min(this.currentPage * this.pageSize, this.filteredRequests.length);
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

    // Date Helpers
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

    formatDate(value: Date | null): string {
        if (!value) return '-';
        return value.toLocaleDateString('en-GB');
    }

    formatTime(value: Date | null): string {
        if (!value) return '-';
        return value.toLocaleTimeString('en-US', { hour12: false });
    }

    private startRelativeTicker() {
        this.relativeTimeTimer = setInterval(() => {
            this.nowEpoch = Date.now();
            this.cdr.detectChanges();
        }, 60 * 1000);
    }

    openReviewModal(req: WithdrawalRequest) {
        this.selectedRequest = req;
        this.reviewComment = '';
        this.showReviewModal = true;
    }

    closeReviewModal() {
        this.showReviewModal = false;
        this.selectedRequest = null;
    }

    approvePayout() {
        if (!this.selectedRequest || this.isApproving || this.isRejecting) return;
        this.isApproving = true;
        this.withdrawalService.approveWithdraw(Number(this.selectedRequest.id), this.reviewComment).subscribe({
            next: () => {
                this.closeReviewModal();
                this.isApproving = false;
                this.alert.success('Payout approved.');
                this.loadRequests();
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.isApproving = false;
                this.alert.error(err?.error?.error?.message || 'Approval failed.');
            }
        });
    }

    rejectPayout() {
        if (!this.selectedRequest || this.isApproving || this.isRejecting) return;
        this.isRejecting = true;
        this.withdrawalService.rejectWithdraw(Number(this.selectedRequest.id), this.reviewComment).subscribe({
            next: () => {
                this.closeReviewModal();
                this.isRejecting = false;
                this.alert.success('Payout rejected.');
                this.loadRequests();
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.isRejecting = false;
                this.alert.error(err?.error?.error?.message || 'Rejection failed.');
            }
        });
    }

    displaySellerName(value: string) {
        if (!value) return 'Seller';
        const trimmed = value.trim();
        if (trimmed.includes('@')) {
            const local = trimmed.split('@')[0] || trimmed;
            return local
                .replace(/[._-]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/\b\w/g, c => c.toUpperCase());
        }
        return trimmed;
    }
}
