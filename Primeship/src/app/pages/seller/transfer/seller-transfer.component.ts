import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';
import { WalletService } from '../../../core/services/wallet.service';
import { Router } from '@angular/router';
import { OnInit, ChangeDetectorRef } from '@angular/core';
import { TransactionService } from '../../../core/services/transaction.service';
import { DatePipe, CurrencyPipe } from '@angular/common';

@Component({
    selector: 'app-seller-transfer',
    standalone: true,
    imports: [CommonModule, FormsModule, NgIf, DatePipe, CurrencyPipe],
    templateUrl: './seller-transfer.component.html',
    styleUrl: './seller-transfer.component.scss',
})
export class SellerTransferComponent implements OnInit {

    showTransferForm = false;
    
    // Transaction History properties
    filterType = 'all';
    allTransactions: any[] = [];
    totalCount = 0;
    currentPage = 1;
    maxResultCount = 10;
    private readonly minTransactionIdLength = 8;
    private readonly transactionIdPrefix = 'EF';

    sender = '';
    recipient = '';
    amount: number | null = null;
    description = '';
    senderValid = false;
    recipientValid = false;
    recipientName = '';
    isVerifyingRecipient = false;
    isLoading = false;
    isLoadingWallet = false;
    senderWalletId = '';
    senderBalance: number | null = null;

    constructor(
        private toastService: ToastService,
        private walletService: WalletService,
        private transactionService: TransactionService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadMyWallet();
        this.loadTransactions();
    }

    loadMyWallet() {
        this.isLoadingWallet = true;
        this.walletService.getMyWallet().subscribe({
            next: (res) => {
                const walletId = res?.result?.displayWalletId || res?.result?.walletId || res?.result?.id;
                this.senderWalletId = walletId || '';
                this.sender = this.senderWalletId;
                this.senderValid = !!this.senderWalletId;
                if (typeof res?.result?.balance === 'number') {
                    this.senderBalance = res.result.balance;
                }
                this.isLoadingWallet = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Transfer: Load wallet error:', err);
                this.isLoadingWallet = false;
                this.cdr.detectChanges();
            }
        });
    }

    validateSender() {
        const input = (this.sender || '').trim();
        if (!input) {
            this.senderValid = false;
            return;
        }

        this.senderValid = this.senderWalletId.length > 0 && input.toLowerCase() === this.senderWalletId.toLowerCase();

        this.cdr.detectChanges();
    }

    validateRecipient() {
        const val = (this.recipient || '').trim();
        this.recipientName = '';

        if (!val) {
            this.recipientValid = false;
            return;
        }

        this.recipientValid = true;
        this.cdr.detectChanges();
    }

    verifyRecipient() {
        if (!this.recipientValid) {
            this.toastService.showError('Please enter recipient wallet ID.');
            return;
        }

        this.isVerifyingRecipient = true;
        const sub = this.walletService.verifyWalletId(this.recipient.trim()).subscribe({
            next: (res) => {
                this.recipientName = res?.result?.fullName || '';
                if (!this.recipientName) {
                    this.toastService.showError('Wallet ID not found.');
                    this.recipientValid = false;
                }
            },
            error: (err) => {
                console.error('Verify wallet error:', err);
                this.toastService.showError(err.error?.error?.message || 'Wallet ID not found.');
                this.recipientName = '';
                this.recipientValid = false;
            }
        });
        sub.add(() => {
            this.isVerifyingRecipient = false;
            this.cdr.detectChanges();
        });
    }

    submitTransfer() {
        // Validation
        if (!this.sender) {
            this.toastService.showError('Sender wallet ID is missing');
            return;
        }

        if (!this.senderValid) {
            this.toastService.showError('Sender wallet ID is invalid');
            return;
        }

        if (!this.recipient) {
            this.toastService.showError('Please enter recipient wallet ID');
            return;
        }

        if (!this.recipientValid) {
            this.toastService.showError('Please enter recipient wallet ID');
            return;
        }

        if (!this.amount || this.amount <= 0) {
            this.toastService.showError('Please enter a valid amount greater than 0');
            return;
        }

        this.isLoading = true;

        const input: any = {
            amount: this.amount,
            description: this.description
        };

        input.recipientWalletId = this.recipient.trim();

        this.walletService.transfer(input).subscribe({
            next: (res) => {
                console.log('Transfer: Success response:', res);
                const recipientLabel = this.recipientName || this.recipient;
                this.toastService.showSuccess(`Transfer of $${this.amount} to ${recipientLabel} was successful!`);
                this.isLoading = false;
                this.router.navigate(['/seller/wallet']);
            },
            error: (err) => {
                console.error('Transfer error:', err);
                const backendMsg = err.error?.error?.message;
                this.toastService.showError(backendMsg || 'Transfer failed. Check your balance or recipient details.');
                this.isLoading = false;
            }
        });
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
        const normalizedType = (transaction?.type || '').toString().trim().toLowerCase();
        return normalizedType === filter.toLowerCase();
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
