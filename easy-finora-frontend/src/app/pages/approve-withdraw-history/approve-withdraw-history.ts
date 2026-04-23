import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WithdrawService } from '../../services/withdraw.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Loader } from '../../shared/loader/loader';

@Component({
    selector: 'app-approve-withdraw-history',
    standalone: true,
    imports: [CommonModule, DatePipe, CurrencyPipe, DecimalPipe, FormsModule, Loader],
    templateUrl: './approve-withdraw-history.html',
    styleUrl: './approve-withdraw-history.scss',
})
export class ApproveWithdrawHistory implements OnInit {

    allWithdrawals: any[] = [];
    filteredWithdrawals: any[] = [];
    withdrawals: any[] = [];
    isLoading = false;
    isApproving = false;
    isRejecting = false;
    showModal = false;
    selectedWithdraw: any = null;
    proofFile: File | null = null;
    adminRemarks: string = ''; // Changed from 'Processed'
    exchangeRates: any = {};

    // Pagination properties
    currentPage = 1;
    maxResultCount = 10;
    totalCount = 0;
    statusFilter: 'all' | 'pending' | 'approved' | 'rejected' = 'all';

    constructor(
        private withdrawService: WithdrawService,
        private toastService: ToastService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.fetchHistory();
        this.fetchExchangeRates();
    }

    fetchExchangeRates() {
        fetch('https://open.er-api.com/v6/latest/USD')
            .then(res => res.json())
            .then(data => {
                this.exchangeRates = data.rates;
                this.cdr.detectChanges();
            })
            .catch(() => { });
    }

    calculateCurrentPkr(usdAmount: number): number {
        const rate = this.exchangeRates['PKR'] || 280;
        return Math.round(usdAmount * rate);
    }

    fetchHistory() {
        this.isLoading = true;
        this.cdr.detectChanges();

        // Load a wide slice once and paginate/filter locally for fast admin UX.
        this.withdrawService.getAllWithdrawRequests(0, 1000).subscribe({
            next: (res: any) => {
                // Handle both direct array and paged response structures
                if (Array.isArray(res?.result)) {
                    this.allWithdrawals = res.result;
                } else {
                    this.allWithdrawals = res?.result?.items ?? [];
                }

                this.applyFilterAndPagination();
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    changePage(page: number) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.applyFilterAndPagination();
        }
    }

    setStatusFilter(filter: 'all' | 'pending' | 'approved' | 'rejected') {
        this.statusFilter = filter;
        this.currentPage = 1;
        this.applyFilterAndPagination();
    }

    private applyFilterAndPagination(): void {
        this.filteredWithdrawals = this.allWithdrawals.filter((withdrawal) => this.matchesStatus(withdrawal?.status));
        this.totalCount = this.filteredWithdrawals.length;
        const totalPages = this.totalPages;
        if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        }
        if (this.currentPage < 1) {
            this.currentPage = 1;
        }

        const startIndex = (this.currentPage - 1) * this.maxResultCount;
        const endIndex = startIndex + this.maxResultCount;
        this.withdrawals = this.filteredWithdrawals.slice(startIndex, endIndex);
    }

    get totalPages(): number {
        return Math.ceil(this.totalCount / this.maxResultCount) || 1;
    }

    getPageNumbers(): number[] {
        const pageNumbers: number[] = [];
        const maxPagesToShow = 5;
        let startPage = Math.max(1, this.currentPage - 2);
        let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);

        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pageNumbers.push(i);
        }
        return pageNumbers;
    }

    getStartIndex(): number {
        return this.totalCount === 0 ? 0 : (this.currentPage - 1) * this.maxResultCount + 1;
    }

    getEndIndex(): number {
        return Math.min(this.currentPage * this.maxResultCount, this.totalCount);
    }

    private matchesStatus(status: unknown): boolean {
        if (this.statusFilter === 'all') return true;
        return this.normalizeStatus(status) === this.statusFilter;
    }

    private normalizeStatus(status: unknown): 'pending' | 'approved' | 'rejected' | '' {
        const normalized = String(status ?? '').trim().toLowerCase();
        if (normalized === 'reject') return 'rejected';
        if (normalized === 'pending' || normalized === 'approved' || normalized === 'rejected') {
            return normalized;
        }
        return '';
    }

    viewDetails(withdraw: any) {
        this.selectedWithdraw = withdraw;
        this.showModal = true;
        this.adminRemarks = 'Processed';
        this.proofFile = null;
    }

    viewProof(withdraw: any) {
        if (withdraw.paymentProof) {
            this.viewDetails(withdraw);
            return;
        }

        if (!withdraw.hasProof) return;

        this.isLoading = true;
        this.withdrawService.getPaymentProof(withdraw.id).subscribe({
            next: (res: any) => {
                withdraw.paymentProof = res.result;
                this.isLoading = false;
                this.viewDetails(withdraw);
                this.cdr.detectChanges();
            },
            error: () => {
                this.isLoading = false;
                this.toastService.showError('Failed to load payment proof', 'Error');
                this.cdr.detectChanges();
            }
        });
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.proofFile = file;
        }
    }

    getBankDetails(details: string) {
        if (!details) return { bank: '', title: '', account: '', iban: '' };

        const segments = details
            .split(/[,;\n]+/)
            .map(part => part.trim())
            .filter(Boolean);

        const fields = new Map<string, string>();
        for (const segment of segments) {
            const colonIndex = segment.indexOf(':');
            if (colonIndex === -1) continue;

            const key = segment.slice(0, colonIndex).trim().toLowerCase();
            const value = segment.slice(colonIndex + 1).trim();
            if (key && value) {
                fields.set(key, value);
            }
        }

        const getField = (...labels: string[]) => {
            for (const label of labels) {
                const normalized = label.toLowerCase();
                for (const [key, value] of fields.entries()) {
                    if (key === normalized || key.startsWith(normalized)) {
                        return value;
                    }
                }
            }

            for (const label of labels) {
                const regex = new RegExp(`${label}\\s*[:\\-]\\s*([^,;\\n]*)`, 'i');
                const match = details.match(regex);
                if (match?.[1]) return match[1].trim();
            }

            return '';
        };

        return {
            bank: getField('Bank', 'Bank Name'),
            title: getField('Title', 'Account Title', 'A/C Title', 'Account Holder'),
            account: getField('Acc', 'Account', 'Account Number', 'A/C', 'Acct'),
            iban: getField('IBAN', 'IBAN Number', 'IBAN No', 'International Bank Account Number')
        };
    }

    copyToClipboard(text: string) {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
        }).catch(() => {
        });
    }

    async approve(withdraw: any) {
        let base64Proof = '';
        if (this.proofFile) {
            base64Proof = await this.toBase64(this.proofFile);
        }

        this.isApproving = true;
        this.isLoading = true;
        this.withdrawService.approveWithdraw(withdraw.id, this.adminRemarks, base64Proof).subscribe({
            next: () => {
                this.toastService.showModal('Withdrawal request has been approved successfully. The user\'s card balance has been updated.', 'WITHDRAWAL APPROVED', 'success');
                this.showModal = false;
                this.fetchHistory();
                this.isApproving = false;
                this.isLoading = false;
                window.scrollTo({ top: 0, behavior: 'smooth' });
            },
            error: (err) => {
                this.toastService.showModal(err.error?.error?.message || 'Failed to approve withdrawal.', 'ERROR', 'error');
                this.isApproving = false;
                this.isLoading = false;
            }
        });
    }

    private toBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    }

    reject(withdraw: any) {
        const remarks = prompt('Enter reason for rejection:', 'Insufficient info');
        if (remarks === null) return;

        this.isRejecting = true;
        this.isLoading = true;
        this.withdrawService.rejectWithdraw(withdraw.id, remarks).subscribe({
            next: () => {
                this.toastService.showModal('Withdrawal request has been rejected.', 'WITHDRAWAL REJECTED', 'info');
                this.showModal = false;
                this.fetchHistory();
                this.isRejecting = false;
                this.isLoading = false;
                window.scrollTo({ top: 0, behavior: 'smooth' });
            },
            error: (err) => {
                console.error('Failed to reject withdrawal', err);
                this.toastService.showModal(err.error?.error?.message || 'Failed to reject withdrawal.', 'ERROR', 'error');
                this.isRejecting = false;
                this.isLoading = false;
            }
        });
    }
}
