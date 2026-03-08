import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../shared/toast/toast.service';
import { CardService } from '../../services/card.service';
import { TransactionService } from '../../services/transaction.service';
import { WalletService } from '../../services/wallet.service';
import { forkJoin } from 'rxjs';
import { Loader } from '../../shared/loader/loader';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink], // Removed individual pipes
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {

  // Initial default values (will show loader)
  walletData = {
    balance: 0,
    walletId: '---',
    currency: 'USD'
  };

  stats = [
    { label: 'Total Credits', value: 0, icon: '⬇️', color: '#1de016' },
    { label: 'Total Debits', value: 0, icon: '⬆️', color: '#ff6b6b' },
    { label: 'Recent Transactions', value: 0, icon: '📊', color: '#ffa500' },
    { label: 'Active Cards', value: 0, icon: '💳', color: '#4a90e2' }
  ];

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
    forkJoin({
      balance: this.cardService.getBalance(),
      wallet: this.walletService.getMyWallet()
    }).subscribe({
      next: (res: any) => {
        if (res.wallet?.result) {
          if (typeof res.wallet.result.balance === 'number') {
            this.walletData.balance = res.wallet.result.balance;
          } else if (res.balance?.result) {
            this.walletData.balance = res.balance.result.totalBalance;
          }
        } else if (res.balance?.result) {
          this.walletData.balance = res.balance.result.totalBalance;
        }
        if (res.wallet?.result?.displayWalletId) {
          this.walletData.walletId = res.wallet.result.displayWalletId;
        } else if (res.wallet?.result?.id) {
          this.walletData.walletId = res.wallet.result.id;
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

    // 2. Load Stats (Cards & History Count)
    forkJoin({
      cards: this.cardService.getUserCards(),
      history: this.transactionService.getHistory(0, 5) // Just for stats count
    }).subscribe({
      next: (res: any) => {
        if (res.history?.result) {
          // We only use this for stats summary now
          const items = res.history.result.items || [];
          const credits = items.filter((t: any) => t.movementType !== 'Debit').reduce((sum: number, t: any) => sum + t.amount, 0);
          const debits = items.filter((t: any) => t.movementType === 'Debit').reduce((sum: number, t: any) => sum + t.amount, 0);

          this.stats[0].value = credits; // Total Credits (approx from recent)
          this.stats[1].value = debits;  // Total Debits (approx)
          this.stats[2].value = res.history.result.totalCount;
        }

        if (res.cards?.result) {
          const cards = Array.isArray(res.cards.result)
            ? res.cards.result
            : (res.cards.result?.items ?? []);
          this.stats[3].value = cards.filter((c: any) => this.isCardActive(c)).length;
        }

        this.isLoadingStats = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Dashboard: Stats Load Error', err);
        this.isLoadingStats = false;
        this.cdr.detectChanges();
      }
    });
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

  private isCardActive(card: any): boolean {
    const status = (card?.status ?? card?.Status ?? '').toString().trim().toLowerCase();
    return status === 'active';
  }
}
