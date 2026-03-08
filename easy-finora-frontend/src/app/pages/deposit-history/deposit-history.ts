import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgFor, DatePipe, CurrencyPipe, NgIf, SlicePipe, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DepositService } from '../../services/deposit.service';

@Component({
    selector: 'app-deposit-history',
    standalone: true,
    imports: [CommonModule, RouterLink], // CommonModule includes DatePipe, CurrencyPipe, NgIf, NgFor, SlicePipe
    templateUrl: './deposit-history.html',
    styleUrl: './deposit-history.scss',
})
export class DepositHistory implements OnInit {

    deposits: any[] = [];
    isLoading = false;

    // Pagination properties
    currentPage = 1;
    maxResultCount = 10;
    totalCount = 0;

    constructor(
        private depositService: DepositService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.fetchHistory();
    }

    fetchHistory() {
        this.isLoading = true;
        this.cdr.detectChanges();

        const skipCount = (this.currentPage - 1) * this.maxResultCount;

        this.depositService.getMyDepositRequests(skipCount, this.maxResultCount).subscribe({
            next: (res: any) => {
                this.deposits = res?.result?.items ?? [];
                this.totalCount = res?.result?.totalCount ?? 0;
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Failed to load deposit history', err);
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    changePage(page: number) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.fetchHistory();
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
