import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AlertService } from '../../../services/alert.service';
import { SellerPayoutMethodService, SaveSellerPayoutMethodInput } from '../../../services/seller-payout-method.service';
import { StoreService } from '../../../services/store.service';
import { catchError, of } from 'rxjs';

@Component({
    selector: 'app-add-payment-method',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './add-payment-method.component.html',
    styleUrl: './add-payment-method.page.scss'
})
export class AddPaymentMethodComponent implements OnInit, OnDestroy {
    private payoutMethodService = inject(SellerPayoutMethodService);
    private alert = inject(AlertService);
    private router = inject(Router);
    private storeService = inject(StoreService);
    private cdr = inject(ChangeDetectorRef);
    private zone = inject(NgZone);

    // Navigation and State
    activeTab: 'bank' | 'thirdparty' = 'bank';
    isSaving: boolean = false;
    isLoadingCurrent: boolean = false;
    currentStore: any = null;
    currentTime = '';
    currentDate = '';
    hourHandRotation = 0;
    minuteHandRotation = 0;
    secondHandRotation = 0;
    private clockTimer: ReturnType<typeof setInterval> | null = null;

    // Bank Form Fields
    bankCountry: string = '';
    bankAccountTitle: string = ''; // Beneficiary Name
    bankAccountNumber: string = '';
    bankName: string = '';
    bankAccountType: string = ''; // e.g. Savings, Checking
    routingNumber: string = '';
    referenceNumber: string = '';

    // Third Party Form Fields
    selectedThirdParty: string = '';
    walletId: string = '';

    // Options
    thirdPartyOptions = [
        { label: 'Big Commerce', value: 'Big Commerce' },
        { label: 'NashPay', value: 'Easy Finora' },
        { label: 'Eastnets', value: 'Eastnets' },
        { label: 'Facilita Pay', value: 'Facilita Pay' },
        { label: 'Paddle', value: 'Paddle' }
    ];

    bankOptions = [
        { label: 'American Express', value: 'American Express' },
        { label: 'Ally Financial', value: 'Ally Financial' },
        { label: 'Atlantic Union Bank', value: 'Atlantic Union Bank' },
        { label: 'Bank of America', value: 'Bank of America' },
        { label: 'BCI Financial Group', value: 'BCI Financial Group' },
        { label: 'BMO USA', value: 'BMO USA' },
        { label: 'Beal Bank', value: 'Beal Bank' },
        { label: 'Capital One', value: 'Capital One' },
        { label: 'Cathay Bank', value: 'Cathay Bank' },
        { label: 'Citizens Financial Group', value: 'Citizens Financial Group' },
        { label: 'East West Bank', value: 'East West Bank' },
        { label: 'Fifth Third Bank', value: 'Fifth Third Bank' },
        { label: 'First Hawaiian Bank', value: 'First Hawaiian Bank' },
        { label: 'First Century Bank', value: 'First Century Bank' },
        { label: 'Glacier Bancorp', value: 'Glacier Bancorp' },
        { label: 'HSBC Bank USA', value: 'HSBC Bank USA' },
        { label: 'Independent Bank', value: 'Independent Bank' },
        { label: 'JPMorgan Chase', value: 'JPMorgan Chase' },
        { label: 'M&T Bank', value: 'M&T Bank' },
        { label: 'New York Community Bank', value: 'New York Community Bank' },
        { label: 'Old National Bank', value: 'Old National Bank' },
        { label: 'RBC Bank', value: 'RBC Bank' },
        { label: 'Santander Bank', value: 'Santander Bank' },
        { label: 'South State Bank', value: 'South State Bank' },
        { label: 'State Street Corporation', value: 'State Street Corporation' },
        { label: 'Sumitomo Mitsui Banking Corporation', value: 'Sumitomo Mitsui Banking Corporation' },
        { label: 'Texas Capital Bank', value: 'Texas Capital Bank' },
        { label: 'The Bank of New York Mellon', value: 'The Bank of New York Mellon' },
        { label: 'U.S. Bancorp', value: 'U.S. Bancorp' },
        { label: 'United Bank (West Virginia)', value: 'United Bank (West Virginia)' },
        { label: 'United Community Bank', value: 'United Community Bank' },
        { label: 'Valley Bank', value: 'Valley Bank' },
        { label: 'Webster Bank', value: 'Webster Bank' },
        { label: 'Western Alliance Bancorporation', value: 'Western Alliance Bancorporation' },
        { label: 'WSFS Bank', value: 'WSFS Bank' }
    ];

    countryOptions = [
        { label: 'United States', value: 'United States' },
        { label: 'Canada', value: 'Canada' },
        { label: 'United Kingdom', value: 'United Kingdom' },
        { label: 'United Arab Emirates', value: 'United Arab Emirates' },
        { label: 'Pakistan', value: 'Pakistan' }
    ];

    private readonly countryBankOptionMap: Record<string, Array<{ label: string; value: string }>> = {
        us: this.bankOptions,
        canada: [
            { label: 'Royal Bank of Canada', value: 'Royal Bank of Canada' },
            { label: 'TD Canada Trust', value: 'TD Canada Trust' },
            { label: 'Scotiabank', value: 'Scotiabank' },
            { label: 'BMO Bank of Montreal', value: 'BMO Bank of Montreal' },
            { label: 'CIBC', value: 'CIBC' }
        ],
        uk: [
            { label: 'Barclays', value: 'Barclays' },
            { label: 'HSBC UK', value: 'HSBC UK' },
            { label: 'Lloyds Bank', value: 'Lloyds Bank' },
            { label: 'NatWest', value: 'NatWest' },
            { label: 'Santander UK', value: 'Santander UK' }
        ],
        uae: [
            { label: 'Emirates NBD', value: 'Emirates NBD' },
            { label: 'Abu Dhabi Commercial Bank', value: 'Abu Dhabi Commercial Bank' },
            { label: 'Dubai Islamic Bank', value: 'Dubai Islamic Bank' },
            { label: 'Mashreq', value: 'Mashreq' },
            { label: 'First Abu Dhabi Bank', value: 'First Abu Dhabi Bank' }
        ],
        pakistan: [
            { label: 'HBL', value: 'HBL' },
            { label: 'UBL', value: 'UBL' },
            { label: 'Meezan Bank', value: 'Meezan Bank' },
            { label: 'MCB Bank', value: 'MCB Bank' },
            { label: 'Bank Alfalah', value: 'Bank Alfalah' },
            { label: 'Allied Bank', value: 'Allied Bank' },
            { label: 'Faysal Bank', value: 'Faysal Bank' },
            { label: 'Bank Al Habib', value: 'Bank Al Habib' }
        ]
    };

    ngOnInit(): void {
        this.storeService.currentStore$.subscribe(store => {
            this.currentStore = store;
        });
        this.storeService.getMyStoreCached(true).pipe(
            catchError(() => of(null))
        ).subscribe((res: any) => {
            this.currentStore = (res as any)?.result || res || this.currentStore;
        });

        this.startClock();
        this.loadCurrentMethod();
    }

    ngOnDestroy(): void {
        if (this.clockTimer) {
            clearInterval(this.clockTimer);
        }
    }

    setTab(tab: 'bank' | 'thirdparty'): void {
        this.activeTab = tab;
    }

    get displayStoreName(): string {
        return this.currentStore?.name || 'Seller Store';
    }

    get normalizedBankCountry(): string {
        const country = (this.bankCountry || '').trim().toLowerCase();
        if (!country) return 'us';
        if (country.includes('pakistan')) return 'pakistan';
        if (country.includes('canada')) return 'canada';
        if (country.includes('united kingdom') || country === 'uk' || country.includes('britain')) return 'uk';
        if (country.includes('united arab emirates') || country === 'uae' || country.includes('emirates')) return 'uae';
        if (country.includes('united states') || country === 'usa' || country === 'us' || country.includes('america')) return 'us';
        return 'us';
    }

    get displayBankOptions(): Array<{ label: string; value: string }> {
        return this.countryBankOptionMap[this.normalizedBankCountry] || this.bankOptions;
    }

    get bankRoutingLabel(): string {
        switch (this.normalizedBankCountry) {
            case 'pakistan':
                return 'Bank Identifier (Optional)';
            case 'canada':
                return 'Transit / Institution Code *';
            case 'uk':
                return 'Sort Code *';
            case 'uae':
                return 'IBAN / Routing Code *';
            default:
                return 'Routing (ABA) *';
        }
    }

    get bankRoutingPlaceholder(): string {
        switch (this.normalizedBankCountry) {
            case 'pakistan':
                return 'Routing code or leave blank';
            case 'canada':
                return '5-digit transit and institution code';
            case 'uk':
                return '6-digit sort code';
            case 'uae':
                return 'Enter routing code';
            default:
                return '9-digit routing number';
        }
    }

    get bankAccountNumberLabel(): string {
        return 'Account Number *';
    }

    get bankAccountNumberPlaceholder(): string {
        switch (this.normalizedBankCountry) {
            case 'pakistan':
                return 'Enter account number';
            case 'uae':
                return 'Enter account number';
            default:
                return 'Full account number';
        }
    }

    get bankAccountTypeLabel(): string {
        return this.normalizedBankCountry === 'pakistan' ? 'Account Category *' : 'Account Type *';
    }

    get bankAccountTypeOptions(): Array<{ label: string; value: string }> {
        switch (this.normalizedBankCountry) {
            case 'pakistan':
                return [
                    { label: 'Current', value: 'current' },
                    { label: 'Saving', value: 'saving' },
                    { label: 'Asaan Account', value: 'asaan' }
                ];
            case 'uk':
                return [
                    { label: 'Personal', value: 'personal' },
                    { label: 'Business', value: 'business' },
                    { label: 'Savings', value: 'savings' }
                ];
            default:
                return [
                    { label: 'Checking', value: 'checking' },
                    { label: 'Savings', value: 'savings' }
                ];
        }
    }

    get beneficiaryNameLabel(): string {
        return this.normalizedBankCountry === 'pakistan' ? 'Account Holder Name *' : 'Beneficiary Name *';
    }

    get beneficiaryNamePlaceholder(): string {
        return this.normalizedBankCountry === 'pakistan'
            ? 'Name as registered with your bank account'
            : 'Name as it appears on account';
    }

    get referenceNumberLabel(): string {
        switch (this.normalizedBankCountry) {
            case 'pakistan':
                return 'Reference / Branch Note (Optional)';
            case 'uae':
                return 'SWIFT / Reference (Optional)';
            default:
                return 'Reference Number (Optional)';
        }
    }

    get referenceNumberPlaceholder(): string {
        switch (this.normalizedBankCountry) {
            case 'pakistan':
                return 'Branch note or internal reference';
            case 'uae':
                return 'SWIFT or any internal reference';
            default:
                return 'Any internal reference';
        }
    }

    savePaymentMethod() {
        if (this.activeTab === 'thirdparty') {
            if (!this.selectedThirdParty) {
                this.alert.warning('Please select a third-party service.');
                return;
            }

            if (this.selectedThirdParty !== 'Easy Finora') {
                this.alert.error('Please use NashPay wallet only');
                return;
            }

            if (!this.walletId.trim()) {
                this.alert.warning('Please enter your Wallet ID.');
                return;
            }
        } else {
            if (!this.bankCountry.trim()) {
                this.alert.warning('Please enter your country.');
                return;
            }

            if (!this.bankName.trim()) {
                this.alert.warning('Please enter your bank name.');
                return;
            }

            if (!this.bankAccountTitle.trim()) {
                this.alert.warning('Please enter the account holder name.');
                return;
            }

            if (!this.bankAccountNumber.trim()) {
                this.alert.warning('Please enter your account number.');
                return;
            }

            if (!this.bankAccountType.trim()) {
                this.alert.warning('Please choose your account type.');
                return;
            }

            if (this.normalizedBankCountry !== 'pakistan' && !this.routingNumber.trim()) {
                this.alert.warning(`Please enter ${this.bankRoutingLabel.replace('*', '').trim().toLowerCase()}.`);
                return;
            }
        }

        const payload = this.buildPayload();
        if (!payload) return;

        this.isSaving = true;
        this.payoutMethodService.saveMyPayoutMethodSafe(payload).pipe(
            catchError((err) => {
                this.isSaving = false;
                this.alert.error(this.extractErrorMessage(err));
                return of(null);
            })
        ).subscribe(async (saved) => {
            if (!saved) return;
            this.isSaving = false;
            this.alert.close();
            const result = await this.alert.success('Payout method updated successfully.');
            if (!result.isConfirmed) {
                return;
            }
            this.alert.forceCleanup();
            await new Promise(resolve => setTimeout(resolve, 50));
            this.router.navigate(['/seller/finances/wallet']);
        });
    }

    private loadCurrentMethod(): void {
        this.isLoadingCurrent = true;
        this.payoutMethodService.getMyPayoutMethodSafe().pipe(
            catchError((err) => {
                this.isLoadingCurrent = false;
                return of(null);
            })
        ).subscribe((method) => {
            this.isLoadingCurrent = false;
            if (!method?.methodKey) return;

            if (method.methodKey === 'bank') {
                this.activeTab = 'bank';
                this.bankCountry = method.country || '';
                this.bankName = method.bankName || '';
                this.routingNumber = method.routingNumber || '';
                this.bankAccountNumber = ''; // Backend masked, user should re-enter
                this.bankAccountTitle = method.accountTitle || '';
                this.bankAccountType = method.accountType || '';
                this.referenceNumber = method.swiftCode || '';
            } else {
                this.activeTab = 'thirdparty';
                // Detect provider if possible, otherwise default to Easy Finora since it's the only one allowed
                this.selectedThirdParty = 'Easy Finora';
                this.walletId = method.walletId || '';
            }
        });
    }

    private buildPayload(): SaveSellerPayoutMethodInput | null {
        if (this.activeTab === 'thirdparty') {
            return {
                methodKey: 'easyfinora', // Always maps to easyfinora for third party allowed selection
                walletId: this.walletId.trim()
            };
        } else {
            return {
                methodKey: 'bank',
                country: this.bankCountry.trim(),
                accountType: this.bankAccountType.trim(),
                bankName: this.bankName.trim(),
                routingNumber: this.routingNumber.trim(),
                accountNumber: this.bankAccountNumber.trim(),
                accountTitle: this.bankAccountTitle.trim(),
                // Additional fields can be mapped to available DTO properties
                swiftCode: this.referenceNumber.trim() // piggyback on swiftCode or similar if backend allows
            };
        }
    }

    private extractErrorMessage(err: any): string {
        return err?.error?.error?.message
            || err?.error?.message
            || err?.message
            || 'Failed to save payout method.';
    }

    private startClock(): void {
        this.updateClock();
        if (this.clockTimer) {
            clearInterval(this.clockTimer);
        }

        this.zone.runOutsideAngular(() => {
            this.clockTimer = setInterval(() => {
                this.zone.run(() => {
                    this.updateClock();
                    this.cdr.markForCheck();
                });
            }, 1000);
        });
    }

    private updateClock(): void {
        const now = new Date();
        this.currentTime = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        this.currentDate = now.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).replace(/ /g, '-').toUpperCase();

        const hours = now.getHours() % 12;
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        this.hourHandRotation = (hours * 30) + (minutes * 0.5);
        this.minuteHandRotation = (minutes * 6) + (seconds * 0.1);
        this.secondHandRotation = seconds * 6;
    }
}
