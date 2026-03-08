import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgFor, NgIf, CurrencyPipe, DatePipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ToastService } from '../../shared/toast/toast.service';
import { CardService } from '../../services/card.service';
import { WalletService } from '../../services/wallet.service';
import { Loader } from '../../shared/loader/loader';

@Component({
    selector: 'app-cards',
    standalone: true,
    imports: [NgFor, NgIf, CurrencyPipe, DatePipe, FormsModule, SlicePipe, Loader, RouterLink],
    templateUrl: './cards.html',
    styleUrl: './cards.scss',
})
export class Cards implements OnInit {

    showModal = false;
    isLoading = false;
    totalBalance = 0;
    walletBalance: number | null = null;
    isBalanceLoading = true;
    isCardsLoading = true;
    isApplicationsLoading = true;
    private balancePending = 0;
    private balanceResolved = false;

    // Modal form fields
    fullName = '';
    contact = '';
    address = '';
    cardBrand = 'Visa';
    documentFile: File | null = null;

    cardApplications: any[] = [];
    activeCards: any[] = [];
    inactiveCards: any[] = [];

    constructor(
        private toastService: ToastService,
        private cardService: CardService,
        private walletService: WalletService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadData();
    }

    loadData() {
        this.isBalanceLoading = true;
        this.isCardsLoading = true;
        this.isApplicationsLoading = true;
        this.balancePending = 2;
        this.balanceResolved = false;
        this.cdr.detectChanges();

        // Fetch Wallet Balance (source of truth)
        this.walletService.getMyWallet().subscribe({
            next: (res) => {
                const balance = res?.result?.balance;
                if (typeof balance === 'number') {
                    this.setBalance(balance, true);
                    this.applyWalletBalanceToActiveCards();
                }
                this.markBalanceRequestDone();
            },
            error: (err) => {
                console.error('Cards: Wallet Balance Error:', err);
                this.markBalanceRequestDone();
            }
        });

        // Fetch Card Balance (fallback)
        this.cardService.getBalance().subscribe({
            next: (res) => {
                // Robust mapping for balance
                if (res?.result && this.walletBalance === null) {
                    this.setBalance(res.result.totalBalance ?? 0, false);
                }
                this.markBalanceRequestDone();
            },
            error: (err) => {
                console.error('Cards: Balance Error:', err);
                this.markBalanceRequestDone();
            }
        });

        // Fetch Applications
        this.cardService.getMyApplications().subscribe({
            next: (res) => {
                // Robust mapping for applications
                if (Array.isArray(res?.result)) {
                    this.cardApplications = res.result;
                } else {
                    this.cardApplications = res?.result?.items ?? [];
                }
                this.isApplicationsLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Cards: Applications Error:', err);
                this.isApplicationsLoading = false;
                this.cdr.detectChanges();
            }
        });

        // Fetch Cards
        this.cardService.getUserCards().subscribe({
            next: (res) => {
                let cardsRaw = [];
                if (Array.isArray(res?.result)) {
                    cardsRaw = res.result;
                } else {
                    cardsRaw = res?.result?.items ?? [];
                }

                this.activeCards = cardsRaw.map((c: any) => {
                    const statusRaw = (c?.status ?? c?.Status ?? 'Active').toString().trim().toLowerCase();
                    const isActive = statusRaw === 'active';
                    const balance = (typeof this.walletBalance === 'number' && isActive)
                        ? this.walletBalance
                        : c.balance;
                    const activeSubscription = c.activeSubscription || c.ActiveSubscription || 'Free';
                    const pendingSubscription = c.pendingSubscription || c.PendingSubscription || '';
                    const subscriptionDisplay = pendingSubscription
                        ? `${activeSubscription} (Pending: ${pendingSubscription})`
                        : activeSubscription;

                    return ({
                    id: c.cardId,
                    cardNumber: c.cardNumber,
                    type: c.cardType,
                    balance,
                    expiryDate: c.expiryDate, // 02/29 format
                    expiryFullDate: c.expiryDate,
                    subscriptionType: subscriptionDisplay,
                    subscriptionCode: c.activeSubscriptionCode || c.ActiveSubscriptionCode || 'free',
                    pendingSubscription,
                    pendingSubscriptionCode: c.pendingSubscriptionCode || c.PendingSubscriptionCode || '',
                    status: c.status,
                    holderName: c.holderName || 'Card Holder',
                    showDetails: false,
                    cvv: '***',
                    maskedCardNumber: c.cardNumber,
                    isRevealing: false
                });
                }).sort((a: any, b: any) => {
                    const aActive = this.isCardActive(a);
                    const bActive = this.isCardActive(b);
                    if (aActive !== bActive) {
                        return aActive ? -1 : 1;
                    }
                    return (b.id ?? 0) - (a.id ?? 0);
                });

                this.inactiveCards = this.activeCards.filter(card => !this.isCardActive(card));
                this.isCardsLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Cards: List Error:', err);
                this.toastService.showError('Failed to load cards');
                this.isCardsLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    revealDetails(card: any) {
        if (card.showDetails) {
            // HIDE logic
            card.showDetails = false;
            card.cardNumber = card.maskedCardNumber || card.cardNumber;
            card.cvv = '***';
            this.cdr.detectChanges();
            return;
        }

        // SHOW logic
        card.isRevealing = true;
        this.cardService.getCardSensitiveDetails(card.id).subscribe({
            next: (res) => {
                if (!card.maskedCardNumber) {
                    card.maskedCardNumber = card.cardNumber;
                }
                card.cardNumber = res.result.cardNumber;
                card.cvv = res.result.cvv;
                card.showDetails = true;
                card.isRevealing = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.toastService.showError('Authentication required to reveal details');
                card.isRevealing = false;
                this.cdr.detectChanges();
            }
        });
    }

    isCardActive(card: any): boolean {
        const status = (card?.status ?? card?.Status ?? 'Active').toString().trim().toLowerCase();
        return status === 'active';
    }

    getActiveCardBalance(card: any): number {
        if (this.isCardActive(card) && typeof this.walletBalance === 'number') {
            return this.walletBalance;
        }
        return card?.balance ?? 0;
    }

    private setBalance(value: number, isWallet: boolean) {
        this.totalBalance = value;
        if (isWallet) {
            this.walletBalance = value;
        }
        this.balanceResolved = true;
        this.isBalanceLoading = false;
        this.cdr.detectChanges();
    }

    private markBalanceRequestDone() {
        this.balancePending -= 1;
        if (this.balancePending <= 0 && !this.balanceResolved) {
            this.isBalanceLoading = false;
            this.cdr.detectChanges();
        }
    }

    private applyWalletBalanceToActiveCards() {
        if (typeof this.walletBalance !== 'number' || !this.activeCards?.length) {
            return;
        }
        this.activeCards = this.activeCards.map((card) => ({
            ...card,
            balance: this.isCardActive(card) ? this.walletBalance : card.balance
        }));
        this.inactiveCards = this.activeCards.filter(card => !this.isCardActive(card));
    }

    copyToClipboard(text: string, label: string) {
        navigator.clipboard.writeText(text).then(() => {
            this.toastService.showInfo(`${label} copied to clipboard`);
        });
    }

    openModal() {
        this.cardService.getUserCards().subscribe({
            next: (res) => {
                let cardsRaw = [];
                if (Array.isArray(res?.result)) {
                    cardsRaw = res.result;
                } else {
                    cardsRaw = res?.result?.items ?? [];
                }

                const hasActiveCard = cardsRaw.some((c: any) => (c?.status ?? c?.Status ?? '').toString().trim().toLowerCase() === 'active');
                if (hasActiveCard) {
                    this.toastService.showModal(
                        'You already have an active card. You can proceed to apply for a new one, but your current card will be temporarily inactive during review.',
                        'Active Card Warning',
                        'warning'
                    );
                    return;
                }

                this.showModal = true;
                this.cdr.detectChanges();
            },
            error: () => {
                // If card lookup fails, still allow opening
                this.showModal = true;
                this.cdr.detectChanges();
            }
        });
    }

    closeModal() {
        this.showModal = false;
        this.resetForm();
    }

    resetForm() {
        this.fullName = '';
        this.contact = '';
        this.address = '';
        this.cardBrand = 'Visa';
        this.documentFile = null;
        this.isLoading = false;
    }

    private showApplicationAlert(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'error', title?: string) {
        const resolvedTitle = title || (type === 'success' ? 'APPLICATION SUBMITTED' : 'APPLICATION ERROR');
        this.toastService.showModal(message, resolvedTitle, type);
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            // Validate file type
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(file.type)) {
                this.showApplicationAlert('Only PDF, JPG, JPEG, and PNG files are allowed', 'error', 'UPLOAD ERROR');
                event.target.value = '';
                return;
            }

            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                this.showApplicationAlert('File size must be less than 5MB', 'error', 'UPLOAD ERROR');
                event.target.value = '';
                return;
            }

            this.documentFile = file;
        }
    }

    submitApplication() {
        // Validation
        if (!this.fullName || this.fullName.trim().length < 3) {
            this.showApplicationAlert('Please enter a valid full name (minimum 3 characters)');
            return;
        }

        if (!this.contact || this.contact.trim().length < 10) {
            this.showApplicationAlert('Please enter a valid contact number (minimum 10 digits)');
            return;
        }

        if (!this.address || this.address.trim().length < 10) {
            this.showApplicationAlert('Please enter a valid address (minimum 10 characters)');
            return;
        }

        if (!this.documentFile) {
            this.showApplicationAlert('Please upload a government issued document');
            return;
        }

        const proceedSubmit = () => {
            this.isLoading = true;
            this.cdr.detectChanges();

            // Convert file to Base64
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1]; // Remove data:image/png;base64, prefix
                const fileExtension = this.documentFile!.name.split('.').pop()?.toLowerCase() || 'pdf';

                const payload = {
                    fullName: this.fullName.trim(),
                    contactNumber: this.contact.trim(),
                    address: this.address.trim(),
                    cardType: this.cardBrand,
                    documentBase64: base64,
                    documentType: fileExtension
                };

                this.cardService.submitCardApplication(payload).subscribe({
                    next: (response) => {
                        this.closeModal();
                        this.showApplicationAlert('Your card application has been submitted successfully! Approval typically takes 5-8 hours.', 'success');
                        this.loadData();
                        this.cdr.detectChanges(); // Force detection for global toast trigger
                    },
                    error: (err) => {
                        console.error('Cards: Submit Error:', err);
                        this.showApplicationAlert(err.error?.error?.message || 'Failed to submit application');
                        this.isLoading = false;
                        this.cdr.detectChanges();
                    }
                });
            };

            reader.onerror = () => {
                this.showApplicationAlert('Failed to read file', 'error', 'UPLOAD ERROR');
                this.isLoading = false;
                this.cdr.detectChanges();
            };

            if (!this.documentFile) {
                this.showApplicationAlert('Please upload a government issued document');
                this.isLoading = false;
                this.cdr.detectChanges();
                return;
            }

            reader.readAsDataURL(this.documentFile);
        };

        this.cardService.getUserCards().subscribe({
            next: (res) => {
                let cardsRaw = [];
                if (Array.isArray(res?.result)) {
                    cardsRaw = res.result;
                } else {
                    cardsRaw = res?.result?.items ?? [];
                }

                const hasActiveCard = cardsRaw.some((c: any) => (c?.status ?? c?.Status) === 'Active');
                if (hasActiveCard) {
                    this.toastService.showConfirm(
                        'Active Card Notice',
                        'You already have an active card. It will be set to inactive while this application is reviewed. If approved, the previous card will be deleted. If rejected, it will become active again. Do you want to continue?',
                        () => proceedSubmit()
                    );
                } else {
                    proceedSubmit();
                }
            },
            error: () => {
                // If card lookup fails, still proceed with submission
                proceedSubmit();
            }
        });
    }
}
