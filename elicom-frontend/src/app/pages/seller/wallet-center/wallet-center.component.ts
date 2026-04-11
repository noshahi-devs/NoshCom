import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { WalletService } from '../../../services/wallet.service';
import { WithdrawalService, WithdrawRequestDto } from '../../../services/withdrawal.service';
import { AlertService } from '../../../services/alert.service';
import { StoreService } from '../../../services/store.service';
import { SellerDashboardService } from '../../../services/seller-dashboard.service';
import { SellerPayoutMethodService, SellerPayoutMethodDto } from '../../../services/seller-payout-method.service';
import { catchError, of, forkJoin, timer, Subscription } from 'rxjs';

type WithdrawFilter = 'all' | 'pending' | 'approved' | 'rejected';

@Component({
    selector: 'app-wallet-center',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './wallet-center.component.html',
    styles: [`
        .admin-rules-box {
            background: #f8fafc;
            border-left: 4px solid #818cf8;
            padding: 15px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .rules-header {
            font-size: 11px;
            font-weight: 800;
            color: #6366f1;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .rule-item {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            margin-bottom: 4px;
        }
        .rule-label { color: #6b7280; }
        .rule-value { font-weight: 600; color: #111827; }
        .rule-remarks {
            margin-top: 10px;
            border-top: 1px solid #fde68a;
            padding-top: 8px;
        }
        .remarks-label { font-size: 10px; font-weight: 600; color: #b45309; margin-bottom: 2px; }
        .remarks-text { font-size: 12px; color: #4b5563; font-style: italic; }
        .alert-danger-soft {
            background-color: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fee2e2;
            border-radius: 6px;
        }
        .is-invalid {
            border-color: #ef4444 !important;
            background-color: #fef2f2 !important;
        }
    `],
    styleUrls: ['./wallet-center.component.scss']
})
export class WalletCenterComponent implements OnInit {
    private walletService = inject(WalletService);
    private withdrawalService = inject(WithdrawalService);
    private alert = inject(AlertService);
    private storeService = inject(StoreService);
    private sellerDashboardService = inject(SellerDashboardService);
    private payoutMethodService = inject(SellerPayoutMethodService);
    private cdr = inject(ChangeDetectorRef);
    private route = inject(ActivatedRoute);

    isLoading = true;
    isSubmitting = false;

    walletId = '';
    balance = 0;
    pendingPayout = 0;
    completePayout = 0;
    recentPayout = 0;

    withdrawAmount: number | null = null;
    searchTerm = '';
    selectedStatusFilter: WithdrawFilter = 'all';

    requests: WithdrawRequestDto[] = [];
    currentStore: any = null;

    activeMethod = {
        method: 'Not set',
        methodKey: '',
        receiveIn: 'World Cart API',
        walletId: 'Not set',
        accountTitle: 'Not set',
        country: '',
        accountType: '',
        routingNumber: '',
        referenceNumber: '',
        paymentDetails: '',
        isVerified: false,
        verificationMessage: ''
    };

    countdown = {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
    };
    private timerSubscription?: Subscription;
    private routeDataSubscription?: Subscription;
    viewMode: 'wallet' | 'withdrawal' = 'wallet';

    ngOnInit(): void {
        this.routeDataSubscription = this.route.data.subscribe(data => {
            this.viewMode = (data?.['walletView'] as 'wallet' | 'withdrawal') || 'wallet';
            this.cdr.markForCheck();
        });
        this.loadData();
        this.startCountdown();
    }

    ngOnDestroy(): void {
        this.timerSubscription?.unsubscribe();
        this.routeDataSubscription?.unsubscribe();
    }

    get filteredRequests(): WithdrawRequestDto[] {
        const statusFiltered = this.requests.filter(req => this.matchesStatusFilter(req.status));
        const term = (this.searchTerm || '').trim().toLowerCase();
        if (!term) return statusFiltered;

        return statusFiltered.filter(req => {
            const composite = [
                req.method || '',
                req.paymentDetails || '',
                req.status || '',
                req.creationTime || '',
                String(req.amount ?? '')
            ].join(' ').toLowerCase();
            return composite.includes(term);
        });
    }

    get isWalletView(): boolean {
        return this.viewMode === 'wallet';
    }

    get isWithdrawalView(): boolean {
        return this.viewMode === 'withdrawal';
    }

    get availableToWithdraw(): number {
        const limit = Number(this.currentStore?.withdrawLimit);
        if (!Number.isFinite(limit) || limit <= 0) return 0;
        return Math.max(0, Math.min(this.balance, limit));
    }

    get withdrawalStatusLabel(): string {
        if (this.currentStore?.withdrawLimit === null || this.currentStore?.withdrawLimit === undefined) {
            return 'Not Allowed';
        }
        return this.isWithdrawalUnlocked ? 'Unlocked' : 'Locked';
    }

    get withdrawalStatusSubtext(): string {
        if (this.currentStore?.withdrawLimit === null || this.currentStore?.withdrawLimit === undefined) {
            return 'Waiting for admin permission';
        }
        if (this.isWithdrawalUnlocked) {
            return this.currentStore?.withdrawAllowedUntil
                ? `Unlocked on ${new Date(this.currentStore.withdrawAllowedUntil).toLocaleDateString()}`
                : 'Withdrawal window is active';
        }
        return this.currentStore?.withdrawAllowedUntil
            ? `Unlocks on ${new Date(this.currentStore.withdrawAllowedUntil).toLocaleDateString()}`
            : 'Waiting for unlock time';
    }

    get paymentMethodStatusLabel(): string {
        return this.activeMethod.methodKey ? 'Configured' : 'Setup Needed';
    }

    get paymentMethodStatusTone(): string {
        return this.activeMethod.isVerified ? 'verified' : (this.activeMethod.methodKey ? 'configured' : 'pending');
    }

    get isBankMethod(): boolean {
        return this.activeMethod.methodKey === 'bank';
    }

    get payoutPrimaryLabel(): string {
        return this.isBankMethod ? 'Account Number' : 'Wallet ID';
    }

    get payoutPrimaryValue(): string {
        return this.activeMethod.walletId || 'Not set';
    }

    get payoutSecondaryLabel(): string {
        return this.isBankMethod ? 'Bank Setup' : 'Receiving Via';
    }

    get payoutSecondaryValue(): string {
        if (this.isBankMethod) {
            return [this.activeMethod.country, this.activeMethod.accountType].filter(Boolean).join(' • ') || 'Bank Transfer';
        }

        return this.activeMethod.receiveIn || 'World Cart API';
    }

    get paymentSparklinePoints(): string {
        const values = this.getPaymentSparklineValues();
        const width = 280;
        const height = 96;
        const paddingX = 10;
        const topPadding = 10;
        const bottomPadding = 14;
        const max = Math.max(...values, 1);
        const step = (width - paddingX * 2) / Math.max(values.length - 1, 1);

        return values.map((value, index) => {
            const x = paddingX + step * index;
            const normalized = value / max;
            const y = topPadding + (1 - normalized) * (height - topPadding - bottomPadding);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
    }

    get paymentSparklineAreaPath(): string {
        const points = this.paymentSparklinePoints.split(' ');
        if (!points.length) return '';
        const first = points[0]?.split(',')[0] || '10';
        const last = points[points.length - 1]?.split(',')[0] || '270';
        return `M ${first},82 L ${this.paymentSparklinePoints} L ${last},82 Z`;
    }

    private getPaymentSparklineValues(): number[] {
        const values = [
            this.toSafeNumber(this.balance),
            this.toSafeNumber(this.pendingPayout),
            this.toSafeNumber(this.completePayout),
            this.toSafeNumber(this.recentPayout)
        ];

        return values.every(value => value <= 0) ? [18, 34, 26, 42] : values;
    }

    setStatusFilter(filter: WithdrawFilter): void {
        this.selectedStatusFilter = filter;
    }

    get loadingRows(): number[] {
        return [1, 2, 3, 4];
    }

    get canWithdraw(): boolean {
        const amount = Number(this.withdrawAmount);
        const validAmount = Number.isFinite(amount) && amount > 0;

        if (!validAmount) return false;

        // Admin limit check - Must have a limit set to withdraw
        if (this.currentStore?.withdrawLimit === null || this.currentStore?.withdrawLimit === undefined) {
            return false;
        }

        // Must be within limit
        if (amount > this.currentStore.withdrawLimit) {
            return false;
        }

        // Withdrawal stays locked until the countdown completes
        if (!this.isWithdrawalUnlocked) {
            return false;
        }

        return true;
    }

    get latestWithdrawRequest(): WithdrawRequestDto | null {
        return this.requests.length ? this.requests[0] : null;
    }

    get countdownDaysDisplay(): string {
        return String(this.countdown.days || 0).padStart(2, '0');
    }

    get countdownHoursDisplay(): string {
        return String(this.countdown.hours || 0).padStart(2, '0');
    }

    get countdownMinutesDisplay(): string {
        return String(this.countdown.minutes || 0).padStart(2, '0');
    }

    get countdownSecondsDisplay(): string {
        return String(this.countdown.seconds || 0).padStart(2, '0');
    }

    get isWithdrawExpired(): boolean {
        if (!this.currentStore?.withdrawAllowedUntil) return false;
        return new Date(this.currentStore.withdrawAllowedUntil).getTime() <= new Date().getTime();
    }

    get isWithdrawalUnlocked(): boolean {
        if (this.currentStore?.withdrawLimit === null || this.currentStore?.withdrawLimit === undefined) {
            return false;
        }

        if (!this.currentStore?.withdrawAllowedUntil) {
            return true;
        }

        return new Date(this.currentStore.withdrawAllowedUntil).getTime() <= new Date().getTime();
    }

    getStatusClass(status: string): string {
        const normalized = this.normalizeStatus(status);
        if (this.isApproved(normalized)) return 'accepted';
        if (this.isRejected(normalized)) return 'refunded';
        return 'pending';
    }

    getWithdrawMethodLabel(method?: string): string {
        const normalizedMethod = this.normalizeStatus(method || '');
        return this.getPayoutDisplayLabel(normalizedMethod, method || 'Third Party');
    }

    getWithdrawReceiveInLabel(paymentDetails?: string): string {
        if (!paymentDetails) {
            return this.activeMethod.receiveIn || 'API Payout';
        }

        return paymentDetails
            .replace(/Easy\s*Finora\s*Wallet\s*ID\s*:/i, 'NoshPay Wallet ID:')
            .replace(/EasyFinora\s*Wallet\s*ID\s*:/i, 'NoshPay Wallet ID:')
            .replace(/Easy\s*Finora/gi, 'NashPay')
            .replace(/EasyFinora/gi, 'NashPay');
    }

    getRelativeDate(dateValue: string): string {
        if (!dateValue) return '-';
        const date = new Date(dateValue);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const dayMs = 24 * 60 * 60 * 1000;
        const days = Math.floor(diffMs / dayMs);

        if (days <= 0) return 'Today';
        if (days === 1) return '1 day ago';
        if (days < 30) return `${days} days ago`;

        const months = Math.floor(days / 30);
        if (months <= 1) return '1 month ago';
        return `${months} months ago`;
    }

    submitWithdraw(): void {
        const amount = Number(this.withdrawAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            this.alert.warning('Please enter a valid amount.');
            return;
        }

        if (amount > this.balance) {
            this.alert.warning('Amount exceeds your available balance.');
            return;
        }

        if (this.currentStore?.withdrawLimit === null || this.currentStore?.withdrawLimit === undefined) {
            this.alert.warning('You cannot withdraw funds at this time. Please wait for admin permission.');
            return;
        }

        if (!this.activeMethod.methodKey) {
            this.alert.warning('Please add a payout method first.');
            return;
        }

        const method = this.activeMethod.methodKey || this.activeMethod.method || 'thirdparty';
        const details = this.activeMethod.paymentDetails || `${this.activeMethod.receiveIn} | Wallet ID: ${this.activeMethod.walletId}`;

        this.isSubmitting = true;
        this.withdrawalService.submitWithdrawRequest({
            amount,
            method,
            paymentDetails: details
        }).pipe(catchError((err) => {
            this.isSubmitting = false;
            this.alert.error(err?.error?.error?.message || 'Failed to submit withdrawal request.');
            return of(null);
        })).subscribe((res) => {
            if (!res) return;

            this.isSubmitting = false;
            this.withdrawAmount = null;
            this.alert.success('Withdrawal request submitted successfully.');
            this.loadData();
        });
    }

    private loadData(): void {
        this.isLoading = true;
        const cachedStoreId = this.storeService.getCachedStoreId();

        forkJoin({
            wallet: this.walletService.getMyWallet().pipe(
                catchError((err) => {
                    console.error('Wallet load failed:', err);
                    return of(null);
                })
            ),
            requests: this.withdrawalService.getMyWithdrawRequests(0, 200).pipe(
                catchError((err) => {
                    console.error('Withdraw requests load failed:', err);
                    return of([]);
                })
            ),
            payoutMethod: this.payoutMethodService.getMyPayoutMethodSafe().pipe(
                catchError((err) => {
                    console.error('Payout method load failed:', err);
                    return of(null);
                })
            ),
            storeRes: this.storeService.getMyStoreCached(true).pipe(
                catchError((err) => {
                    console.error('Store load failed:', err);
                    return of(null);
                })
            )
        }).subscribe(({ wallet, requests, payoutMethod, storeRes }) => {
            this.requests = [...(requests || [])].sort((a, b) =>
                new Date(b?.creationTime || 0).getTime() - new Date(a?.creationTime || 0).getTime()
            );
            this.walletId = (wallet as any)?.id ? String((wallet as any).id) : '';
            this.resolveActiveMethodFromSavedEnhanced(payoutMethod as SellerPayoutMethodDto | null);

            this.currentStore = (storeRes as any)?.result || storeRes;
            const storeId = this.currentStore?.id || cachedStoreId;

            if (!storeId) {
                this.balance = this.toSafeNumber((wallet as any)?.balance);
                this.computeSummaryFromRequests();
                if (!this.activeMethod.methodKey) {
                    this.resolveActiveMethod();
                }
                this.isLoading = false;
                return;
            }

            this.sellerDashboardService.getStats(storeId).pipe(
                catchError((err) => {
                    console.error('Seller dashboard stats load failed:', err);
                    return of(null);
                })
            ).subscribe((stats: any) => {
                const walletBalance = this.toSafeNumber((wallet as any)?.balance);
                const statsBalance = this.toSafeNumber(stats?.walletBalance);
                const hasWalletBalance = (wallet as any)?.balance !== null && (wallet as any)?.balance !== undefined;
                this.balance = hasWalletBalance ? walletBalance : statsBalance;

                this.computeSummaryFromRequests(stats);
                if (!this.activeMethod.methodKey) {
                    this.resolveActiveMethod();
                }
                
                // Fallback top wallet ID if internal ID is missing
                if (!this.walletId && this.activeMethod.walletId && this.activeMethod.walletId !== 'Not set') {
                    this.walletId = this.activeMethod.walletId;
                }
                
                this.isLoading = false;
            });
        });
    }

    private computeSummaryFromRequests(stats?: any): void {
        const pending = this.requests.filter(r => this.isPending(r.status));
        const approved = this.requests.filter(r => this.isApproved(r.status));

        const pendingFromRequests = pending.reduce((sum, r) => sum + this.toSafeNumber(r.amount), 0);
        const completeFromRequests = approved.reduce((sum, r) => sum + this.toSafeNumber(r.amount), 0);
        const recentFromRequests = approved.length ? this.toSafeNumber(approved[0].amount) : 0;

        const pendingFromStats = this.toSafeNumber(stats?.acReserve);
        const completeFromStats = this.toSafeNumber(stats?.payoutTillNow);
        const recentFromStats = this.toSafeNumber(stats?.recentPayout);

        this.pendingPayout = pendingFromRequests > 0 ? pendingFromRequests : pendingFromStats;
        this.completePayout = completeFromRequests > 0 ? completeFromRequests : completeFromStats;
        this.recentPayout = recentFromRequests > 0 ? recentFromRequests : recentFromStats;
    }

    private resolveActiveMethod(): void {
        const pending = this.requests.find(r => this.isPending(r.status));
        const latest = pending || this.requests[0];

        if (!latest) {
            this.activeMethod = {
                method: 'Not set',
                methodKey: '',
                receiveIn: 'World Cart API',
                walletId: 'Not set',
                accountTitle: 'Not set',
                country: '',
                accountType: '',
                routingNumber: '',
                referenceNumber: '',
                paymentDetails: '',
                isVerified: false,
                verificationMessage: ''
            };
            return;
        }

        const extractedWalletId = this.extractWalletId(latest.paymentDetails || '') || 'N/A';
        const normalizedMethod = (latest.method || '').toLowerCase();
        const displayMethod = this.getPayoutDisplayLabel(normalizedMethod, latest.method || 'Third Party');
        this.activeMethod = {
            method: displayMethod,
            methodKey: normalizedMethod,
            receiveIn: normalizedMethod === 'easyfinora' ? 'NashPay' : 'World Cart API',
            walletId: extractedWalletId,
            accountTitle: 'Not set',
            country: '',
            accountType: '',
            routingNumber: '',
            referenceNumber: '',
            paymentDetails: latest.paymentDetails || '',
            isVerified: true,
            verificationMessage: 'Based on latest payout request'
        };
    }

    private resolveActiveMethodFromSaved(saved: SellerPayoutMethodDto | null): void {
        if (!saved?.methodKey) return;

        const normalizedMethod = (saved.methodKey || '').toLowerCase();
        const parsedBankDetails = normalizedMethod === 'bank'
            ? this.parseBankPaymentDetails(saved.paymentDetails || '')
            : null;
        const displayMethod = normalizedMethod === 'bank'
            ? (saved.bankName || 'Bank Transfer')
            : this.getPayoutDisplayLabel(normalizedMethod, saved.methodLabel || saved.methodKey || 'Not set');

        const receiveIn = normalizedMethod === 'bank'
            ? [saved.country, saved.accountType].filter(Boolean).join(' • ') || 'Bank Transfer'
            : normalizedMethod === 'easyfinora'
                ? 'NashPay'
                : 'World Cart API';

        const payoutTarget = normalizedMethod === 'bank'
            ? (parsedBankDetails?.accountNumber || saved.accountNumberMasked || 'Not set')
            : saved.walletId || saved.cardNumberMasked || saved.accountNumberMasked || 'Not set';

        this.activeMethod = {
            method: displayMethod,
            methodKey: normalizedMethod,
            receiveIn: receiveIn,
            walletId: payoutTarget,
            accountTitle: saved.accountTitle || parsedBankDetails?.accountTitle || 'Not set',
            country: saved.country || parsedBankDetails?.country || '',
            accountType: saved.accountType || parsedBankDetails?.accountType || '',
            routingNumber: saved.routingNumber || parsedBankDetails?.routingNumber || '',
            referenceNumber: saved.swiftCode || parsedBankDetails?.referenceNumber || '',
            paymentDetails: saved.paymentDetails || '',
            isVerified: !!saved.isEasyFinoraVerified,
            verificationMessage: saved.verificationMessage || ''
        };
    }

    private resolveActiveMethodFromSavedEnhanced(saved: SellerPayoutMethodDto | null): void {
        if (!saved?.methodKey) return;

        const normalizedMethod = (saved.methodKey || '').toLowerCase();
        const parsedBankDetails = normalizedMethod === 'bank'
            ? this.parseBankPaymentDetails(saved.paymentDetails || '')
            : null;

        const displayMethod = normalizedMethod === 'bank'
            ? (saved.bankName || 'Bank Transfer')
            : this.getPayoutDisplayLabel(normalizedMethod, saved.methodLabel || saved.methodKey || 'Not set');

        const receiveIn = normalizedMethod === 'bank'
            ? [saved.country || parsedBankDetails?.country, saved.accountType || parsedBankDetails?.accountType].filter(Boolean).join(' • ') || 'Bank Transfer'
            : normalizedMethod === 'easyfinora'
                ? 'NashPay'
                : 'World Cart API';

        const payoutTarget = normalizedMethod === 'bank'
            ? (parsedBankDetails?.accountNumber || saved.accountNumberMasked || 'Not set')
            : saved.walletId || saved.cardNumberMasked || saved.accountNumberMasked || 'Not set';

        this.activeMethod = {
            method: displayMethod,
            methodKey: normalizedMethod,
            receiveIn: receiveIn,
            walletId: payoutTarget,
            accountTitle: saved.accountTitle || parsedBankDetails?.accountTitle || 'Not set',
            country: saved.country || parsedBankDetails?.country || '',
            accountType: saved.accountType || parsedBankDetails?.accountType || '',
            routingNumber: saved.routingNumber || parsedBankDetails?.routingNumber || '',
            referenceNumber: saved.swiftCode || parsedBankDetails?.referenceNumber || '',
            paymentDetails: saved.paymentDetails || '',
            isVerified: !!saved.isEasyFinoraVerified,
            verificationMessage: saved.verificationMessage || ''
        };
    }

    private getPayoutDisplayLabel(methodKey: string, fallback: string): string {
        if (methodKey === 'easyfinora') {
            return 'NashPay';
        }

        return fallback || 'Not set';
    }

    private extractWalletId(details: string): string {
        if (!details) return '';
        const digits = (details.match(/\d{8,}/g) || []).join('');
        if (digits) return digits;
        return details.length > 24 ? `${details.slice(0, 24)}...` : details;
    }

    private parseBankPaymentDetails(details: string): {
        country: string;
        accountType: string;
        accountTitle: string;
        accountNumber: string;
        routingNumber: string;
        referenceNumber: string;
    } | null {
        if (!details) return null;

        const result = {
            country: '',
            accountType: '',
            accountTitle: '',
            accountNumber: '',
            routingNumber: '',
            referenceNumber: ''
        };

        details.split(';').forEach((segment) => {
            const [rawLabel, ...rawValueParts] = segment.split(':');
            const label = (rawLabel || '').trim().toLowerCase();
            const value = rawValueParts.join(':').trim();
            if (!label || !value) return;

            if (label === 'country') result.country = value;
            if (label === 'account type') result.accountType = value;
            if (label === 'account title') result.accountTitle = value;
            if (label === 'account') result.accountNumber = value;
            if (label === 'routing') result.routingNumber = value;
            if (label === 'reference') result.referenceNumber = value;
        });

        return result;
    }

    private matchesStatusFilter(status: string): boolean {
        const normalized = this.normalizeStatus(status);
        if (this.selectedStatusFilter === 'pending') return this.isPending(normalized);
        if (this.selectedStatusFilter === 'approved') return this.isApproved(normalized);
        if (this.selectedStatusFilter === 'rejected') return this.isRejected(normalized);
        return true;
    }

    private normalizeStatus(status: string): string {
        return (status || '').trim().toLowerCase();
    }

    private isApproved(status: string): boolean {
        return status === 'approved' || status === 'completed' || status === 'accepted';
    }

    private isPending(status: string): boolean {
        return status === 'pending' || status === 'processing';
    }

    private isRejected(status: string): boolean {
        return status === 'rejected' || status === 'failed' || status === 'refunded';
    }

    private toSafeNumber(value: any): number {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    private startCountdown(): void {
        this.timerSubscription?.unsubscribe();
        this.timerSubscription = timer(0, 1000).subscribe(() => {
            this.updateCountdown();
            this.cdr.detectChanges();
        });
    }

    private updateCountdown(): void {
        if (!this.currentStore?.withdrawAllowedUntil) {
            this.countdown = { days: 0, hours: 0, minutes: 0, seconds: 0 };
            return;
        }

        const target = new Date(this.currentStore.withdrawAllowedUntil).getTime();
        const now = new Date().getTime();
        const gap = target - now;

        if (gap <= 0) {
            this.countdown = { days: 0, hours: 0, minutes: 0, seconds: 0 };
            return;
        }

        const second = 1000;
        const minute = second * 60;
        const hour = minute * 60;
        const day = hour * 24;

        this.countdown = {
            days: Math.floor(gap / day),
            hours: Math.floor((gap % day) / hour),
            minutes: Math.floor((gap % hour) / minute),
            seconds: Math.floor((gap % minute) / second)
        };
    }
}
