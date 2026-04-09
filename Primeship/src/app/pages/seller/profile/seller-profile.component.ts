import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { OrderService } from '../../../core/services/order.service';
import { ToastService } from '../../../core/services/toast.service';

interface SellerProfileDraft {
  displayName: string;
  businessName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  website: string;
  taxId: string;
  bio: string;
}

interface SellerProfilePreferences {
  autoConfirmOrders: boolean;
  emailAlerts: boolean;
  smsAlerts: boolean;
  showPublicCatalog: boolean;
}

@Component({
  selector: 'app-seller-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './seller-profile.component.html',
  styleUrl: './seller-profile.component.scss'
})
export class SellerProfileComponent implements OnInit {
  private readonly storageKey = 'sellerProfileDraft';

  loadingStats = false;
  totalOrders = 0;
  deliveredOrders = 0;
  activeOrders = 0;
  totalValue = 0;
  lastOrderDateLabel = 'No recent activity';

  sellerProfile: SellerProfileDraft = {
    displayName: '',
    businessName: '',
    email: '',
    phone: '',
    city: '',
    address: '',
    website: '',
    taxId: '',
    bio: ''
  };

  preferences: SellerProfilePreferences = {
    autoConfirmOrders: false,
    emailAlerts: true,
    smsAlerts: false,
    showPublicCatalog: true
  };

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    this.initializeIdentity();
    this.loadDraft();
    this.loadStats();
  }

  get completionRate(): number {
    if (!this.totalOrders) {
      return 0;
    }
    return Math.round((this.deliveredOrders / this.totalOrders) * 100);
  }

  get displayInitials(): string {
    const source = (this.sellerProfile.displayName || this.sellerProfile.businessName || 'Seller').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return 'SL';
    }

    if (parts.length === 1) {
      const word = parts[0].replace(/[^A-Za-z]/g, '').toUpperCase();
      return (word.slice(0, 2) || 'SL');
    }

    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }

  syncStats(): void {
    this.loadStats(true);
  }

  saveProfile(): void {
    this.persistDraft();
    this.toastService.showSuccess('Seller profile saved successfully.');
  }

  updatePassword(): void {
    this.toastService.showInfo('Password update flow will be connected here.');
  }

  private initializeIdentity(): void {
    const firstName = (this.authService.getUserFirstName() || '').trim();
    const userName = (this.authService.getUserName() || '').trim();
    const email = (this.authService.getUserEmail() || localStorage.getItem('userEmail') || '').trim();

    const displayName = firstName || userName || 'Seller Partner';
    this.sellerProfile.displayName = displayName;
    this.sellerProfile.businessName = `${displayName} Trading`;
    this.sellerProfile.email = email;
  }

  private loadStats(showToast = false): void {
    this.loadingStats = true;

    this.orderService.getAllForSupplier().subscribe({
      next: (orders: any[]) => {
        const list = orders || [];
        this.totalOrders = list.length;
        this.deliveredOrders = list.filter((order) => {
          const status = (order?.status || '').toLowerCase();
          return status === 'delivered' || status === 'settled';
        }).length;
        this.activeOrders = list.filter((order) => {
          const status = (order?.status || '').toLowerCase();
          return ['pending', 'purchased', 'verified', 'processing', 'shipped'].includes(status);
        }).length;
        this.totalValue = list.reduce((sum, order) => sum + this.resolveOrderTotal(order), 0);

        const latestDate = this.resolveLatestOrderDate(list);
        this.lastOrderDateLabel = latestDate ? latestDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No recent activity';

        this.loadingStats = false;
        if (showToast) {
          this.toastService.showSuccess('Profile metrics updated.');
        }
      },
      error: () => {
        this.loadingStats = false;
        this.toastService.showError('Unable to load profile metrics right now.');
      }
    });
  }

  private resolveOrderTotal(order: any): number {
    if (!order) {
      return 0;
    }

    if (typeof order.totalPurchaseAmount === 'number') {
      return order.totalPurchaseAmount;
    }

    if (typeof order.totalAmount === 'number') {
      return order.totalAmount;
    }

    const items = order.items || order.orderItems || [];
    return items.reduce((sum: number, item: any) => {
      const qty = item.qty || item.quantity || 0;
      const price = item.purchasePrice || item.price || item.priceAtPurchase || 0;
      return sum + (qty * price);
    }, 0);
  }

  private resolveLatestOrderDate(orders: any[]): Date | null {
    let latest: Date | null = null;
    for (const order of orders) {
      const raw = order?.creationTime || order?.createdAt;
      if (!raw) {
        continue;
      }

      const current = new Date(raw);
      if (Number.isNaN(current.getTime())) {
        continue;
      }

      if (!latest || current > latest) {
        latest = current;
      }
    }

    return latest;
  }

  private loadDraft(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (parsed?.sellerProfile && typeof parsed.sellerProfile === 'object') {
        this.sellerProfile = { ...this.sellerProfile, ...parsed.sellerProfile };
      }
      if (parsed?.preferences && typeof parsed.preferences === 'object') {
        this.preferences = { ...this.preferences, ...parsed.preferences };
      }
    } catch {
      // Ignore malformed local cache and continue with defaults.
    }
  }

  private persistDraft(): void {
    const payload = {
      sellerProfile: this.sellerProfile,
      preferences: this.preferences
    };

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      this.toastService.showWarning('Profile saved for this session only (storage unavailable).');
    }
  }
}

