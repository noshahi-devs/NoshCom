import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { timeout } from 'rxjs/operators';
import { CardService } from '../../services/card.service';
import { ToastService } from '../../shared/toast/toast.service';
import { TransactionService } from '../../services/transaction.service';

interface UpgradePlanItem {
    code: string;
    name: string;
    price: string;
    colorClass: string;
    icon: string;
    status: string;
    cta: string;
    tabText: string;
    isPurchased?: boolean;
    benefits: { label: string; value: string }[];
}

interface ActiveCardSnapshot {
    cardId: number;
    cardTypeLabel: string;
    holderName: string;
    cardNumber: string;
    expiryDate: string;
    status: string;
    activeSubscription: string;
}

interface PersistedCardSnapshot {
    userId: string;
    card: ActiveCardSnapshot;
}

@Component({
    selector: 'app-upgrade-plan',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './upgrade-plan.component.html',
    styleUrls: ['./upgrade-plan.component.scss']
})
export class UpgradePlan implements OnInit {
    private readonly activePlanStorageKey = 'easy_finora_active_plan_code';
    private readonly activeCardStorageKey = 'easy_finora_active_card_snapshot';
    private isUsageOverviewApiAvailable = true;
    showPurchaseModal = false;
    isSubmitting = false;
    selectedPlan: UpgradePlanItem | null = null;
    activePlanCode = 'free';
    pendingPlanCode = '';

    holderName = '';
    cardNumber = '';
    expiryDate = '';
    cvv = '';
    activeCard: ActiveCardSnapshot | null = null;
    usageOverview: any = null;
    usageLoading = false;
    cardSectionLoading = true;
    cardLoadCompleted = false;

    constructor(
        private cardService: CardService,
        private toastService: ToastService,
        private transactionService: TransactionService
    ) { }

    plans: UpgradePlanItem[] = [
        {
            code: 'free',
            name: 'Free',
            price: '0',
            colorClass: 'basic',
            icon: 'F',
            status: 'Active For E-Commerce',
            cta: 'Active By Default',
            tabText: 'Active',
            benefits: [
                { label: 'Daily transection limit', value: '$150' },
                { label: 'Monthly transection limit', value: '$1500' },
                { label: 'Transections per day', value: '3' },
                { label: 'Transections per month', value: '15' },
                { label: 'Upgrade to VISA Card', value: 'x' }
            ]
        },
        {
            code: 'standard',
            name: 'Standard',
            price: '10',
            colorClass: 'standard',
            icon: 'S',
            status: 'Active For E-Commerce',
            cta: 'Purchase Now',
            tabText: 'Purchase Now',
            benefits: [
                { label: 'Daily transection limit', value: '$300' },
                { label: 'Monthly transection limit', value: '$2500' },
                { label: 'Transections per day', value: '5' },
                { label: 'Transections per month', value: '50' },
                { label: 'Upgrade to VISA Card', value: 'x' }
            ]
        },
        {
            code: 'premium',
            name: 'Premium',
            price: '25',
            colorClass: 'premium',
            icon: 'P',
            status: 'Active For E-Commerce',
            cta: 'Purchase Now',
            tabText: 'Purchase Now',
            benefits: [
                { label: 'Daily transection limit', value: '$500' },
                { label: 'Monthly transection limit', value: '$5000' },
                { label: 'Transections per day', value: '10' },
                { label: 'Transections per month', value: '100' },
                { label: 'Upgrade to VISA Card', value: 'x' }
            ]
        },
        {
            code: 'business-plus',
            name: 'Business Plus',
            price: '50',
            colorClass: 'business',
            icon: 'B+',
            status: 'Active For E-Commerce',
            cta: 'Purchase Now',
            tabText: 'Purchase Now',
            benefits: [
                { label: 'Daily transection limit', value: '$2000' },
                { label: 'Monthly transection limit', value: '$50,000' },
                { label: 'Transections per day', value: '20' },
                { label: 'Transections per month', value: '500' },
                { label: 'Upgrade to VISA Card', value: 'x' }
            ]
        }
    ];

    ngOnInit(): void {
        const persistedPlanCode = this.getPersistedActivePlanCode();
        if (persistedPlanCode) {
            this.activePlanCode = persistedPlanCode;
            this.applyPlanState();
        }

        const persistedCard = this.getPersistedActiveCardSnapshot();
        if (persistedCard) {
            this.activeCard = {
                ...persistedCard,
                activeSubscription: this.getPlanDisplayName(this.activePlanCode)
            };
            this.usageOverview = this.buildUsageOverviewFromHistory([], persistedCard.cardId, this.activePlanCode);
            this.cardLoadCompleted = true;
            this.cardSectionLoading = false;
            this.usageLoading = false;
            this.debugLog('ngOnInit restored cached active card', {
                cardId: persistedCard.cardId,
                activePlanCode: this.activePlanCode
            });
        }

        this.syncPlanStateFromServer();
    }

    onPlanAction(plan: UpgradePlanItem): void {
        this.debugLog('plan tab clicked', {
            code: plan.code,
            name: plan.name,
            tabText: plan.tabText,
            isPurchased: !!plan.isPurchased,
            activePlanCode: this.activePlanCode,
            pendingPlanCode: this.pendingPlanCode,
            activeCardId: this.activeCard?.cardId || 0
        });
        if (plan.tabText === 'Active') {
            this.toastService.showModal(`${plan.name} plan is already active.`, 'Info', 'info');
            return;
        }

        if (plan.code === 'free') {
            this.applyPlan(plan);
            return;
        }

        if (plan.tabText === 'Apply Now' || plan.isPurchased) {
            this.applyPlan(plan);
            return;
        }

        this.selectedPlan = plan;
        this.showPurchaseModal = true;
    }

    closePurchaseModal(): void {
        if (this.isSubmitting) {
            return;
        }

        this.showPurchaseModal = false;
        this.selectedPlan = null;
        this.holderName = '';
        this.cardNumber = '';
        this.expiryDate = '';
        this.cvv = '';
    }

    submitPurchase(): void {
        if (!this.selectedPlan) {
            return;
        }

        if (!this.holderName.trim() || !this.cardNumber.trim() || !this.expiryDate.trim() || !this.cvv.trim()) {
            this.toastService.showModal('Please enter user name, card number, expiry date and CVV.', 'Validation Error', 'error');
            return;
        }

        this.isSubmitting = true;
        this.cardService.purchaseUpgradePlan({
            planCode: this.selectedPlan.code,
            holderName: this.holderName.trim(),
            cardNumber: this.cardNumber.trim(),
            expiryDate: this.expiryDate.trim(),
            cvv: this.cvv.trim()
        }).subscribe({
            next: (res) => {
                const result = res?.result;
                const charged = result?.amountCharged ?? this.selectedPlan?.price;
                const balance = result?.remainingWalletBalance;
                const msg = `Plan purchased. Charged: $${charged}.` + (typeof balance === 'number' ? ` Remaining wallet: $${balance}.` : '');

                if (this.selectedPlan) {
                    this.pendingPlanCode =
                        this.normalizePlanCode(result?.pendingSubscriptionCode) ||
                        this.selectedPlan.code;
                    this.activePlanCode =
                        this.normalizePlanCode(result?.activeSubscriptionCode) ||
                        this.activePlanCode;
                    this.persistActivePlanCode(this.activePlanCode);
                    this.applyPlanState();
                }

                this.syncPlanStateFromServer();
                this.toastService.showModal(msg, 'Plan Purchased', 'success');
                this.closePurchaseModal();
                this.isSubmitting = false;
            },
            error: (err) => {
                const message =
                    err?.error?.error?.message ||
                    err?.error?.message ||
                    err?.message ||
                    'Unable to purchase plan.';
                this.toastService.showModal(message, 'Purchase Failed', 'error');
                this.isSubmitting = false;
            }
        });
    }

    private applyPlan(plan: UpgradePlanItem, allowLegacyFreeFallback = true): void {
        if (this.isSubmitting) {
            return;
        }

        this.isSubmitting = true;
        this.executeApplyPlan(plan, allowLegacyFreeFallback);
    }

    private executeApplyPlan(plan: UpgradePlanItem, allowLegacyFreeFallback: boolean): void {
        this.cardService.applyUpgradePlan({ planCode: plan.code }).subscribe({
            next: (res) => {
                const result = res?.result;
                this.activePlanCode =
                    this.normalizePlanCode(result?.activeSubscriptionCode) ||
                    plan.code;
                this.pendingPlanCode =
                    this.normalizePlanCode(result?.pendingSubscriptionCode) ||
                    '';
                this.persistActivePlanCode(this.activePlanCode);
                this.applyPlanState();

                const resultCardId = Number(result?.cardId ?? result?.CardId ?? 0);
                const resultCardNumber = result?.cardNumber ?? result?.CardNumber ?? '';
                const resultCardStatus = result?.cardStatus ?? result?.CardStatus ?? 'Active';
                if (resultCardId > 0) {
                    this.activeCard = {
                        cardId: resultCardId,
                        cardTypeLabel: this.activeCard?.cardTypeLabel || 'Card',
                        holderName: this.activeCard?.holderName || 'Card Holder',
                        cardNumber: resultCardNumber || this.activeCard?.cardNumber || '**** **** **** ****',
                        expiryDate: this.activeCard?.expiryDate || '--/--',
                        status: resultCardStatus || 'Active',
                        activeSubscription: this.getPlanDisplayName(this.activePlanCode)
                    };
                    this.persistActiveCardSnapshot(this.activeCard);
                }

                if (this.activeCard) {
                    this.activeCard = {
                        ...this.activeCard,
                        status: 'Active',
                        activeSubscription: this.getPlanDisplayName(this.activePlanCode)
                    };
                    this.persistActiveCardSnapshot(this.activeCard);

                    if (this.activeCard.cardId) {
                        this.loadUsageOverview(this.activeCard.cardId);
                    }
                }

                this.toastService.showModal(
                    result?.message || `${plan.name} plan applied successfully.`,
                    'Plan Applied',
                    'success'
                );
                this.syncPlanStateFromServer();
                this.isSubmitting = false;
            },
            error: (err) => {
                const message =
                    err?.error?.error?.message ||
                    err?.error?.message ||
                    err?.message ||
                    'Unable to apply plan.';

                if (allowLegacyFreeFallback && this.shouldUseLegacyFreeFallback(plan.code, message)) {
                    this.runLegacyFreeFallback(plan);
                    return;
                }

                this.toastService.showModal(message, 'Apply Failed', 'error');
                this.isSubmitting = false;
            }
        });
    }

    private shouldUseLegacyFreeFallback(planCode: string, message: string): boolean {
        const normalizedPlan = this.normalizePlanCode(planCode);
        const normalizedMessage = (message || '').toLowerCase();
        return normalizedPlan === 'free' && (
            normalizedMessage.includes('no purchased plan available to apply') ||
            normalizedMessage.includes('purchase a plan first')
        );
    }

    private runLegacyFreeFallback(plan: UpgradePlanItem): void {
        const cardId = Number(this.activeCard?.cardId || 0);
        if (!cardId) {
            this.toastService.showModal('No active card found to apply free plan.', 'Apply Failed', 'error');
            this.isSubmitting = false;
            return;
        }

        this.cardService.getCardSensitiveDetails(cardId).subscribe({
            next: (sensitiveRes) => {
                const details = sensitiveRes?.result || {};
                const holderName = (details?.holderName || this.activeCard?.holderName || '').toString().trim();
                const cardNumber = (details?.cardNumber || '').toString().replace(/\D/g, '');
                const expiryDate = (details?.expiryDate || this.activeCard?.expiryDate || '').toString().trim();
                const cvv = (details?.cvv || '').toString().replace(/\D/g, '');

                if (!holderName || !cardNumber || !expiryDate || !cvv) {
                    this.toastService.showModal(
                        'Unable to auto-apply free plan because card details could not be verified.',
                        'Apply Failed',
                        'error'
                    );
                    this.isSubmitting = false;
                    return;
                }

                this.cardService.purchaseUpgradePlan({
                    planCode: 'free',
                    holderName,
                    cardNumber,
                    expiryDate,
                    cvv
                }).subscribe({
                    next: () => {
                        this.executeApplyPlan(plan, false);
                    },
                    error: (purchaseErr) => {
                        const purchaseMessage =
                            purchaseErr?.error?.error?.message ||
                            purchaseErr?.error?.message ||
                            purchaseErr?.message ||
                            '';

                        if ((purchaseMessage || '').toLowerCase().includes('already purchased')) {
                            this.executeApplyPlan(plan, false);
                            return;
                        }

                        this.toastService.showModal(
                            purchaseMessage || 'Unable to prepare free plan for apply.',
                            'Apply Failed',
                            'error'
                        );
                        this.isSubmitting = false;
                    }
                });
            },
            error: () => {
                this.toastService.showModal(
                    'Unable to fetch card details for free plan activation.',
                    'Apply Failed',
                    'error'
                );
                this.isSubmitting = false;
            }
        });
    }

    private syncPlanStateFromServer(): void {
        const hasCachedCard = !!this.activeCard?.cardId;
        if (hasCachedCard && !this.usageOverview && this.activeCard?.cardId) {
            this.usageOverview = this.buildUsageOverviewFromHistory([], this.activeCard.cardId, this.activePlanCode);
        }
        this.cardLoadCompleted = hasCachedCard;
        this.cardSectionLoading = !hasCachedCard;
        this.usageLoading = !hasCachedCard;
        if (!hasCachedCard) {
            this.usageOverview = null;
        }

        this.cardService.getUserCards().pipe(
            timeout(12000)
        ).subscribe({
            next: (res) => {
                const cards = this.extractCards(res);
                this.debugLog('GetUserCards success', {
                    count: cards.length,
                    hasCachedCard,
                    currentActiveCardId: this.activeCard?.cardId || 0
                });
                const activeCard = cards.find((c: any) => this.isCardActive(c)) || cards[0];
                const planCodeFromServer = this.normalizePlanCode(
                    activeCard?.activeSubscriptionCode ||
                    activeCard?.ActiveSubscriptionCode ||
                    activeCard?.activeSubscription ||
                    activeCard?.ActiveSubscription
                );

                this.activePlanCode = this.resolveActivePlanCode(planCodeFromServer);
                this.persistActivePlanCode(this.activePlanCode);

                this.pendingPlanCode = this.normalizePlanCode(
                    activeCard?.pendingSubscriptionCode ||
                    activeCard?.PendingSubscriptionCode ||
                    activeCard?.pendingSubscription ||
                    activeCard?.PendingSubscription
                ) || '';

                this.applyPlanState();

                this.activeCard = activeCard
                    ? {
                        cardId: activeCard.cardId ?? activeCard.CardId ?? activeCard.id,
                        cardTypeLabel: this.resolveCardTypeLabel(activeCard.cardType ?? activeCard.CardType),
                        holderName: activeCard.holderName || activeCard.HolderName || 'Card Holder',
                        cardNumber: activeCard.cardNumber || activeCard.CardNumber || '**** **** **** ****',
                        expiryDate: activeCard.expiryDate || activeCard.ExpiryDate || '--/--',
                        status: activeCard.status || activeCard.Status || 'Inactive',
                        // Always bind display to resolved active plan code
                        // so top panel stays correct after plan switches.
                        activeSubscription: this.getPlanDisplayName(this.activePlanCode)
                    }
                    : null;
                this.persistActiveCardSnapshot(this.activeCard);

                if (this.activeCard?.cardId) {
                    this.cardLoadCompleted = true;
                    this.debugLog('loading usage overview for active card', {
                        cardId: this.activeCard.cardId,
                        activePlanCode: this.activePlanCode
                    });
                    this.loadUsageOverview(this.activeCard.cardId);
                } else {
                    this.usageOverview = null;
                    this.usageLoading = false;
                    this.cardSectionLoading = false;
                    this.cardLoadCompleted = true;
                    this.debugLog('no active card available from server', {});
                }
            },
            error: () => {
                this.activePlanCode =
                    this.getPersistedActivePlanCode() ||
                    this.activePlanCode ||
                    'free';
                this.persistActivePlanCode(this.activePlanCode);
                this.pendingPlanCode = '';
                this.applyPlanState();
                this.usageOverview = null;
                this.usageLoading = false;
                this.cardSectionLoading = false;
                this.cardLoadCompleted = true;

                if (!this.activeCard) {
                    const persistedCard = this.getPersistedActiveCardSnapshot();
                    if (persistedCard) {
                        this.activeCard = {
                            ...persistedCard,
                            activeSubscription: this.getPlanDisplayName(this.activePlanCode)
                        };
                        this.cardLoadCompleted = true;
                    }
                }

                if (this.activeCard) {
                    this.activeCard = {
                        ...this.activeCard,
                        activeSubscription: this.getPlanDisplayName(this.activePlanCode)
                    };
                    this.usageOverview = this.usageOverview || this.buildUsageOverviewFromHistory([], this.activeCard.cardId, this.activePlanCode);
                    this.debugLog('GetUserCards failed, fallback from cached card', {
                        cardId: this.activeCard.cardId,
                        activePlanCode: this.activePlanCode
                    });
                } else {
                    this.debugLog('GetUserCards failed and no cached active card', {});
                }
            }
        });
    }

    private loadUsageOverview(cardId: number): void {
        if (!cardId) {
            this.usageOverview = null;
            this.usageLoading = false;
            this.cardSectionLoading = false;
            this.debugLog('loadUsageOverview skipped: invalid cardId', { cardId });
            return;
        }

        const emptyUsageFallback = this.buildUsageOverviewFromHistory([], cardId, this.activePlanCode);
        this.usageLoading = true;
        this.cardSectionLoading = true;
        this.usageOverview = emptyUsageFallback;

        if (!this.isUsageOverviewApiAvailable) {
            this.loadUsageOverviewFromHistoryFallback(cardId);
            return;
        }

        this.cardService.getCardUsageOverview(cardId).pipe(
            timeout(12000)
        ).subscribe({
            next: (res) => {
                const rawUsage = res?.result ?? res;
                this.usageOverview = this.mapUsageOverviewFromServer(rawUsage, cardId) || emptyUsageFallback;
                const usagePlanCode = this.normalizePlanCode(this.usageOverview?.planCode);
                this.activePlanCode = this.resolveActivePlanCode(usagePlanCode);
                this.persistActivePlanCode(this.activePlanCode);

                if (this.activeCard) {
                    this.activeCard = {
                        ...this.activeCard,
                        activeSubscription: this.getPlanDisplayName(this.activePlanCode)
                    };
                }

                this.applyPlanState();
                this.usageLoading = false;
                this.cardSectionLoading = false;
                this.debugLog('GetCardUsageOverview success', {
                    cardId,
                    planCode: this.usageOverview?.planCode,
                    dailyTxUsed: this.usageOverview?.dailyTransactionUsed,
                    monthlyTxUsed: this.usageOverview?.monthlyTransactionUsed,
                    monthlyTxRemaining: this.usageOverview?.monthlyTransactionRemaining,
                    monthlyAmountUsed: this.usageOverview?.monthlyAmountUsed,
                    monthlyAmountRemaining: this.usageOverview?.monthlyAmountRemaining
                });
            },
            error: (err) => {
                if (Number(err?.status) === 404) {
                    // Current backend build doesn't expose this endpoint.
                    // Stop calling it repeatedly and use local history computation.
                    this.isUsageOverviewApiAvailable = false;
                }
                this.debugLog('GetCardUsageOverview failed, using history fallback', {
                    cardId,
                    status: Number(err?.status || 0)
                });
                this.loadUsageOverviewFromHistoryFallback(cardId);
            }
        });
    }

    private loadUsageOverviewFromHistoryFallback(cardId: number): void {
        this.transactionService.getHistory(0, 1000).pipe(
            timeout(12000)
        ).subscribe({
            next: (res) => {
                const items = Array.isArray(res?.result?.items) ? res.result.items : [];
                this.usageOverview = this.buildUsageOverviewFromHistory(items, cardId, this.activePlanCode);
                this.usageLoading = false;
                this.cardSectionLoading = false;
                this.debugLog('history fallback success', {
                    cardId,
                    txCount: items.length,
                    monthlyTxUsed: this.usageOverview?.monthlyTransactionUsed,
                    monthlyTxRemaining: this.usageOverview?.monthlyTransactionRemaining
                });
            },
            error: () => {
                this.usageOverview = this.buildUsageOverviewFromHistory([], cardId, this.activePlanCode);
                this.usageLoading = false;
                this.cardSectionLoading = false;
                this.debugLog('history fallback failed, using empty usage', { cardId });
            }
        });
    }

    private mapUsageOverviewFromServer(raw: any, cardId: number): any {
        const payload = raw?.result ?? raw;
        if (!payload) {
            return this.buildUsageOverviewFromHistory([], cardId, this.activePlanCode);
        }

        const now = new Date();
        const dayStartFallback = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
        const monthStartFallback = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
        const planCode = this.normalizePlanCode(payload?.planCode ?? payload?.PlanCode) || this.activePlanCode || 'free';
        const limits = this.getPlanLimits(planCode);

        const dailyTransactionLimit = Math.max(0, this.toSafeNumber(payload?.dailyTransactionLimit ?? payload?.DailyTransactionLimit, limits.transactionsPerDay));
        const dailyTransactionUsed = Math.max(0, this.toSafeNumber(payload?.dailyTransactionUsed ?? payload?.DailyTransactionUsed, 0));
        const monthlyTransactionLimit = Math.max(0, this.toSafeNumber(payload?.monthlyTransactionLimit ?? payload?.MonthlyTransactionLimit, limits.transactionsPerMonth));
        const monthlyTransactionUsed = Math.max(0, this.toSafeNumber(payload?.monthlyTransactionUsed ?? payload?.MonthlyTransactionUsed, 0));
        const dailyAmountLimit = Math.max(0, this.toSafeNumber(payload?.dailyAmountLimit ?? payload?.DailyAmountLimit, limits.dailyAmountLimit));
        const dailyAmountUsed = Math.max(0, this.toSafeNumber(payload?.dailyAmountUsed ?? payload?.DailyAmountUsed, 0));
        const monthlyAmountLimit = Math.max(0, this.toSafeNumber(payload?.monthlyAmountLimit ?? payload?.MonthlyAmountLimit, limits.monthlyAmountLimit));
        const monthlyAmountUsed = Math.max(0, this.toSafeNumber(payload?.monthlyAmountUsed ?? payload?.MonthlyAmountUsed, 0));

        return {
            cardId: this.toSafeNumber(payload?.cardId ?? payload?.CardId, cardId),
            planCode,
            planName: this.getPlanDisplayName(planCode),
            dailyTransactionLimit,
            dailyTransactionUsed,
            dailyTransactionRemaining: Math.max(0, dailyTransactionLimit - dailyTransactionUsed),
            monthlyTransactionLimit,
            monthlyTransactionUsed,
            monthlyTransactionRemaining: Math.max(0, monthlyTransactionLimit - monthlyTransactionUsed),
            dailyAmountLimit,
            dailyAmountUsed,
            dailyAmountRemaining: Math.max(0, dailyAmountLimit - dailyAmountUsed),
            monthlyAmountLimit,
            monthlyAmountUsed,
            monthlyAmountRemaining: Math.max(0, monthlyAmountLimit - monthlyAmountUsed),
            usageDayStartUtc: this.toSafeDate(payload?.usageDayStartUtc ?? payload?.UsageDayStartUtc, dayStartFallback),
            usageMonthStartUtc: this.toSafeDate(payload?.usageMonthStartUtc ?? payload?.UsageMonthStartUtc, monthStartFallback),
            nextDailyResetUtc: this.toSafeDate(
                payload?.nextDailyResetUtc ?? payload?.NextDailyResetUtc,
                new Date(dayStartFallback.getTime() + 24 * 60 * 60 * 1000)
            ),
            nextMonthlyResetUtc: this.toSafeDate(
                payload?.nextMonthlyResetUtc ?? payload?.NextMonthlyResetUtc,
                new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0))
            )
        };
    }

    private buildUsageOverviewFromHistory(items: any[], cardId: number, planCode: string): any {
        const normalizedPlanCode = this.normalizePlanCode(planCode) || 'free';
        const limits = this.getPlanLimits(normalizedPlanCode);

        const now = new Date();
        const dayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
        const monthStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));

        const cardTx = (items || []).filter((tx: any) => {
            const txCardId = Number(tx?.cardId ?? tx?.CardId ?? 0);
            const movement = (tx?.movementType ?? tx?.MovementType ?? '').toString().toLowerCase();
            const category = (tx?.category ?? tx?.Category ?? '').toString().toLowerCase();
            return txCardId === Number(cardId) && movement === 'debit' && category.includes('card');
        });

        const dailyTx = cardTx.filter((tx: any) => {
            const created = new Date(tx?.creationTime ?? tx?.CreationTime ?? 0);
            return !isNaN(created.getTime()) && created >= dayStartUtc;
        });

        const monthlyTx = cardTx.filter((tx: any) => {
            const created = new Date(tx?.creationTime ?? tx?.CreationTime ?? 0);
            return !isNaN(created.getTime()) && created >= monthStartUtc;
        });

        const dailyAmountUsed = dailyTx.reduce((sum: number, tx: any) => sum + Math.abs(Number(tx?.amount ?? tx?.Amount ?? 0)), 0);
        const monthlyAmountUsed = monthlyTx.reduce((sum: number, tx: any) => sum + Math.abs(Number(tx?.amount ?? tx?.Amount ?? 0)), 0);

        return {
            cardId,
            planCode: normalizedPlanCode,
            planName: this.getPlanDisplayName(normalizedPlanCode),
            dailyTransactionLimit: limits.transactionsPerDay,
            dailyTransactionUsed: dailyTx.length,
            dailyTransactionRemaining: Math.max(0, limits.transactionsPerDay - dailyTx.length),
            monthlyTransactionLimit: limits.transactionsPerMonth,
            monthlyTransactionUsed: monthlyTx.length,
            monthlyTransactionRemaining: Math.max(0, limits.transactionsPerMonth - monthlyTx.length),
            dailyAmountLimit: limits.dailyAmountLimit,
            dailyAmountUsed,
            dailyAmountRemaining: Math.max(0, limits.dailyAmountLimit - dailyAmountUsed),
            monthlyAmountLimit: limits.monthlyAmountLimit,
            monthlyAmountUsed,
            monthlyAmountRemaining: Math.max(0, limits.monthlyAmountLimit - monthlyAmountUsed),
            usageDayStartUtc: dayStartUtc,
            usageMonthStartUtc: monthStartUtc,
            nextDailyResetUtc: new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000),
            nextMonthlyResetUtc: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0))
        };
    }

    private getPlanLimits(planCode: string): {
        transactionsPerDay: number;
        transactionsPerMonth: number;
        dailyAmountLimit: number;
        monthlyAmountLimit: number;
    } {
        const normalized = this.normalizePlanCode(planCode);
        if (normalized === 'standard') {
            return {
                transactionsPerDay: 5,
                transactionsPerMonth: 50,
                dailyAmountLimit: 300,
                monthlyAmountLimit: 2500
            };
        }
        if (normalized === 'premium') {
            return {
                transactionsPerDay: 10,
                transactionsPerMonth: 100,
                dailyAmountLimit: 500,
                monthlyAmountLimit: 5000
            };
        }
        if (normalized === 'business-plus') {
            return {
                transactionsPerDay: 20,
                transactionsPerMonth: 500,
                dailyAmountLimit: 2000,
                monthlyAmountLimit: 50000
            };
        }

        return {
            transactionsPerDay: 3,
            transactionsPerMonth: 15,
            dailyAmountLimit: 150,
            monthlyAmountLimit: 1500
        };
    }

    private applyPlanState(): void {
        this.plans.forEach((plan) => {
            if (plan.code === this.activePlanCode) {
                plan.isPurchased = false;
                plan.tabText = 'Active';
                plan.cta = 'Active';
                return;
            }

            if (plan.code === this.pendingPlanCode) {
                plan.isPurchased = true;
                plan.tabText = 'Apply Now';
                plan.cta = 'Apply Now';
                return;
            }

            if (plan.code === 'free') {
                plan.isPurchased = false;
                plan.tabText = 'Apply Free';
                plan.cta = 'Apply Free';
                return;
            }

            plan.isPurchased = false;
            plan.tabText = 'Purchase Now';
            plan.cta = 'Purchase Now';
        });
    }

    private extractCards(res: any): any[] {
        if (Array.isArray(res?.result)) {
            return res.result;
        }
        if (Array.isArray(res?.result?.items)) {
            return res.result.items;
        }
        return [];
    }

    private isCardActive(card: any): boolean {
        const status = (card?.status ?? card?.Status ?? '').toString().trim().toLowerCase();
        return status === 'active';
    }

    private normalizePlanCode(value: any): string {
        const normalized = (value ?? '')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/_/g, '-')
            .replace(/\s+/g, '-');

        if (!normalized) {
            return '';
        }

        if (normalized === 'businessplus') {
            return 'business-plus';
        }
        if (normalized.includes('business')) {
            return 'business-plus';
        }
        if (normalized.includes('premium')) {
            return 'premium';
        }
        if (normalized.includes('standard')) {
            return 'standard';
        }
        if (normalized.includes('free')) {
            return 'free';
        }

        return normalized;
    }

    private toSafeNumber(value: any, fallback: number): number {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    private toSafeDate(value: any, fallback: Date): Date {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? fallback : parsed;
    }

    private resolveCardTypeLabel(cardType: any): string {
        if (typeof cardType === 'string' && cardType.trim()) {
            return cardType;
        }

        const typeNumber = Number(cardType);
        if (typeNumber === 0) {
            return 'Visa';
        }
        if (typeNumber === 1) {
            return 'MasterCard';
        }
        if (typeNumber === 2) {
            return 'Amex';
        }

        return 'Card';
    }

    private getPlanDisplayName(planCode: string): string {
        const normalized = this.normalizePlanCode(planCode);
        if (normalized === 'standard') {
            return 'Standard';
        }
        if (normalized === 'premium') {
            return 'Premium';
        }
        if (normalized === 'business-plus') {
            return 'Business Plus';
        }
        return 'Free';
    }

    private resolveActivePlanCode(planCodeFromServer: string): string {
        const normalizedServerPlan = this.normalizePlanCode(planCodeFromServer);
        const persistedPlan = this.getPersistedActivePlanCode();
        const currentPlan = this.normalizePlanCode(this.activePlanCode);

        if (normalizedServerPlan && normalizedServerPlan !== 'free') {
            return normalizedServerPlan;
        }

        // If server unexpectedly reports "free", keep the last paid active plan
        // until user explicitly switches plan.
        if (normalizedServerPlan === 'free' && persistedPlan && persistedPlan !== 'free') {
            return persistedPlan;
        }

        return normalizedServerPlan || persistedPlan || currentPlan || 'free';
    }

    private persistActivePlanCode(planCode: string): void {
        const normalized = this.normalizePlanCode(planCode);
        if (!normalized) {
            return;
        }

        try {
            localStorage.setItem(this.activePlanStorageKey, normalized);
        } catch {
            // Ignore storage failures (private mode / blocked storage).
        }
    }

    private getPersistedActivePlanCode(): string {
        try {
            return this.normalizePlanCode(localStorage.getItem(this.activePlanStorageKey) || '');
        } catch {
            return '';
        }
    }

    private persistActiveCardSnapshot(card: ActiveCardSnapshot | null): void {
        const userId = this.getCurrentUserId();
        if (!userId) {
            return;
        }

        try {
            if (!card) {
                localStorage.removeItem(this.activeCardStorageKey);
                return;
            }

            const payload: PersistedCardSnapshot = { userId, card };
            localStorage.setItem(this.activeCardStorageKey, JSON.stringify(payload));
        } catch {
            // Ignore storage failures.
        }
    }

    private getPersistedActiveCardSnapshot(): ActiveCardSnapshot | null {
        const userId = this.getCurrentUserId();
        if (!userId) {
            return null;
        }

        try {
            const raw = localStorage.getItem(this.activeCardStorageKey);
            if (!raw) {
                return null;
            }

            const parsed = JSON.parse(raw) as PersistedCardSnapshot;
            if (!parsed || parsed.userId !== userId || !parsed.card) {
                return null;
            }

            const cardId = Number(parsed.card.cardId || 0);
            if (!cardId) {
                return null;
            }

            return {
                cardId,
                cardTypeLabel: parsed.card.cardTypeLabel || 'Card',
                holderName: parsed.card.holderName || 'Card Holder',
                cardNumber: parsed.card.cardNumber || '**** **** **** ****',
                expiryDate: parsed.card.expiryDate || '--/--',
                status: parsed.card.status || 'Active',
                activeSubscription: this.getPlanDisplayName(this.activePlanCode)
            };
        } catch {
            return null;
        }
    }

    private getCurrentUserId(): string {
        try {
            return (sessionStorage.getItem('userId') || localStorage.getItem('userId') || '').toString().trim();
        } catch {
            return '';
        }
    }

    private debugLog(message: string, data: any): void {
        console.log('[UpgradePlan]', message, data);
    }
}
