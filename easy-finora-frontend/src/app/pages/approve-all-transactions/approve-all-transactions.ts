import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { TransactionService } from '../../services/transaction.service';
import { Loader } from '../../shared/loader/loader';

@Component({
    selector: 'app-approve-all-transactions',
    standalone: true,
    imports: [CommonModule, DatePipe, CurrencyPipe, Loader],
    templateUrl: './approve-all-transactions.html',
    styleUrl: './approve-all-transactions.scss',
})
export class ApproveAllTransactions implements OnInit {

    transactions: any[] = [];
    isLoading = false;

    // Pagination properties
    currentPage = 1;
    maxResultCount = 10;
    totalCount = 0;

    constructor(private transactionService: TransactionService) { }

    ngOnInit() {
        this.fetchTransactions();
    }

    fetchTransactions() {
        this.isLoading = true;

        const skipCount = (this.currentPage - 1) * this.maxResultCount;

        this.transactionService.getAllTransactions(skipCount, this.maxResultCount).subscribe({
            next: (res: any) => {
                this.transactions = res?.result?.items ?? [];
                this.totalCount = res?.result?.totalCount ?? 0;
                this.isLoading = false;
            },
            error: (err: any) => {
                console.error('Failed to fetch all transactions', err);
                this.isLoading = false;
            }
        });
    }

    changePage(page: number) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.fetchTransactions();
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
}
