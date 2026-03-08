import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TransactionService } from '../../services/transaction.service';

@Component({
    selector: 'app-transactions',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './transactions.html',
    styleUrl: './transactions.scss',
})
export class Transactions implements OnInit {

    filterType = 'all'; // all, deposit, withdrawal, transfer, card
    allTransactions: any[] = [];
    isLoading = false;
    private readonly minTransactionIdLength = 8;
    private readonly transactionIdPrefix = 'EF';

    // Pagination properties
    currentPage = 1;
    maxResultCount = 10;
    totalCount = 0;

    constructor(
        private transactionService: TransactionService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadTransactions();
    }

    loadTransactions() {
        this.isLoading = true;
        this.cdr.detectChanges();

        const skipCount = (this.currentPage - 1) * this.maxResultCount;

        this.transactionService.getHistory(skipCount, this.maxResultCount).subscribe({
            next: (res) => {
                console.log('Transactions: List Response:', res);
                this.totalCount = res?.result?.totalCount ?? 0;

                const rawItems = res?.result?.items ?? [];
                const processedItems: any[] = [];

                // Track seen transactions to handle duplicates
                // Key: amount_description_time
                const seenPairs = new Set<string>();

                rawItems.forEach((t: any) => {
                    const type = this.normalizeType(t);
                    const amountValue = t.movementType === 'Debit' ? -t.amount : t.amount;
                    const date = t.creationTime;
                    const desc = t.description;

                    // Logic to handle Payout/Deposit duplicates for internal transfers
                    // These usually have the same amount (or inverse), same description, and same time
                    const dedupeKey = `${Math.abs(amountValue)}_${desc}_${date}`;

                    if (type === 'Payout' || type === 'Deposit') {
                        if (seenPairs.has(dedupeKey)) {
                            // If we've already seen this transaction as a pair, skip it
                            return;
                        }
                        seenPairs.add(dedupeKey);
                    }

                    processedItems.push({
                        id: t.id,
                        referenceId: t.referenceId,
                        type: type,
                        amount: amountValue,
                        status: 'Completed',
                        date: date,
                        description: desc,
                        cardId: t.cardId,
                        category: t.category // Keep category for internal matching if needed
                    });
                });

                this.allTransactions = processedItems;
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
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
        if (this.isDisplayReadyTransactionId(normalizedId)) {
            return normalizedId;
        }

        const compactId = normalizedId.replace(/[^A-Z0-9]/g, '');
        const hashValue = this.createTransactionIdHash(rawId);
        const hashPart = hashValue.toString(36).toUpperCase().padStart(6, '0');
        const digitPart = (hashValue % 100).toString().padStart(2, '0');

        let displayId = `${this.transactionIdPrefix}${compactId}`;

        if (!/\d/.test(displayId)) {
            displayId += digitPart;
        }

        if (displayId.length < this.minTransactionIdLength) {
            displayId += hashPart;
        }

        return displayId;
    }

    getDisplayTransactionId(transaction: any): string {
        const referenceId = this.normalizeTransactionIdValue(transaction?.referenceId);
        if (referenceId) {
            return this.formatTransactionId(referenceId);
        }

        const transactionId = this.normalizeTransactionIdValue(transaction?.id);
        if (!transactionId) {
            return '';
        }

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
        return compactId.length >= this.minTransactionIdLength
            && /[A-Z]/.test(compactId)
            && /\d/.test(compactId);
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
        if (category.includes('card')) return 'Card';
        if (category.includes('payout')) return 'Payout';

        if (transaction?.cardId) return 'Card';
        if (movementType.includes('transfer')) return 'Transfer';
        if (movementType === 'debit' && description.includes('withdraw')) return 'Withdrawal';
        if (movementType === 'credit' && description.includes('deposit')) return 'Deposit';
        if (movementType === 'debit' && (
            description.includes('easy finora card') ||
            description.includes('card payment') ||
            description.includes('wholesale purchase')
        )) {
            return 'Card';
        }

        if (!category) return 'Unknown';
        return category.charAt(0).toUpperCase() + category.slice(1);
    }
}
