import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor, CurrencyPipe, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { WithdrawService } from '../../../core/services/withdraw.service';
import { WalletService } from '../../../core/services/wallet.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { DatePipe } from '@angular/common';

@Component({
    selector: 'app-seller-withdraw',
    imports: [FormsModule, CommonModule, DatePipe, CurrencyPipe],
    templateUrl: './seller-withdraw.component.html',
    styleUrl: './seller-withdraw.component.scss',
})
export class SellerWithdrawComponent implements OnInit {

    showWithdrawForm = false;
    
    // Transaction History properties
    filterType = 'all'; // Default to all
    allTransactions: any[] = [];
    totalCount = 0;
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
        private transactionService: TransactionService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadWalletBalance();
        this.fetchExchangeRates();
        this.loadTransactions();
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
            ? `Bank: ${this.bankDetails.bankName}, Title: ${this.bankDetails.accountTitle}, Acc: ${this.bankDetails.accountNumber}, IBAN: ${this.bankDetails.iban}`
            : `CryptoId: ${this.cryptoDetails.cryptoId}, CryptoTitle: ${this.cryptoDetails.cryptoTitle}`;

        const input = {
            amount: this.amount,
            method: this.withdrawMethod === 'bank' ? 'Bank Transfer' : 'Crypto',
            paymentDetails: paymentDetails,
            localAmount: this.calculateLocalAmount(),
            localCurrency: 'PKR' // Defaulting to PKR for user's request context
        };

        console.log('Withdraw: Submit Payload:', input);

        this.withdrawService.submitWithdrawRequest(input).subscribe({
            next: (res) => {
                console.log('Withdraw: Submit Response:', res);
                this.toastService.showSuccess(`Your withdrawal request for $${input.amount} has been submitted successfully.`);
                this.resetForm();
                this.router.navigate(['/seller/wallet']);
            },
            error: (err) => {
                console.error('Withdraw: Submit Error:', err);
                this.toastService.showError(err.error?.error?.message || 'Failed to submit withdrawal request');
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
    // Transaction History methods
    loadTransactions() {
        this.isLoading = true;
        this.cdr.detectChanges();

        const skipCount = (this.currentPage - 1) * this.maxResultCount;

        this.transactionService.getHistory(skipCount, this.maxResultCount).subscribe({
            next: (res: any) => {
                this.totalCount = res?.result?.totalCount ?? 0;
                const rawItems = res?.result?.items ?? [];
                const processedItems: any[] = [];
                const seenPairs = new Set<string>();

                rawItems.forEach((t: any) => {
                    const type = this.normalizeType(t);
                    const amountValue = t.movementType === 'Debit' ? -t.amount : t.amount;
                    const date = t.creationTime;
                    const desc = t.description;
                    const dedupeKey = `${Math.abs(amountValue)}_${desc}_${date}`;

                    if (type === 'Payout' || type === 'Deposit') {
                        if (seenPairs.has(dedupeKey)) return;
                        seenPairs.add(dedupeKey);
                    }

                    processedItems.push({
                        id: t.id,
                        referenceId: t.referenceId,
                        type: type,
                        amount: amountValue,
                        status: t.status || 'Approved',
                        date: date,
                        description: desc,
                        cardId: t.cardId,
                        category: t.category
                    });
                });

                this.allTransactions = processedItems;
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err: any) => {
                console.error('Transactions: List Error:', err);
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    changePage(page: number) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.loadTransactions();
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

    get filteredTransactions() {
        if (this.filterType === 'all') return this.allTransactions;
        return this.allTransactions.filter(t => this.matchesFilter(t, this.filterType));
    }

    get skeletonRows(): number[] {
        return Array.from({ length: this.maxResultCount }, (_, index) => index);
    }

    setFilter(type: string) {
        this.filterType = type;
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

    getDisplayTransactionId(transaction: any): string {
        const referenceId = this.normalizeTransactionIdValue(transaction?.referenceId);
        if (referenceId) return this.formatTransactionId(referenceId);
        const transactionId = this.normalizeTransactionIdValue(transaction?.id);
        if (!transactionId) return '';
        return this.formatTransactionId(transactionId);
    }

    getTransactionIdTooltip(transaction: any): string {
        const referenceId = this.normalizeTransactionIdValue(transaction?.referenceId);
        const transactionId = this.normalizeTransactionIdValue(transaction?.id);
        if (referenceId && transactionId && referenceId !== transactionId) {
            return `Reference: ${referenceId}\nInternal: ${transactionId}`;
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

    private normalizeType(transaction: any): string {
        const category = (transaction?.category || '').toString().trim().toLowerCase();
        const description = (transaction?.description || '').toString().toLowerCase();
        const movementType = (transaction?.movementType || '').toString().toLowerCase();

        if (category.includes('deposit')) return 'Deposit';
        if (category.includes('withdraw')) return 'Withdrawal';
        if (category.includes('transfer')) return 'Transfer';
        if (category.includes('payout')) return 'Payout';
        if (movementType.includes('transfer')) return 'Transfer';
        if (movementType === 'debit' && description.includes('withdraw')) return 'Withdrawal';
        if (movementType === 'credit' && description.includes('deposit')) return 'Deposit';
        if (!category) return 'Unknown';
        return category.charAt(0).toUpperCase() + category.slice(1);
    }
}
