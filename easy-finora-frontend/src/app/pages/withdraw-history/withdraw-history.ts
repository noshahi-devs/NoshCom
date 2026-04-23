import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgFor, DatePipe, CurrencyPipe, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WithdrawService } from '../../services/withdraw.service';
import { Loader } from '../../shared/loader/loader';

@Component({
    selector: 'app-withdraw-history',
    standalone: true,
    imports: [CommonModule, RouterLink, Loader],
    templateUrl: './withdraw-history.html',
    styleUrl: './withdraw-history.scss',
})
export class WithdrawHistory implements OnInit {

    withdrawals: any[] = [];
    isLoading = false;
    showModal = false;
    selectedWithdraw: any = null;

    // Pagination properties
    currentPage = 1;
    maxResultCount = 10;
    totalCount = 0;

    constructor(
        private withdrawService: WithdrawService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.fetchHistory();
    }

    viewDetails(withdraw: any) {
        this.selectedWithdraw = withdraw;
        this.showModal = true;
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
            // Optional: toast feedback
        }).catch(err => {
            console.error('Copy failed', err);
        });
    }

    fetchHistory() {
        this.isLoading = true;
        this.cdr.detectChanges();

        const skipCount = (this.currentPage - 1) * this.maxResultCount;

        this.withdrawService.getMyWithdrawRequests(skipCount, this.maxResultCount).subscribe({
            next: (res: any) => {
                // Handle both direct array and paged response structures
                if (Array.isArray(res?.result)) {
                    this.withdrawals = res.result;
                    this.totalCount = res.result.length;
                } else {
                    this.withdrawals = res?.result?.items ?? [];
                    this.totalCount = res?.result?.totalCount ?? 0;
                }

                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Failed to load withdraw history', err);
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
