import { Component, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartService } from '../../services/cart.service';
import { OrderService, CreateOrderDto } from '../../services/order.service';
import { CustomerProfileService } from '../../services/customer-profile.service';
import { StorageService } from '../../services/storage.service';
import { Router } from '@angular/router';
import { OrderProcessBreadcrumb } from '../../shared/components/order-process-breadcrumb/order-process-breadcrumb';
import { ShippingAddress } from '../../shared/components/shipping-address/shipping-address';
import { PaymentMethod } from '../../shared/components/payment-method/payment-method';
import { CheckoutSummary } from '../../shared/components/checkout-summary/checkout-summary';
import { resolvePlatformName } from '../../shared/platform-context';
import Swal from 'sweetalert2';
import { Header } from '../../shared/header/header';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    Header,
    OrderProcessBreadcrumb,
    ShippingAddress,
    PaymentMethod,
    CheckoutSummary
  ],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout {
  public cartService = inject(CartService);
  private orderService = inject(OrderService);
  private profileService = inject(CustomerProfileService);
  private storage = inject(StorageService);
  private router = inject(Router);

  @ViewChild(ShippingAddress) shippingAddressComponent!: ShippingAddress;

  isShippingAddressSaved: boolean = false;
  selectedPaymentMethod: string | null = null;
  selectedPaymentDetails: any = null;
  isLoading: boolean = false;

  // Steps: 0: Cart, 1: Shipping, 2: Payment, 3: Success
  checkoutStep: number = 1;
  savedAddressData: any = null;

  handleAddressSaved() {
    this.savedAddressData = this.shippingAddressComponent.getAddressData();
    this.isShippingAddressSaved = true;
    this.checkoutStep = 2;
  }

  handlePaymentConfirmed(payment: { method: string, details?: any }) {
    this.selectedPaymentMethod = payment.method;
    this.selectedPaymentDetails = payment.details;
    this.handlePlaceOrder();
  }

  handleStepClick(index: number) {
    if (index === 0) {
      this.router.navigate(['/add-to-cart']);
      return;
    }
    // Only allow going to completed steps or current step
    if (index <= this.checkoutStep) {
      this.checkoutStep = index;
    }
  }

  nextStep() {
    if (this.checkoutStep === 1) {
      if (this.isShippingAddressSaved) {
        console.log('[Checkout] \uD83D\uDE9A Address Step Saved. Moving to Step 2.');
        this.checkoutStep = 2;
      } else {
        this.shippingAddressComponent.saveAddress();
      }
    }
  }

  get canPlaceOrder(): boolean {
    return this.isShippingAddressSaved && !!this.selectedPaymentMethod && !this.isLoading;
  }

  async handlePlaceOrder() {
    if (!this.isShippingAddressSaved || !this.selectedPaymentMethod) return;

    this.isLoading = true;

    try {
      let currentUser: any = {};
      try {
        currentUser = JSON.parse(this.storage.getItem('currentUser') || '{}');
      } catch {
        currentUser = {};
      }

      const resolvedUserId = Number(currentUser.id || this.storage.getItem('userId'));
      if (!Number.isInteger(resolvedUserId) || resolvedUserId <= 0) {
        throw new Error('User ID not found.');
      }

      let profileId = localStorage.getItem('customerProfileId');
      if (!profileId) {
        const profileRes = await this.profileService.getByUserId(resolvedUserId).toPromise();
        profileId = profileRes?.result?.id;
      }

      const address = this.savedAddressData || this.shippingAddressComponent?.getAddressData();
      if (!address) throw new Error("Please complete the shipping address step first.");

      const sourcePlatform = resolvePlatformName();
      const normalizedPaymentMethod =
        sourcePlatform === 'PrimeShip' && (this.selectedPaymentMethod === 'card' || this.selectedPaymentMethod === 'finora')
          ? 'finora'
          : this.selectedPaymentMethod!;

      const orderInput: CreateOrderDto = {
        userId: resolvedUserId,
        paymentMethod: normalizedPaymentMethod,
        shippingAddress: address.address1,
        country: address.location || 'UK',
        state: address.state,
        city: address.city,
        postalCode: address.zip,
        recipientName: `${address.firstName} ${address.lastName}`,
        recipientPhone: address.phone,
        recipientEmail: address.email,
        shippingCost: 0,
        discount: 0,
        sourcePlatform,
        cardNumber: this.selectedPaymentDetails?.number?.replace(/\s/g, ''),
        cvv: this.selectedPaymentDetails?.cvv,
        expiryDate: this.selectedPaymentDetails?.expiry,
        items: (this.cartService.items() || [])
          .filter(item => item.isChecked)
          .map(item => ({
            storeProductId: item.storeProductId,
            storeId: item.storeId,
            quantity: item.quantity,
            priceAtPurchase: item.price,
            productName: item.name,
            storeName: item.storeName
          }))
      };

      console.log('[Checkout] \uD83D\uDCB3 Placing Order with Payload:', orderInput);

      this.orderService.createOrder(orderInput).subscribe({
        next: (res) => {
          console.log('[Checkout] \u2705 Order Placed Successfully!', res);
          this.isLoading = false;
          this.triggerConfetti();
          Swal.fire({
            title: '<strong>ORDER CONFIRMED!</strong>',
            html: `Thank you for your purchase! Your order has been placed securely${this.selectedPaymentMethod === 'finora' ? ' with <b>Nosh Pay</b>' : ''}.`,
            icon: 'success',
            showConfirmButton: false,
            timer: 3000,
            background: '#111',
            color: '#ffc107',
            padding: '40px',
            timerProgressBar: true,
            customClass: {
              title: 'nosh-success-title',
              popup: 'nosh-success-popup'
            }
          }).then(() => {
            this.cartService.clearCart();
            this.router.navigate(['/customer/dashboard']);
          });
        },
        error: (err) => {
          this.isLoading = false;
          Swal.fire({
            icon: 'error',
            title: 'Order Failed',
            text: err.error?.error?.message || 'Something went wrong.'
          });
        }
      });

    } catch (error: any) {
      this.isLoading = false;
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message
      });
    }
  }

  private triggerConfetti() {
    const colors = ['#ffc107', '#ff4500', '#2e7d32', '#4285F4', '#eb001b'];
    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'nosh-confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.width = (Math.random() * 10 + 5) + 'px';
        confetti.style.height = (Math.random() * 10 + 5) + 'px';
        confetti.style.animationDelay = (Math.random() * 2) + 's';
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        document.body.appendChild(confetti);
        
        // Remove after animation
        setTimeout(() => confetti.remove(), 5000);
    }
  }
}
