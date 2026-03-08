import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { TransactionService } from '../../services/transaction.service';
import { UserService } from '../../services/user.service';
import { DepositService } from '../../services/deposit.service';
import { WithdrawService } from '../../services/withdraw.service';
import { SupportService } from '../../services/support.service';
import { AdminDashboardService } from '../../services/admin-dashboard.service';

type DashboardListResult<T> = {
    result?: {
        items?: T[];
        totalCount?: number;
    } | T[];
};

type AdminDashboardStatsResult = {
    result?: {
        totalUsers?: number;
        pendingDeposits?: number;
        pendingWithdrawals?: number;
        openTickets?: number;
        totalTransactionVolume?: number;
    };
};

interface DashboardStats {
    totalUsers: number;
    pendingDeposits: number;
    pendingWithdrawals: number;
    openTickets: number;
    totalTransactionVolume: number;
}

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './admin-dashboard.html',
    styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard implements OnInit, OnDestroy {

    stats: DashboardStats = {
        totalUsers: 0,
        pendingDeposits: 0,
        pendingWithdrawals: 0,
        openTickets: 0,
        totalTransactionVolume: 0
    };

    isLoading = true;
    private loadingFailSafeTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private readonly transactionService: TransactionService,
        private readonly userService: UserService,
        private readonly depositService: DepositService,
        private readonly withdrawService: WithdrawService,
        private readonly supportService: SupportService,
        private readonly adminDashboardService: AdminDashboardService,
        private readonly cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.startLoadingFailSafe();
        this.loadStats();
    }

    ngOnDestroy(): void {
        this.clearLoadingFailSafe();
    }

    private async loadStats(): Promise<void> {
        this.isLoading = true;
        this.startLoadingFailSafe();

        try {
            // Primary path: single aggregate API for reliable and fast dashboard data.
            const dashboardStatsResponse = await this.safeRequest<AdminDashboardStatsResult>(
                this.adminDashboardService.getStats(),
                { result: undefined },
                12000
            );

            if (this.applyDashboardStatsResponse(dashboardStatsResponse)) {
                return;
            }

            // Fallback path: legacy multi-endpoint aggregation.
            const [usersResponse, allDeposits, allWithdrawals, allTickets, allTransactions] = await Promise.all([
                this.safeRequest(
                    this.userService.getAllUsers(0, 1, ''),
                    { result: { items: [], totalCount: 0 } }
                ),
                this.fetchAllItems((skipCount, maxResultCount) =>
                    this.depositService.getAllDepositRequests(skipCount, maxResultCount)
                ),
                this.fetchAllItems(
                    (skipCount, maxResultCount) =>
                        this.withdrawService.getAllWithdrawRequests(skipCount, maxResultCount),
                    { pageSize: 25, maxPages: 8, timeoutMs: 5000 }
                ),
                this.fetchAllItems((skipCount, maxResultCount) =>
                    this.supportService.getAllTickets(skipCount, maxResultCount)
                ),
                this.fetchAllItems((skipCount, maxResultCount) =>
                    this.transactionService.getAllTransactions(skipCount, maxResultCount)
                )
            ]);

            this.stats = {
                totalUsers: this.extractTotalCount(usersResponse),
                pendingDeposits: allDeposits.filter((x: any) => this.normalizeStatus(x?.status) === 'pending').length,
                pendingWithdrawals: allWithdrawals.filter((x: any) => this.normalizeStatus(x?.status) === 'pending').length,
                openTickets: allTickets.filter((x: any) => this.normalizeStatus(x?.status) === 'open').length,
                totalTransactionVolume: allTransactions.reduce(
                    (sum: number, x: any) => sum + Math.abs(this.toNumber(x?.amount)),
                    0
                )
            };
            this.cdr.detectChanges();
        } catch (error) {
            console.error('AdminDashboard: failed to load live stats', error);
            this.stats = {
                totalUsers: 0,
                pendingDeposits: 0,
                pendingWithdrawals: 0,
                openTickets: 0,
                totalTransactionVolume: 0
            };
            this.cdr.detectChanges();
        } finally {
            this.isLoading = false;
            this.clearLoadingFailSafe();
            this.cdr.detectChanges();
        }
    }

    private startLoadingFailSafe(): void {
        this.clearLoadingFailSafe();
        this.loadingFailSafeTimer = setTimeout(() => {
            if (this.isLoading) {
                console.warn('AdminDashboard: loading fail-safe triggered, rendering with available data.');
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        }, 5000);
    }

    private clearLoadingFailSafe(): void {
        if (this.loadingFailSafeTimer) {
            clearTimeout(this.loadingFailSafeTimer);
            this.loadingFailSafeTimer = null;
        }
    }

    private async fetchAllItems<T>(
        fetchPage: (skipCount: number, maxResultCount: number) => Observable<DashboardListResult<T>>,
        options?: {
            pageSize?: number;
            maxPages?: number;
            timeoutMs?: number;
        }
    ): Promise<T[]> {
        const pageSize = options?.pageSize ?? 200;
        const maxPages = options?.maxPages ?? 15; // Safety cap: max ~3,000 items for fast dashboard rendering
        const timeoutMs = options?.timeoutMs ?? 8000;
        const firstResponse = await this.safeRequest(
            fetchPage(0, pageSize),
            { result: { items: [], totalCount: 0 } } as DashboardListResult<T>,
            timeoutMs
        );

        const firstItems = this.extractItems<T>(firstResponse);
        const totalCount = this.extractTotalCount(firstResponse, firstItems.length);

        if (totalCount <= firstItems.length) {
            return firstItems;
        }

        const allItems: T[] = [...firstItems];
        const remainingRequests: Array<Promise<DashboardListResult<T>>> = [];
        let pagesQueued = 1;

        for (let skipCount = pageSize; skipCount < totalCount && pagesQueued < maxPages; skipCount += pageSize) {
            remainingRequests.push(
                this.safeRequest(
                    fetchPage(skipCount, pageSize),
                    { result: { items: [], totalCount: 0 } } as DashboardListResult<T>,
                    timeoutMs
                )
            );
            pagesQueued++;
        }

        const responses = await Promise.all(remainingRequests);
        for (const response of responses) {
            const pageItems = this.extractItems<T>(response);
            if (!pageItems.length) {
                continue;
            }
            allItems.push(...pageItems);
        }

        return allItems;
    }

    private safeRequest<T>(request$: Observable<T>, fallback: T, timeoutMs = 8000): Promise<T> {
        return firstValueFrom(
            request$.pipe(
                timeout(timeoutMs),
                catchError((error) => {
                    console.error('AdminDashboard: request failed', error);
                    return of(fallback);
                })
            )
        );
    }

    private applyDashboardStatsResponse(response: AdminDashboardStatsResult): boolean {
        const result = response?.result;
        if (!result) {
            return false;
        }

        this.stats = {
            totalUsers: this.toCount(result.totalUsers),
            pendingDeposits: this.toCount(result.pendingDeposits),
            pendingWithdrawals: this.toCount(result.pendingWithdrawals),
            openTickets: this.toCount(result.openTickets),
            totalTransactionVolume: this.toNumber(result.totalTransactionVolume)
        };
        this.cdr.detectChanges();
        return true;
    }

    private extractItems<T>(response: DashboardListResult<T>): T[] {
        const result = response?.result;

        if (Array.isArray(result)) {
            return result as T[];
        }

        if (result && Array.isArray((result as { items?: T[] }).items)) {
            return (result as { items: T[] }).items;
        }

        return [];
    }

    private extractTotalCount<T>(response: DashboardListResult<T>, fallback = 0): number {
        const result = response?.result;

        if (Array.isArray(result)) {
            return result.length;
        }

        if (result && typeof (result as { totalCount?: number }).totalCount === 'number') {
            return (result as { totalCount: number }).totalCount;
        }

        return fallback;
    }

    private normalizeStatus(status: unknown): string {
        return typeof status === 'string' ? status.trim().toLowerCase() : '';
    }

    private toNumber(value: unknown): number {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : 0;
    }

    private toCount(value: unknown): number {
        return Math.max(0, Math.trunc(this.toNumber(value)));
    }
}
