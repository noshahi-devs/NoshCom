import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor, CurrencyPipe, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { DepositService } from '../../../core/services/deposit.service';
import { WalletService } from '../../../core/services/wallet.service';
import { DatePipe } from '@angular/common';

interface DepositHistoryRow {
    id: string;
    referenceId?: string;
    type: string;
    amount: number;
    status: string;
    date: string;
    description: string;
    method?: string;
    country?: string;
}

interface BankAccount {
    id: number;
    country: string;
    currency: string;
    accountNumber: string;
    flag: string;
    region: string;
    accountHolder: string;
    bankName: string;
    branchName: string;
    iban: string;
    routingNumber?: string;
    sortCode?: string;
    ifscCode?: string;
    bankAddress: string;
    receiverNumber: string;
    lastPaymentDate?: string;
}

@Component({
    selector: 'app-seller-deposit',
    imports: [FormsModule, CommonModule, DatePipe, CurrencyPipe],
    templateUrl: './seller-deposit.component.html',
    styleUrl: './seller-deposit.component.scss',
})
export class SellerDepositComponent implements OnInit {

    showDepositForm = false;
    
    // Deposit history
    filterType = 'all';
    allDepositRows: DepositHistoryRow[] = [];
    currentPage = 1;
    maxResultCount = 10;
    private readonly minTransactionIdLength = 8;
    private readonly transactionIdPrefix = 'EF';

    // Main flow state
    depositMethod: 'p2p' | 'crypto' | 'cards' | null = null;
    private _enteredUsdAmount: number | null = null;
    get enteredUsdAmount(): number | null { return this._enteredUsdAmount; }
    set enteredUsdAmount(value: number | null) {
        if (value !== this._enteredUsdAmount) {
            console.log(`[TRACE] USD AMOUNT CHANGED: Current: ${this._enteredUsdAmount}, New: ${value}`);
            if (value && value > 0) {
                console.trace('Tracing USD Amount Change Path:');
            }
            this._enteredUsdAmount = value;
            this.cdr.detectChanges();
        }
    }

    isLoading = false;
    walletBalance: number | null = null;
    exchangeRates: any = {};
    localAmount: number = 0;
    localCurrency: string = 'USD';

    // Flow state: 0 = method overview, 1+ = payment steps
    currentStep = 0;

    constructor(
        private toastService: ToastService,
        private depositService: DepositService,
        private walletService: WalletService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadWalletBalance();
        this.fetchExchangeRates();
        this.loadDepositHistory();
    }

    fetchExchangeRates() {
        fetch('https://open.er-api.com/v6/latest/USD')
            .then(res => res.json())
            .then(data => {
                this.exchangeRates = data.rates;
                console.log('Deposit: Exchange Rates:', this.exchangeRates);
                this.cdr.detectChanges();
            })
            .catch(err => console.error('Deposit: Fetch Rates Error:', err));
    }



    loadWalletBalance() {
        this.walletService.getMyWallet().subscribe({
            next: (res) => {
                const balance = res?.result?.balance;
                if (typeof balance === 'number') {
                    this.walletBalance = balance;
                }
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Deposit: Wallet Balance Error:', err);
            }
        });
    }

    getWalletBalanceDisplay(): number {
        return typeof this.walletBalance === 'number' ? this.walletBalance : 0;
    }
    selectedAccount: BankAccount | null = null;
    paymentConfirmed = false;
    proofFile: File | null = null;
    paymentId: string = '';

    // Cards & Other Methods
    selectedCard: string | null = null;
    showCardModal = false;

    // Card form data
    cardDetails = {
        holderName: '',
        cardNumber: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: ''
    };

    // Crypto form data
    cryptoProofFile: File | null = null;

    paymentMethods = [
        { value: 'p2p', label: 'P2P Payments', icon: '🏦' },
        { value: 'crypto', label: 'Pay Via Crypto (Binance)', icon: '🟡' },
        { value: 'cards', label: 'Cards & Other Methods', icon: '💳' }
    ];

    paymentMethodsGrid = [
        { id: 'mastercard', name: 'MasterCard', gradient: 'linear-gradient(135deg, rgb(247, 158, 27), rgb(235, 0, 27))', functional: false, iconSrc: 'assets/images/mastercard.png', iconAlt: 'MasterCard' },
        { id: 'discover', name: 'Discover', gradient: 'linear-gradient(135deg, rgb(255, 96, 0), rgb(255, 153, 0))', functional: false, iconClass: 'fa-brands fa-cc-discover', iconAlt: 'Discover' },
        { id: 'p2p', name: 'P2P', gradient: 'linear-gradient(135deg, rgb(102, 126, 234), rgb(118, 75, 162))', functional: true, iconSrc: 'assets/images/bankofamerica.png', iconAlt: 'P2P Bank' },
        { id: 'crypto', name: 'Crypto via Binance', gradient: 'linear-gradient(135deg, rgb(247, 147, 26), rgb(242, 169, 0))', functional: true, iconSrc: 'assets/images/binance.svg', iconAlt: 'Binance' },
        { id: 'gpay', name: 'Google Pay', gradient: 'linear-gradient(135deg, rgb(66, 133, 244), rgb(52, 168, 83))', functional: false, iconSrc: 'assets/images/google.png', iconAlt: 'Google Pay' },
        { id: 'amex', name: 'American Express', gradient: 'linear-gradient(135deg, rgb(0, 111, 207), rgb(0, 163, 224))', functional: false, iconClass: 'fa-brands fa-cc-amex', iconAlt: 'American Express' }
    ];

    cryptoWalletAddress = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';

    bankAccounts: BankAccount[] = [
        // North American
        {
            id: 1,
            country: 'United States',
            currency: 'USD',
            accountNumber: 'XX-7750',
            flag: 'https://flagcdn.com/w80/us.png',
            region: 'North American',
            accountHolder: 'Henry Thomas',
            bankName: 'JPMorgan Chase Bank',
            branchName: 'New York Branch',
            iban: 'US11650926969232757750',
            routingNumber: '021000021',
            bankAddress: 'JPMorgan Chase Bank, 270 Park Avenue, New York, NY 10017, USA',
            receiverNumber: '212 571 1298'
        },
        {
            id: 2,
            country: 'Canada',
            currency: 'CAD',
            accountNumber: 'XX-0072',
            flag: 'https://flagcdn.com/w80/ca.png',
            region: 'North American',
            accountHolder: 'Leo Andrew',
            bankName: 'Royal Bank of Canada (RBC)',
            branchName: 'Cal-Dealer Loans-c/o Village Sq',
            iban: 'CA71000673034017030072',
            routingNumber: '000304390',
            bankAddress: '2640 52nd St NE-Unit 100, 1499 West Broadway St, Calgary, Canada',
            receiverNumber: '403 962 3015'
        },
        // European
        {
            id: 3,
            country: 'United Kingdom',
            currency: 'GBP',
            accountNumber: 'XX-9243',
            flag: 'https://flagcdn.com/w80/gb.png',
            region: 'European',
            accountHolder: 'Jack Robert',
            bankName: 'Barclays Bank',
            branchName: 'Manchester Branch',
            iban: 'GB29BARC09911172169243',
            sortCode: '231782',
            bankAddress: 'Barclays Bank, 1 Churchill Place, London, E14 5HP, United Kingdom',
            receiverNumber: '7868 740942'
        },
        {
            id: 4,
            country: 'France',
            currency: 'EUR',
            accountNumber: 'XX-3787',
            flag: 'https://flagcdn.com/w80/fr.png',
            region: 'European',
            accountHolder: 'Jean Dupont',
            bankName: 'BNP Paribas',
            branchName: 'Paris Branch',
            iban: 'FR1425381180755384571493787',
            sortCode: '231782',
            bankAddress: 'BNP Paribas, 16 Boulevard des Italiens, 75009 Paris, France',
            receiverNumber: '0635 342887'
        },
        {
            id: 5,
            country: 'Germany',
            currency: 'EUR',
            accountNumber: 'XX-3900',
            flag: 'https://flagcdn.com/w80/de.png',
            region: 'European',
            accountHolder: 'Hans Müller',
            bankName: 'Deutsche Bank',
            branchName: 'Frankfurt Branch',
            iban: 'DE89370490660532013900',
            sortCode: '405081',
            bankAddress: 'Deutsche Bank, Frankfurt Branch, Frankfurt am Main, Germany',
            receiverNumber: '0170 3097225'
        },
        // UAE
        {
            id: 6,
            country: 'Dubai',
            currency: 'AED',
            accountNumber: 'XX-9829',
            flag: 'https://flagcdn.com/w80/ae.png',
            region: 'UAE',
            accountHolder: 'Ahmed Al-Mansoori',
            bankName: 'Emirates NBD',
            branchName: 'Downtown Branch',
            iban: 'AE0740078100749737735349',
            bankAddress: 'Emirates NBD, Downtown Branch, Dubai, UAE',
            receiverNumber: '050 475 9256'
        },
        // Asian
        {
            id: 7,
            country: 'Saudi Arabia',
            currency: 'SAR',
            accountNumber: 'XX-5263',
            flag: 'https://flagcdn.com/w80/sa.png',
            region: 'Asian',
            accountHolder: 'Khalid Al-Farsi',
            bankName: 'National Commercial Bank (NCB)',
            branchName: 'Riyadh Branch',
            iban: 'SA1228366922701637327415263',
            sortCode: '231782',
            bankAddress: 'National Commercial Bank, Riyadh Branch, Riyadh, Saudi Arabia',
            receiverNumber: '055 293 3491'
        },
        {
            id: 8,
            country: 'Turkey',
            currency: 'TRY',
            accountNumber: 'XX-2045',
            flag: 'https://flagcdn.com/w80/tr.png',
            region: 'Asian',
            accountHolder: 'Ahmet Yılmaz',
            bankName: 'Garanti BBVA',
            branchName: 'Kadıköy Branch',
            iban: 'TR125828978225023362142045',
            sortCode: '231782',
            bankAddress: 'Garanti BBVA, Kadıköy Branch, Istanbul, Turkey',
            receiverNumber: '0532 295 42802'
        },
        {
            id: 9,
            country: 'Pakistan',
            currency: 'PKR',
            accountNumber: 'XX-0011',
            flag: 'https://flagcdn.com/w80/pk.png',
            region: 'Asian',
            accountHolder: 'SHAN ALI',
            bankName: 'Allied Bank Limited',
            branchName: 'Allama Iqbal Town Branch, Lahore',
            iban: 'PK72ABPA0010140687020011',
            bankAddress: 'G78V+RC6, Gulshan Block Allama Iqbal Town, Lahore, Punjab, Pakistan',
            receiverNumber: '212 571 1298'
        },
        {
            id: 10,
            country: 'India',
            currency: 'INR',
            accountNumber: 'XX-0239',
            flag: 'https://flagcdn.com/w80/in.png',
            region: 'Asian',
            accountHolder: 'Ramesh Gupta',
            bankName: 'State Bank of India (SBI)',
            branchName: 'Connaught Place Branch',
            iban: 'GB29BARC09911172169243',
            ifscCode: 'SBIN0083102',
            bankAddress: 'State Bank of India, Connaught Place Branch, New Delhi - 110001, India',
            receiverNumber: '9820 972 006'
        },
        {
            id: 11,
            country: 'Bangladesh',
            currency: 'BDT',
            accountNumber: 'XX-4090',
            flag: 'https://flagcdn.com/w80/bd.png',
            region: 'Asian',
            accountHolder: 'Nasiruddin Ahmed',
            bankName: 'Dutch-Bangla Bank Limited',
            branchName: 'Gulshan Branch, Code 1101',
            iban: 'BD12DBBL33809218174090',
            bankAddress: 'Dutch-Bangla Bank Limited, Gulshan Branch, Dhaka 1212, Bangladesh',
            receiverNumber: '018 589 04367'
        },
        {
            id: 12,
            country: 'Sri Lanka',
            currency: 'LKR',
            accountNumber: 'XX-2104',
            flag: 'https://flagcdn.com/w80/lk.png',
            region: 'Asian',
            accountHolder: 'Mahesh De Silva',
            bankName: 'Commercial Bank of Ceylon',
            branchName: 'Colombo 11 Branch',
            iban: 'LK12934828199576034267352104',
            bankAddress: 'COLOMBO GOLD CENTRE COMPLEX, NO 180/27, N H M ABDUL CADER ROAD, COLOMBO 11, Sri Lanka',
            receiverNumber: '041 228 3145'
        }
    ];


    get regions() {
        return [...new Set(this.bankAccounts.map(acc => acc.region))];
    }

    getAccountsByRegion(region: string) {
        return this.bankAccounts.filter(acc => acc.region === region);
    }

    get shouldShowPaymentCards(): boolean {
        // Always show if no method is selected yet
        return !this.depositMethod;
    }

    selectAccount(account: BankAccount) {
        this.selectedAccount = account;
        this.updateConversion();
        this.currentStep = 2;
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.proofFile = file;
        }
    }

    goToStep(step: number) {
        if (step < this.currentStep) {
            this.currentStep = step;
        }
    }

    proceedToProof() {
        // Validation for step 2
        if (!this.paymentConfirmed) {
            this.toastService.showError('Please confirm that you have sent the payment');
            return;
        }

        if (!this.enteredUsdAmount || this.enteredUsdAmount <= 0) {
            this.toastService.showError('Please enter a valid amount greater than 0');
            return;
        }

        if (this.enteredUsdAmount < 10) {
            this.toastService.showError('Minimum deposit amount is $10');
            return;
        }

        this.currentStep = 3;
    }

    submitDeposit() {
        // Validation for step 3
        if (!this.proofFile) {
            this.toastService.showError('Please upload proof of payment');
            return;
        }

        if (!this.paymentId || this.paymentId.trim().length === 0) {
            this.toastService.showError('Please Send Transection ID');
            return;
        }



        this.isLoading = true;
        this.cdr.detectChanges();

        this.toBase64(this.proofFile).then(base64 => {
            const input = {
                amount: this.enteredUsdAmount || 0, // Raw USD - "Don't touch"
                localAmount: this.localAmount, // Explicit Converted Value
                localCurrency: this.localCurrency,
                country: this.selectedAccount?.country || 'Unknown',
                method: 'P2P',
                proofImage: base64,
                referenceId: this.paymentId // Map paymentId to referenceId for backend
            };

            console.log('DEPOSIT PAYLOAD (P2P):', input);

            console.log('Deposit: Submit Payload (P2P):', input);

            this.depositService.submitDepositRequest(input).subscribe({
                next: (res) => {
                    console.log('Deposit: Submit Response (P2P):', res);
                    this.toastService.showSuccess(
                        `Your P2P deposit request for $${this.enteredUsdAmount} (${this.localAmount} ${this.localCurrency}) has been submitted successfully.`
                    );
                    this.resetForm();
                    this.router.navigate(['/seller/wallet']);
                },
                error: (err) => {
                    console.error('Deposit: Submit Error (P2P):', err);
                    this.toastService.showError(err.error?.error?.message || 'Failed to submit deposit request');
                    this.isLoading = false;
                    this.cdr.detectChanges();
                }
            });
        });
    }

    submitCryptoDeposit() {
        if (!this.cryptoProofFile) {
            this.toastService.showError('Please upload transaction proof');
            return;
        }



        this.isLoading = true;
        this.cdr.detectChanges();

        this.toBase64(this.cryptoProofFile).then(base64 => {
            const input = {
                amount: this.enteredUsdAmount || 0,
                localAmount: this.enteredUsdAmount || 0,
                localCurrency: 'USD',
                country: 'Crypto',
                method: 'Crypto',
                proofImage: base64
            };

            console.log('DEPOSIT PAYLOAD (Crypto):', input);

            console.log('Deposit: Submit Payload (Crypto):', input);

            this.depositService.submitDepositRequest(input).subscribe({
                next: (res) => {
                    console.log('Deposit: Submit Response (Crypto):', res);
                    this.toastService.showSuccess(
                        `Your crypto deposit request for $${this.enteredUsdAmount} USD has been submitted successfully.`
                    );
                    this.closeModal();
                    this.resetForm();
                    this.router.navigate(['/seller/wallet']);
                },
                error: (err) => {
                    console.error('Deposit: Submit Error (Crypto):', err);
                    this.toastService.showError(err.error?.error?.message || 'Failed to submit crypto deposit request');
                    this.isLoading = false;
                    this.cdr.detectChanges();
                }
            });
        });
    }

    private toBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    }

    resetForm() {
        this.currentStep = 0;
        this.selectedAccount = null;
        this.paymentConfirmed = false;
        this.cryptoPaymentConfirmed = false;
        this.enteredUsdAmount = null;
        this.localAmount = 0;
        this.localCurrency = 'USD';
        this.proofFile = null;
        this.paymentId = '';
        this.isLoading = false;
        this.depositMethod = null;
        this.selectedCard = null;
        this.showCardModal = false;
        this.cryptoProofFile = null;
    }

    validateAmount(): boolean {
        if (!this.enteredUsdAmount || this.enteredUsdAmount <= 0) {
            this.toastService.showError('Please enter a valid amount');
            return false;
        }
        if (this.enteredUsdAmount < 10) {
            this.toastService.showError('Minimum deposit amount is $10');
            return false;
        }
        return true;
    }

    onAmountChange(newVal: any) {
        console.log('[DEBUG] User Entered Amount:', newVal);
        this.updateConversion();
    }

    updateConversion() {
        const currency = this.selectedAccount?.currency || 'USD';
        this.localCurrency = currency;

        // If USD, return raw amount EXACTLY with zero math
        if (currency === 'USD') {
            this.localAmount = (this.enteredUsdAmount || 0);
            return;
        }

        const rate = this.exchangeRates[currency] || 1;
        const raw = (this.enteredUsdAmount || 0) * rate;

        if (currency === 'PKR') {
            this.localAmount = Math.round(raw);
        } else {
            // For other currencies, keep 2 decimal precision
            this.localAmount = Math.round(raw * 100) / 100;
        }
    }

    proceedWithPayment() {
        if (!this.validateAmount()) return;

        if (this.depositMethod === 'crypto') {
            this.currentStep = 2; // Jump to Pay Step for Crypto
        } else {
            this.currentStep = 1; // Bank selection for P2P
        }
    }

    proceedWithP2P() {
        if (!this.validateAmount()) return;
        // Show existing P2P flow (bank selection)
        this.currentStep = 1;
    }

    selectPaymentCard(cardId: string) {
        // 1. Validation: Must enter amount first
        if (!this.enteredUsdAmount || this.enteredUsdAmount <= 0) {
            this.toastService.showError('Please enter the deposit amount first');
            return;
        }

        if (this.enteredUsdAmount < 10) {
            this.toastService.showError('Minimum deposit amount is $10');
            return;
        }

        // 2. Logic: Only P2P and Crypto are functional
        const functionalIds = ['p2p', 'crypto'];
        
        if (functionalIds.includes(cardId)) {
            const mappedMethod = cardId as 'p2p' | 'crypto';
            
            this.startSupportedMethod(mappedMethod);
            return;
        }

        // 3. Others: Show specific error message
        this.toastService.showInfo(
            'This method is currently unavailable in your region. Please use P2P Pakistan, Global P2P, or Binance Pay for instant deposits.'
        );
    }

    private startSupportedMethod(method: 'p2p' | 'crypto') {
        this.depositMethod = method;
        this.currentStep = method === 'p2p' ? 1 : 2;
        this.selectedCard = null;
        this.showCardModal = false;
        this.paymentConfirmed = false;
        this.cryptoPaymentConfirmed = false;
        this.proofFile = null;
        this.cryptoProofFile = null;
        this.paymentId = '';
        this.cdr.detectChanges();
    }

    closeModal() {
        this.showCardModal = false;
        this.selectedCard = null;
        // Clear form data
        this.cardDetails = {
            holderName: '',
            cardNumber: '',
            expiryMonth: '',
            expiryYear: '',
            cvv: ''
        };
    }

    submitCardPayment() {
        const card = this.paymentMethodsGrid.find(c => c.id === this.selectedCard);

        if (card?.functional && (this.selectedCard === 'p2p' || this.selectedCard === 'crypto')) {
            this.closeModal();
            this.startSupportedMethod(this.selectedCard as 'p2p' | 'crypto');
            return;
        } else {
            this.toastService.showError(
                'This payment method is still in progress. Please use Easy Finora P2P or Crypto via Binance.'
            );
            this.closeModal();
        }
    }

    onCryptoFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                this.toastService.showError('File size must be less than 5MB');
                return;
            }
            this.cryptoProofFile = file;
        }
    }

    copyWalletAddress() {
        navigator.clipboard.writeText(this.cryptoWalletAddress);
        this.toastService.showSuccess('Wallet address copied to clipboard!');
    }

    copyToClipboard(text: string) {
        navigator.clipboard.writeText(text);
        this.toastService.showSuccess('Binance ID copied to clipboard!');
    }

    formatCardNumber() {
        // Format card number with spaces
        let value = this.cardDetails.cardNumber.replace(/\s/g, '');
        let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
        this.cardDetails.cardNumber = formattedValue.substring(0, 19); // Max 16 digits + 3 spaces
    }

    get selectedCardName(): string {
        const card = this.paymentMethodsGrid.find(c => c.id === this.selectedCard);
        return card?.name || '';
    }

    get convertedAmount(): number {
        const currency = this.selectedAccount?.currency || 'USD';

        // If USD, return raw amount EXACTLY with zero math
        if (currency === 'USD') return (this.enteredUsdAmount || 0);

        const rate = this.exchangeRates[currency] || 1;
        const raw = (this.enteredUsdAmount || 0) * rate;

        if (currency === 'PKR') {
            return Math.round(raw);
        }

        // For other currencies, keep 2 decimal precision
        return Math.round(raw * 100) / 100;
    }

    cryptoPaymentConfirmed = false;

    proceedToCryptoProof() {
        if (!this.cryptoPaymentConfirmed) {
            this.toastService.showError('Please confirm that you have completed the payment process');
            return;
        }
        this.currentStep = 3;
    }

    submitCryptoDepositAlternative() {
        if (!this.proofFile) {
            this.toastService.showError('Please upload proof of payment');
            return;
        }

        if (!this.paymentId || this.paymentId.trim().length === 0) {
            this.toastService.showError('Please Send Transaction ID');
            return;
        }



        this.isLoading = true;
        this.cdr.detectChanges();

        this.toBase64(this.proofFile).then(base64 => {
            const input = {
                amount: this.enteredUsdAmount || 0,
                localAmount: this.enteredUsdAmount || 0,
                localCurrency: 'USD',
                country: 'Crypto',
                method: 'Crypto',
                proofImage: base64,
                referenceId: this.paymentId
            };

            this.depositService.submitDepositRequest(input).subscribe({
                next: (res) => {
                    this.toastService.showSuccess(
                        `Your crypto deposit request for $${this.enteredUsdAmount} USD has been submitted successfully.`
                    );
                    this.resetForm();
                    this.router.navigate(['/seller/wallet']);
                },
                error: (err) => {
                    this.toastService.showError(err.error?.error?.message || 'Failed to submit deposit request');
                    this.isLoading = false;
                    this.cdr.detectChanges();
                }
            });
        });
    }
    toggleDepositView() {
        this.showDepositForm = !this.showDepositForm;
        if (!this.showDepositForm) {
            this.currentPage = 1;
            this.loadDepositHistory();
            this.loadWalletBalance();
        }
    }

    loadDepositHistory() {
        this.isLoading = true;
        this.cdr.detectChanges();

        this.depositService.getMyDepositRequests(0, 500).subscribe({
            next: (res: any) => {
                const rawItems = res?.result?.items ?? [];
                this.allDepositRows = rawItems.map((d: any) => this.mapDepositRow(d));
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err: any) => {
                console.error('Deposit history load error:', err);
                this.allDepositRows = [];
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    private mapDepositRow(d: any): DepositHistoryRow {
        const method = (d.method || 'P2P').toString();
        const country = (d.country || '').toString();
        const referenceId = (d.referenceId || '').toString().trim();
        const status = (d.status || 'Pending').toString();
        const parts = [method];
        if (country) parts.push(country);
        if (referenceId) parts.push(`Ref: ${referenceId}`);

        return {
            id: d.id?.toString() ?? '',
            referenceId: referenceId || undefined,
            type: 'Deposit',
            amount: Math.abs(Number(d.amount) || 0),
            status,
            date: d.creationTime,
            description: parts.join(' · '),
            method,
            country
        };
    }

    changePage(page: number) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.cdr.detectChanges();
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

    get totalCount(): number {
        return this.filteredDeposits.length;
    }

    get filteredDeposits(): DepositHistoryRow[] {
        if (this.filterType === 'all') return this.allDepositRows;
        return this.allDepositRows.filter(t => this.matchesFilter(t, this.filterType));
    }

    get paginatedDeposits(): DepositHistoryRow[] {
        const start = (this.currentPage - 1) * this.maxResultCount;
        return this.filteredDeposits.slice(start, start + this.maxResultCount);
    }

    get skeletonRows(): number[] {
        return Array.from({ length: this.maxResultCount }, (_, index) => index);
    }

    setFilter(type: string) {
        this.filterType = type;
        this.currentPage = 1;
        this.cdr.detectChanges();
    }

    private matchesFilter(transaction: any, filter: string): boolean {
        const status = (transaction?.status || '').toString().trim().toLowerCase();
        return status === filter.toLowerCase();
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

    getDisplayTransactionId(row: DepositHistoryRow): string {
        const referenceId = this.normalizeTransactionIdValue(row?.referenceId);
        if (referenceId) return this.formatTransactionId(referenceId);
        const transactionId = this.normalizeTransactionIdValue(row?.id);
        if (!transactionId) return '';
        return this.formatTransactionId(transactionId);
    }

    getTransactionIdTooltip(row: DepositHistoryRow): string {
        const referenceId = this.normalizeTransactionIdValue(row?.referenceId);
        const transactionId = this.normalizeTransactionIdValue(row?.id);
        if (referenceId && transactionId && referenceId !== transactionId) {
            return `Reference: ${referenceId}\nRequest: ${transactionId}`;
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

}
