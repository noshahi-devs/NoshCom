import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { CardService } from '../../../core/services/card.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { WalletService } from '../../../core/services/wallet.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-seller-wallet',
  standalone: true,
  imports: [CommonModule, RouterLink], 
  templateUrl: './seller-wallet.component.html',
  styleUrl: './seller-wallet.component.scss',
})
export class SellerWalletComponent implements OnInit {

  // Initial default values (will show loader)
  walletData = {
    balance: 0,
    walletId: '---',
    currency: 'USD'
  };

  stats = [
    { label: 'Total Credits', value: 0, iconClass: 'fas fa-arrow-down', color: '#1de016' },
    { label: 'Total Debits', value: 0, iconClass: 'fas fa-arrow-up', color: '#ff6b6b' },
    { label: 'Recent Transactions', value: 0, iconClass: 'fas fa-history', color: '#ffa500' }
  ];

  recentTransactions: any[] = [];
  isLoadingHistory = true;
  activeFilter = 'All';

  // Localized Loaders
  isLoadingBalance = true;
  isLoadingStats = true;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private cardService: CardService,
    private transactionService: TransactionService,
    private walletService: WalletService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    // Load live data in background, but don't block UI
    this.loadData();
  }

  loadData() {
    // 1. Load Balance & Wallet
    this.walletService.getMyWallet().subscribe({
      next: (res: any) => {
        if (res.result) {
          if (typeof res.result.balance === 'number') {
            this.walletData.balance = res.result.balance;
          }
        }
        if (res.result?.displayWalletId) {
          this.walletData.walletId = res.result.displayWalletId;
        } else if (res.result?.id) {
          this.walletData.walletId = res.result.id;
        }
        this.isLoadingBalance = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Dashboard: Balance Load Error', err);
        this.isLoadingBalance = false;
        this.cdr.detectChanges();
      }
    });

    // 2. Load Stats (History Count - load 50 for robust filtering)
    this.transactionService.getHistory(0, 50).subscribe({
      next: (res: any) => {
        if (res.result) {
          // We only use this for stats summary now
          const items = res.result.items || [];
          const credits = items.filter((t: any) => t.movementType !== 'Debit').reduce((sum: number, t: any) => sum + t.amount, 0);
          const debits = items.filter((t: any) => t.movementType === 'Debit').reduce((sum: number, t: any) => sum + t.amount, 0);

          this.stats[0].value = credits; // Total Credits (approx from recent)
          this.stats[1].value = debits;  // Total Debits (approx)
          this.stats[2].value = res.result.totalCount;

          // Process recent transactions for display
          const rawItems = res.result.items || [];
          this.recentTransactions = rawItems.map((t: any) => ({
            id: t.id,
            type: this.normalizeType(t),
            amount: t.movementType === 'Debit' ? -t.amount : t.amount,
            status: t.status || 'Approved',
            date: t.creationTime,
            description: t.description
          }));
        }

        this.isLoadingStats = false;
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Dashboard: Stats Load Error', err);
        this.isLoadingStats = false;
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      }
    });
  }

  setFilter(filter: string) {
    this.activeFilter = filter;
    this.cdr.detectChanges();
  }

  get filteredTransactions() {
    if (this.activeFilter === 'All') return this.recentTransactions;
    return this.recentTransactions.filter((t: any) => {
      if (this.activeFilter === 'Deposit') return t.type === 'Deposit';
      if (this.activeFilter === 'Withdrawals') return t.type === 'Withdrawal';
      if (this.activeFilter === 'Transfer') return t.type === 'Transfer';
      return true;
    });
  }

  private normalizeType(t: any): string {
    const category = (t.category || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    
    if (category === 'deposit' || desc.includes('deposit')) return 'Deposit';
    if (category === 'withdrawal' || desc.includes('withdraw') || desc.includes('payout')) return 'Withdrawal';
    if (category === 'transfer' || desc.includes('transfer')) return 'Transfer';
    return 'Transaction';
  }

  copyWalletId() {
    if (!this.walletData.walletId || this.walletData.walletId === '---') return;

    navigator.clipboard.writeText(this.walletData.walletId).then(() => {
      this.toastService.showSuccess('Wallet ID copied to clipboard!');
    }).catch(err => {
      console.error('Could not copy text: ', err);
      this.toastService.showError('Failed to copy Wallet ID');
    });
  }

  logout() {
    this.authService.logout();
    this.toastService.showSuccess('Logged out successfully');
    this.router.navigate(['/auth'], { replaceUrl: true });
  }
}
