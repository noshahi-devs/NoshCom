import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor, CurrencyPipe, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { WithdrawService } from '../../../core/services/withdraw.service';
import { WalletService } from '../../../core/services/wallet.service';
import { DatePipe } from '@angular/common';

interface WithdrawHistoryRow {
    id: string;
    referenceId?: string;
    type: string;
    amount: number;
    status: string;
    date: string;
    transactionNumber: string;
    method?: string;
}

@Component({
    selector: 'app-seller-withdraw',
    imports: [FormsModule, CommonModule, DatePipe, CurrencyPipe],
    templateUrl: './seller-withdraw.component.html',
    styleUrl: './seller-withdraw.component.scss',
})
export class SellerWithdrawComponent implements OnInit {

    showWithdrawForm = false;
    
    filterType = 'all';
    allWithdrawRows: WithdrawHistoryRow[] = [];
    currentPage = 1;
    maxResultCount = 10;
    private readonly minTransactionIdLength = 8;
    private readonly transactionIdPrefix = 'EF';

    amount: number | null = null;
    isLoading = false;
    walletBalance: number | null = null;
    withdrawMethod: 'bank' | 'crypto' = 'bank';
    exchangeRates: any = {};

    // Editable bank account details
    bankDetails = {
        bankName: '',
        accountTitle: '',
        accountNumber: '',
        iban: ''
    };

    // Crypto details
    cryptoDetails = {
        cryptoId: '',
        cryptoTitle: ''
    };

    constructor(
        private toastService: ToastService,
        private withdrawService: WithdrawService,
        private walletService: WalletService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadWalletBalance();
        this.fetchExchangeRates();
        this.loadWithdrawHistory();
    }



    fetchExchangeRates() {
        fetch('https://open.er-api.com/v6/latest/USD')
            .then(res => res.json())
            .then(data => {
                this.exchangeRates = data.rates;
                this.cdr.detectChanges();
            })
            .catch(err => console.error('Withdraw: Fetch Rates Error:', err));
    }

    loadWalletBalance() {
        this.walletService.getMyWallet().subscribe({
            next: (res) => {
                const balance = res?.result?.balance;
                if (typeof balance === 'number') {
                    this.walletBalance = balance;
                }
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Withdraw: Wallet Balance Error:', err);
            }
        });
    }

    getWalletBalanceDisplay(): number {
        return typeof this.walletBalance === 'number' ? this.walletBalance : 0;
    }

    submitWithdraw() {
        // Validation
        if (!this.amount || this.amount <= 0) {
            this.toastService.showError('Please enter a valid amount greater than 0');
            return;
        }

        if (this.amount < 10) {
            this.toastService.showError('Minimum withdrawal amount is $10');
            return;
        }

        if (this.withdrawMethod === 'bank') {
            if (!this.bankDetails.bankName || !this.bankDetails.accountNumber) {
                this.toastService.showError('Please provide bank name and account number');
                return;
            }
        }

        if (this.withdrawMethod === 'crypto') {
            if (!this.cryptoDetails.cryptoId || !this.cryptoDetails.cryptoTitle) {
                this.toastService.showError('Please provide crypto ID and crypto title');
                return;
            }
        }



        this.isLoading = true;
        this.cdr.detectChanges();

        const paymentDetails = this.withdrawMethod === 'bank'
            ? (this.bankDetails.accountNumber || '').trim()
            : (this.cryptoDetails.cryptoId || '').trim();

        const input = {
            cardId: 0,
            amount: this.amount,
            method: this.withdrawMethod === 'bank' ? 'Bank Transfer' : 'Crypto',
            paymentDetails: paymentDetails,
            localAmount: this.calculateLocalAmount(),
            localCurrency: 'PKR'
        };

        console.log('Withdraw: Submit Payload:', input);

        this.withdrawService.submitWithdrawRequest(input).subscribe({
            next: (res) => {
                console.log('Withdraw: Submit Response:', res);
                this.toastService.showSuccess(`Your withdrawal request for $${input.amount} has been submitted successfully.`);
                this.resetForm();
                this.showWithdrawForm = false;
                this.currentPage = 1;
                this.loadWithdrawHistory();
                this.loadWalletBalance();
            },
            error: (err) => {
                console.error('Withdraw: Submit Error:', err);
                const msg = err.error?.error?.message
                    || err.error?.message
                    || (err.status === 404 ? 'Withdrawal service unavailable. Restart the backend and try again.' : 'Failed to submit withdrawal request');
                this.toastService.showError(msg);
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    calculateLocalAmount(): number {
        const rate = this.exchangeRates['PKR'] || 280; // Fallback to 280 if fetch fails
        return Math.round((this.getNetAmount() || 0) * rate);
    }

    getServiceFee(): number {
        if (!this.amount) return 0;
        return Number((this.amount * 0.03).toFixed(2));
    }

    getNetAmount(): number {
        if (!this.amount) return 0;
        return Number((this.amount - this.getServiceFee()).toFixed(2));
    }

    resetForm() {
        this.amount = null;
        this.bankDetails = {
            bankName: '',
            accountTitle: '',
            accountNumber: '',
            iban: ''
        };
        this.isLoading = false;
    }
    toggleWithdrawView() {
        this.showWithdrawForm = !this.showWithdrawForm;
        if (!this.showWithdrawForm) {
            this.currentPage = 1;
            this.loadWithdrawHistory();
            this.loadWalletBalance();
        }
    }

    loadWithdrawHistory() {
        this.isLoading = true;
        this.cdr.detectChanges();

        this.withdrawService.getMyWithdrawRequests(0, 500).subscribe({
            next: (res: any) => {
                const rawItems = res?.result?.items ?? [];
                this.allWithdrawRows = rawItems.map((w: any) => this.mapWithdrawRow(w));
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err: any) => {
                console.error('Withdraw history load error:', err);
                this.allWithdrawRows = [];
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    private mapWithdrawRow(w: any): WithdrawHistoryRow {
        const method = (w.method || 'Bank').toString();
        const status = (w.status || 'Pending').toString();
        const paymentDetails = (w.paymentDetails || '').toString().trim();

        return {
            id: w.id?.toString() ?? '',
            referenceId: w.id?.toString(),
            type: 'Withdrawal',
            amount: -Math.abs(Number(w.amount) || 0),
            status,
            date: w.creationTime,
            transactionNumber: this.extractTransactionNumber(paymentDetails, method),
            method
        };
    }

    private extractTransactionNumber(paymentDetails: string, method: string): string {
        const raw = (paymentDetails || '').trim();
        if (!raw) return '—';

        const cryptoIdMatch = raw.match(/CryptoId:\s*([^,]+)/i);
        if (cryptoIdMatch?.[1]) return cryptoIdMatch[1].trim();

        const accMatch = raw.match(/Acc:\s*([^,]+)/i);
        if (accMatch?.[1]) return accMatch[1].trim();

        const ibanMatch = raw.match(/IBAN:\s*([^,]+)/i);
        if (ibanMatch?.[1] && method.toLowerCase().includes('bank')) {
            return ibanMatch[1].trim();
        }

        if (!raw.includes(':') && !raw.includes(',')) {
            return raw;
        }

        return raw.split(',')[0].trim() || '—';
    }

    changePage(page: number) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.cdr.detectChanges();
        }
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

    get totalCount(): number {
        return this.filteredWithdrawals.length;
    }

    get filteredWithdrawals(): WithdrawHistoryRow[] {
        if (this.filterType === 'all') return this.allWithdrawRows;
        return this.allWithdrawRows.filter(t => this.matchesFilter(t, this.filterType));
    }

    get paginatedWithdrawals(): WithdrawHistoryRow[] {
        const start = (this.currentPage - 1) * this.maxResultCount;
        return this.filteredWithdrawals.slice(start, start + this.maxResultCount);
    }

    get skeletonRows(): number[] {
        return Array.from({ length: this.maxResultCount }, (_, index) => index);
    }

    setFilter(type: string) {
        this.filterType = type;
        this.currentPage = 1;
        this.cdr.detectChanges();
    }

    private matchesFilter(transaction: any, filter: string): boolean {
        const status = (transaction?.status || '').toString().trim().toLowerCase();
        return status === filter.toLowerCase();
    }

    formatTransactionId(id: any): string {
        const rawId = this.normalizeTransactionIdValue(id);
        if (!rawId) return '';
        const normalizedId = rawId.toUpperCase();
        if (this.isDisplayReadyTransactionId(normalizedId)) return normalizedId;

        const compactId = normalizedId.replace(/[^A-Z0-9]/g, '');
        const hashValue = this.createTransactionIdHash(rawId);
        const hashPart = hashValue.toString(36).toUpperCase().padStart(6, '0');
        const digitPart = (hashValue % 100).toString().padStart(2, '0');

        let displayId = `${this.transactionIdPrefix}${compactId}`;
        if (!/\d/.test(displayId)) displayId += digitPart;
        if (displayId.length < this.minTransactionIdLength) displayId += hashPart;
        return displayId;
    }

    getDisplayTransactionId(row: WithdrawHistoryRow): string {
        const referenceId = this.normalizeTransactionIdValue(row?.referenceId);
        if (referenceId) return this.formatTransactionId(referenceId);
        const transactionId = this.normalizeTransactionIdValue(row?.id);
        if (!transactionId) return '';
        return this.formatTransactionId(transactionId);
    }

    getTransactionIdTooltip(row: WithdrawHistoryRow): string {
        const referenceId = this.normalizeTransactionIdValue(row?.referenceId);
        const transactionId = this.normalizeTransactionIdValue(row?.id);
        if (referenceId && transactionId && referenceId !== transactionId) {
            return `Request: ${transactionId}`;
        }
        return referenceId || transactionId || '';
    }

    private normalizeTransactionIdValue(value: any): string {
        return (value ?? '').toString().trim();
    }

    private isDisplayReadyTransactionId(value: string): boolean {
        const compactId = value.replace(/[^A-Z0-9]/g, '');
        return compactId.length >= this.minTransactionIdLength && /[A-Z]/.test(compactId) && /\d/.test(compactId);
    }

    private createTransactionIdHash(value: string): number {
        let hash = 0;
        for (const char of value) {
            hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
        }
        return hash || 1;
    }

}
