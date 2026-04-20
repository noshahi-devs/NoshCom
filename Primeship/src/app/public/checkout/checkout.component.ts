import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CartService, CartItem } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { ProfileService } from '../../core/services/profile.service';
import { WholesaleService, CreateWholesaleOrderInput } from '../../core/services/wholesale.service';
import { CardService } from '../../core/services/card.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit {
  checkoutForm: FormGroup;
  cartItems: CartItem[] = [];
  subtotal = 0;
  shipping = 0;
  tax = 0;
  total = 0;
  platformCharges = 0;
  shippingMethodFee = 0;

  // States
  showCelebration = false;
  isProcessing = false;
  isSuccess = false;
  placedOrderNumber: string | null = null;
  trackingNumber: string | null = null;
  private suppressEmptyCartRedirectOnce = false;

  isAddressSubmitted = false;
  isPaymentSubmitted = false;
  selectedShippingMethod: 'in_store' | 'warehouse' | null = 'in_store';

  get currentStep(): 1 | 2 | 3 {
    if (this.isPaymentSubmitted) return 3;
    if (this.isAddressSubmitted) return 2;
    return 1;
  }

  get stepperProgressScale(): 0 | 0.5 | 1 {
    if (this.currentStep === 1) return 0;
    if (this.currentStep === 2) return 0.5;
    return 1;
  }

  // Easy Finora Integration
  isVerifyingBalance = false;
  isBalanceVerified = false;
  verifiedBalance: number | null = null;
  verificationError: string | null = null;
  profileCardHolderName = '';

  // Confetti
  confettiPieces = Array(100).fill(0);

  paymentMethods = [
    { id: 'mastercard', name: 'Master Card', icon: 'fab fa-cc-mastercard', logoSrc: 'assets/brands/mastercard.svg' },
    { id: 'discover', name: 'Discover', icon: 'fab fa-cc-mastercard', logoSrc: 'assets/brands/discover.svg' },
    { id: 'amex', name: 'American Express', icon: 'fab fa-cc-mastercard', logoSrc: 'assets/brands/amex.svg' },
    { id: 'easy_finora', name: 'NoshPay', icon: 'fas fa-wallet', logoSrc: 'assets/brands/easy-finora.svg' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private cartService: CartService,
    private toastService: ToastService,
    private profileService: ProfileService,
    private wholesaleService: WholesaleService,
    private cardService: CardService,
    private cdr: ChangeDetectorRef
  ) {
    this.checkoutForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: [''],
      country: [''],
      address1: ['', Validators.required],
      address2: [''],
      zipCode: ['', Validators.required],
      city: ['', Validators.required],
      paymentMethod: ['mastercard', Validators.required],
      cardHolderName: [''],
      cardNumber: [''],
      expiryDate: [''],
      cvv: [''],
      bankAccountName: [''],
      bankAccountNumber: [''],
      cryptoWalletAddress: ['']
    });

    this.checkoutForm.get('paymentMethod')?.valueChanges.subscribe(method => {
      this.resetPaymentFields();
      this.updatePaymentValidations(method);
    });

    this.updatePaymentValidations(this.checkoutForm.get('paymentMethod')?.value);
    this.setupMasking();
  }

  private setupMasking(): void {
    this.checkoutForm.get('cardNumber')?.valueChanges.subscribe(val => {
      if (!val) return;
      let numeric = val.replace(/\D/g, '');
      if (numeric.length > 16) numeric = numeric.substring(0, 16);
      const masked = numeric.match(/.{1,4}/g)?.join(' ') || numeric;
      if (val !== masked) {
        this.checkoutForm.get('cardNumber')?.setValue(masked, { emitEvent: false });
      }
    });

    this.checkoutForm.get('expiryDate')?.valueChanges.subscribe(val => {
      if (!val) return;
      let clean = val.replace(/\D/g, '');
      if (clean.length >= 1 && !['0', '1'].includes(clean[0])) clean = '';
      if (clean.length >= 2) {
        const month = parseInt(clean.substring(0, 2));
        if (month > 12) clean = clean.substring(0, 1);
      }
      if (clean.length > 4) clean = clean.substring(0, 4);
      let masked = clean;
      if (clean.length > 2) masked = clean.substring(0, 2) + '/' + clean.substring(2);
      if (val !== masked) this.checkoutForm.get('expiryDate')?.setValue(masked, { emitEvent: false });
    });

    this.checkoutForm.get('cvv')?.valueChanges.subscribe(val => {
      if (!val) return;
      let numeric = val.replace(/\D/g, '');
      if (numeric.length > 4) numeric = numeric.substring(0, 4);
      if (val !== numeric) this.checkoutForm.get('cvv')?.setValue(numeric, { emitEvent: false });
    });
  }

  private updatePaymentValidations(method: string): void {
    const cardControls = ['cardHolderName', 'cardNumber', 'expiryDate', 'cvv'];
    const bankControls = ['bankAccountName', 'bankAccountNumber'];
    const cryptoControls = ['cryptoWalletAddress'];

    [...cardControls, ...bankControls, ...cryptoControls].forEach(ctrl => {
      this.checkoutForm.get(ctrl)?.clearValidators();
      this.checkoutForm.get(ctrl)?.updateValueAndValidity();
    });

    if (['mastercard', 'discover', 'amex', 'easy_finora'].includes(method)) {
      this.checkoutForm.get('cardHolderName')?.setValidators([Validators.required, Validators.pattern(/^[A-Za-z][A-Za-z\s.'-]*$/)]);
      this.checkoutForm.get('cardNumber')?.setValidators([Validators.required, Validators.pattern(/^\d{4} \d{4} \d{4} \d{4}$/)]);
      this.checkoutForm.get('expiryDate')?.setValidators([Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]);
      this.checkoutForm.get('cvv')?.setValidators([Validators.required, Validators.pattern(/^\d{3,4}$/)]);
    } else if (method === 'bank_transfer') {
      bankControls.forEach(ctrl => this.checkoutForm.get(ctrl)?.setValidators([Validators.required]));
    } else if (method === 'crypto') {
      cryptoControls.forEach(ctrl => this.checkoutForm.get(ctrl)?.setValidators([Validators.required]));
    }

    [...cardControls, ...bankControls, ...cryptoControls].forEach(ctrl => {
      this.checkoutForm.get(ctrl)?.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    this.loadProfile();
    this.loadCartData();
  }

  private resetPaymentFields(): void {
    this.checkoutForm.patchValue({
      cardHolderName: '',
      cardNumber: '',
      expiryDate: '',
      cvv: '',
      bankAccountName: '',
      bankAccountNumber: '',
      cryptoWalletAddress: ''
    }, { emitEvent: false });
    this.isBalanceVerified = false;
    this.verifiedBalance = null;
    this.verificationError = null;
  }

  get displayCardHolderName(): string {
    const first = (this.checkoutForm.get('firstName')?.value || '').toString().trim();
    const last = (this.checkoutForm.get('lastName')?.value || '').toString().trim();
    const formName = [first, last].filter(Boolean).join(' ').trim();
    return formName || this.profileCardHolderName || 'Card Holder';
  }

  get selectedPaymentMethodName(): string {
    const selected = this.checkoutForm.get('paymentMethod')?.value;
    const match = this.paymentMethods.find(m => m.id === selected);
    return match?.name || 'Card';
  }

  get cardLast4(): string {
    const raw = (this.checkoutForm.get('cardNumber')?.value || '').toString();
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 4 ? digits.slice(-4) : '';
  }

  private isNoshPaySelected(): boolean {
    return this.checkoutForm.get('paymentMethod')?.value === 'easy_finora';
  }

  private showNoshPayOnlyPopup(): void {
    void Swal.fire({
      icon: 'info',
      title: 'In Progress',
      text: 'Use only NoshPay method.',
      confirmButtonText: 'OK',
      confirmButtonColor: '#10B981'
    });
  }

  private loadProfile(): void {
    this.profileService.getMyProfile().subscribe({
      next: (profile) => {
        if (!profile) return;
        const patch: Partial<{
          firstName: string;
          lastName: string;
          email: string;
          phoneNumber: string;
          country: string;
          address1: string;
          city: string;
          zipCode: string;
          cardHolderName: string;
        }> = {};
        const fullName = (profile.fullName || '').trim();
        if (fullName) {
          this.profileCardHolderName = fullName;
          const [first, ...rest] = fullName.split(' ');
          const last = rest.join(' ').trim();
          if (!this.checkoutForm.get('firstName')?.value) {
            patch.firstName = first || '';
          }
          if (!this.checkoutForm.get('lastName')?.value) {
            patch.lastName = last || '';
          }
          if (!this.checkoutForm.get('cardHolderName')?.value) {
            patch.cardHolderName = fullName;
          }
        }
        if (!this.checkoutForm.get('email')?.value && profile.email) {
          patch.email = profile.email;
        }
        if (!this.checkoutForm.get('phoneNumber')?.value && profile.phoneNumber) {
          patch.phoneNumber = profile.phoneNumber;
        }
        if (!this.checkoutForm.get('country')?.value && profile.country) {
          patch.country = profile.country;
        }
        if (!this.checkoutForm.get('address1')?.value && profile.addressLine1) {
          patch.address1 = profile.addressLine1;
        }
        if (!this.checkoutForm.get('city')?.value && profile.city) {
          patch.city = profile.city;
        }
        if (!this.checkoutForm.get('zipCode')?.value && profile.postalCode) {
          patch.zipCode = profile.postalCode;
        }
        if (Object.keys(patch).length > 0) {
          this.checkoutForm.patchValue(patch);
        }
      },
      error: () => {
        // profile is optional; ignore errors
      }
    });
  }

  private loadCartData(): void {
    this.cartService.cartItems$.subscribe(items => {
      const sanitized = this.sanitizeCartItems(items);
      if (sanitized.removed > 0) {
        this.cartService.setCartItems(sanitized.items);
        this.toastService.showError('Some items were removed from cart due to missing product data.');
      }
      this.cartItems = sanitized.items;
      this.calculateTotals();
      if (this.cartItems.length === 0) {
        if (this.showCelebration || this.isProcessing || this.isSuccess) {
          return;
        }
        if (this.suppressEmptyCartRedirectOnce) {
          this.suppressEmptyCartRedirectOnce = false;
          return;
        }
        this.toastService.showInfo('Your cart is empty. Please add items to continue.');
        this.router.navigate(['/cart']);
      }
    });
  }

  private calculateTotals(): void {
    this.subtotal = this.cartService.getCartTotal();

    if (this.subtotal === 0) {
      this.shipping = 0;
      this.tax = 0;
      this.total = 0;
      return;
    }

    // Shipping based on selection
    this.shipping = 0.00; // always 0 as requested
    this.shippingMethodFee = this.selectedShippingMethod === 'warehouse' ? 1.00 : 0.00;
    this.platformCharges = 0.00;
    this.tax = 0.00;
    this.total = this.subtotal + this.shippingMethodFee + this.platformCharges + this.tax;
    return;
  }

  get shippingMethodLabel(): string {
    return this.selectedShippingMethod === 'warehouse' ? 'Nearest Warehouse' : 'In-Store Pickup';
  }

  verifyEasyFinoraBalance(): void {
    const cardNumber = this.checkoutForm.get('cardNumber')?.value;
    const expiryDate = this.checkoutForm.get('expiryDate')?.value;
    const cvv = this.checkoutForm.get('cvv')?.value;

    if (!cardNumber || !expiryDate || !cvv) {
      this.toastService.showError('Please enter full card details to verify balance');
      return;
    }

    this.isVerifyingBalance = true;
    this.verificationError = null;
    this.isBalanceVerified = false;
    this.cdr.detectChanges();

    this.cardService.validateCard({
      cardNumber,
      expiryDate,
      cvv,
      amount: this.total,
      sourcePlatform: 'PrimeShip'
    }).subscribe({
      next: (result) => {
        this.isVerifyingBalance = false;
        if (result.isValid) {
          this.isBalanceVerified = true;
          this.verifiedBalance = this.normalizeBalance(result.availableBalance);
          this.toastService.showSuccess('Card balance verified! You can now place the order.');
        } else {
          this.verificationError = result.message;
          this.toastService.showError(result.message);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isVerifyingBalance = false;
        if (this.handleAuthError(err)) return;
        this.verificationError = 'Verification failed. Please check card info.';
        this.toastService.showError('Could not verify card balance');
        this.cdr.detectChanges();
      }
    });
  }

  private normalizeBalance(balance: number): number {
    const numeric = typeof balance === 'number' ? balance : parseFloat((balance as any) ?? '');
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
    return balance as any;
  }

  saveAddress(): void {
    if (!this.selectedShippingMethod) {
      this.toastService.showError('Please select a delivery method');
      return;
    }

    const shippingControls = ['firstName', 'lastName', 'email', 'address1', 'city', 'zipCode'];
    const isShippingValid = shippingControls.every((name) => this.checkoutForm.get(name)?.valid);

    if (isShippingValid) {
      this.isAddressSubmitted = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.toastService.showError('Please fill in all required fields');
      shippingControls.forEach((name) => this.checkoutForm.get(name)?.markAsTouched());
    }
  }

  editAddress(): void {
    this.isAddressSubmitted = false;
    this.selectedShippingMethod = 'in_store';
    this.calculateTotals();
  }

  selectShippingMethod(method: 'in_store' | 'warehouse'): void {
    this.selectedShippingMethod = method;
    this.calculateTotals();
  }

  setPaymentMethod(methodId: string): void {
    this.checkoutForm.get('paymentMethod')?.setValue(methodId);
  }

  proceedToReview(): void {
    if (this.cartItems.length === 0) {
      this.toastService.showError('Your cart is empty.');
      this.router.navigate(['/cart']);
      return;
    }
    if (this.checkoutForm.valid && this.isAddressSubmitted && this.selectedShippingMethod) {
      if (!this.isNoshPaySelected()) {
        this.showNoshPayOnlyPopup();
        return;
      }
      this.isPaymentSubmitted = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.toastService.showError('Please ensure all details are filled correctly before proceeding to review.');
    }
  }

  goBackToPayment(): void {
    this.isPaymentSubmitted = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onSubmit(): void {
    if (this.cartItems.length === 0) {
      this.toastService.showError('Your cart is empty.');
      this.router.navigate(['/cart']);
      return;
    }
    const sanitized = this.sanitizeCartItems(this.cartItems);
    if (sanitized.items.length === 0) {
      this.toastService.showError('Your cart contains invalid items. Please add products again.');
      this.router.navigate(['/cart']);
      return;
    }
    if (!this.isNoshPaySelected()) {
      this.showNoshPayOnlyPopup();
      this.goBackToPayment();
      return;
    }
    if (this.checkoutForm.valid && this.isAddressSubmitted && this.selectedShippingMethod) {
      this.isProcessing = true;
      this.isSuccess = false;
      this.showCelebration = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.cdr.detectChanges();

      const val = this.checkoutForm.value;
      const fullAddress = val.address2
        ? `${val.address1}, ${val.address2}, ${val.city}, ${val.zipCode}`
        : `${val.address1}, ${val.city}, ${val.zipCode}`;

      const orderInput: CreateWholesaleOrderInput = {
        items: sanitized.items.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          purchasePrice: item.product.price || item.product.supplierPrice || 0
        })),
        shippingAddress: fullAddress,
        customerName: `${val.firstName} ${val.lastName}`,
        paymentMethod: val.paymentMethod,
        cardNumber: val.cardNumber,
        expiryDate: val.expiryDate,
        cvv: val.cvv
      };

      this.wholesaleService.placeWholesaleOrder(orderInput).subscribe({
        next: (res) => {
          this.isProcessing = false;
          this.isSuccess = true;

          this.placedOrderNumber = this.resolvePlacedOrderNumber(res);
          this.trackingNumber = this.normalizeTrackingNumber(this.resolveTrackingNumber(res));
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isProcessing = false;
          this.isSuccess = false;
          this.showCelebration = false;
          this.cdr.detectChanges();
          console.error('Wholesale checkout failed:', err);
          if (this.handleAuthError(err)) return;
          const errorMsg = err.error?.error?.message || 'Failed to place wholesale order.';
          this.toastService.showError(errorMsg);
        }
      });
    } else {
      this.toastService.showError('Please fill in all required fields correctly');
      Object.keys(this.checkoutForm.controls).forEach(key => {
        const control = this.checkoutForm.get(key);
        if (control?.invalid) control.markAsTouched();
      });
    }
  }

  private handleAuthError(err: any): boolean {
    const msg = err?.error?.error?.message || err?.message || '';
    const status = err?.status;
    if (status === 401 || status === 403 || msg.includes('Current user did not login')) {
      this.toastService.showError('Your session expired. Please login again.');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return true;
    }
    return false;
  }

  acknowledgeSuccess(): void {
    this.suppressEmptyCartRedirectOnce = true;
    this.cartService.clearCart();
    this.showCelebration = false;
    this.isSuccess = false;
    this.isProcessing = false;
    this.cdr.detectChanges();
  }

  viewMyOrders(): void {
    this.suppressEmptyCartRedirectOnce = true;
    this.cartService.clearCart();
    this.showCelebration = false;
    this.isSuccess = false;
    this.isProcessing = false;
    this.router.navigate(['/seller/orders']);
  }

  private sanitizeCartItems(items: CartItem[]): { items: CartItem[]; removed: number } {
    const emptyGuid = '00000000-0000-0000-0000-000000000000';
    const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const validItems = (items || []).filter(item => {
      const candidates = [
        item?.product?.productId,
        item?.product?.ProductId,
        item?.product?.id,
        item?.product?.storeProductId
      ].map(v => (v ?? '').toString()).filter(v => v && v !== emptyGuid && guidRegex.test(v));
      if (candidates.length === 0) return false;
      item.product.id = candidates[0];
      return true;
    });
    return { items: validItems, removed: (items?.length || 0) - validItems.length };
  }

  private resolvePlacedOrderNumber(source: any): string {
    const direct = [
      source?.referenceCode,
      source?.orderNumber,
      source?.id
    ].find((value: any) => (typeof value === 'string' || typeof value === 'number') && `${value}`.trim().length > 0);

    if (direct !== undefined) {
      return `${direct}`.trim();
    }

    return `ORD-${new Date().getTime().toString().slice(-8)}`;
  }

  private resolveTrackingNumber(source: any): string {
    const direct = [
      source?.trackingCode,
      source?.deliveryTrackingNumber,
      source?.primeShipTrackingNumber,
      source?.trackingNumber,
      source?.trackingNo,
      source?.order?.trackingCode,
      source?.order?.deliveryTrackingNumber,
      source?.order?.primeShipTrackingNumber
    ].find((value: any) => (typeof value === 'string' || typeof value === 'number') && `${value}`.trim().length > 0);

    if (direct !== undefined) {
      return `${direct}`.trim();
    }

    const deepValue = this.findTrackingDeep(source, 0);
    return deepValue || 'Tracking will be assigned shortly';
  }

  private normalizeTrackingNumber(raw: string): string {
    const value = (raw || '').toString().trim();
    if (!value) {
      return value;
    }

    if (this.isNewTrackingFormat(value)) {
      return value;
    }

    const digitsOnly = value.replace(/\D/g, '');
    if (!digitsOnly) {
      return value;
    }

    const initials = this.extractTrackingInitials(this.getPrimaryProductName());
    const tenDigits = digitsOnly.length >= 10
      ? digitsOnly.slice(-10)
      : digitsOnly.padStart(10, '0');

    return `UK-${initials}${tenDigits}`;
  }

  private isNewTrackingFormat(value: string): boolean {
    return /^UK-[A-Z]{2}\d{10}$/.test(value);
  }

  private extractTrackingInitials(name: string): string {
    const letters = (name || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    if (!letters) {
      return 'XX';
    }
    return `${letters[0]}${letters[letters.length - 1]}`;
  }

  private getPrimaryProductName(): string {
    for (const item of this.cartItems || []) {
      const name = (item?.product?.name || '').toString().trim();
      if (name) {
        return name;
      }
    }
    return '';
  }

  private findTrackingDeep(node: any, depth: number): string {
    if (!node || depth > 4 || typeof node !== 'object') {
      return '';
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = this.findTrackingDeep(item, depth + 1);
        if (found) {
          return found;
        }
      }
      return '';
    }

    for (const [key, value] of Object.entries(node)) {
      if (key.toLowerCase().includes('tracking') && (typeof value === 'string' || typeof value === 'number')) {
        const normalized = `${value}`.trim();
        if (normalized.length > 0) {
          return normalized;
        }
      }
    }

    for (const value of Object.values(node)) {
      const found = this.findTrackingDeep(value, depth + 1);
      if (found) {
        return found;
      }
    }

    return '';
  }
}
