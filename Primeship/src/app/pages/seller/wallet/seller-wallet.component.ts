import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { WalletService } from '../../../core/services/wallet.service';
import { DepositService } from '../../../core/services/deposit.service';
import { WithdrawService } from '../../../core/services/withdraw.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface WalletTxn {
  id: string;
  type: 'Deposit' | 'Withdrawal' | 'Transfer' | 'Transaction';
  amount: number;
  status: string;
  date: string;
  description: string;
}

interface DailyActivityPoint {
  label: string;
  shortLabel: string;
  deposit: number;
  withdraw: number;
  transfer: number;
}

@Component({
  selector: 'app-seller-wallet',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './seller-wallet.component.html',
  styleUrl: './seller-wallet.component.scss',
})
export class SellerWalletComponent implements OnInit {

  walletData = {
    balance: 0,
    walletId: '---',
    currency: 'USD'
  };

  totalDeposits = 0;
  totalWithdrawals = 0;
  totalTransfers = 0;
  transactionCount = 0;
  pendingDepositsAmount = 0;
  pendingDepositsCount = 0;
  monthChangePercent = 0;

  dailyActivity: DailyActivityPoint[] = [];
  breakdownSlices: { label: string; amount: number; color: string; percent: number; displayPercent: string }[] = [];
  donutGradient = 'conic-gradient(#e2e8f0 0% 100%)';

  recentTransactions: WalletTxn[] = [];
  isLoadingHistory = true;
  activeFilter = 'All';

  isLoadingBalance = true;
  isLoadingStats = true;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private transactionService: TransactionService,
    private walletService: WalletService,
    private depositService: DepositService,
    private withdrawService: WithdrawService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.loadData();
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((e) => {
      if (e.urlAfterRedirects === '/seller/wallet' || e.urlAfterRedirects.endsWith('/seller/wallet')) {
        this.loadData();
      }
    });
  }

  loadData() {
    this.isLoadingBalance = true;
    this.isLoadingStats = true;
    this.isLoadingHistory = true;

    forkJoin({
      wallet: this.walletService.getMyWallet().pipe(catchError(() => of(null))),
      history: this.transactionService.getHistory(0, 500).pipe(catchError(() => of(null))),
      deposits: this.depositService.getMyDepositRequests(0, 500).pipe(catchError(() => of(null))),
      withdrawals: this.withdrawService.getMyWithdrawRequests(0, 500).pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ wallet, history, deposits, withdrawals }) => {
        const walletResult = wallet?.result ?? wallet;
        if (walletResult && typeof walletResult.balance === 'number') {
          this.walletData.balance = walletResult.balance;
        }
        this.walletData.walletId = walletResult?.displayWalletId || walletResult?.walletId || this.walletData.walletId;

        const historyItems = history?.result?.items ?? [];
        const depositItems = deposits?.result?.items ?? [];
        const withdrawItems = withdrawals?.result?.items ?? [];

        this.recentTransactions = this.mergeActivity(
          historyItems.map((t: any) => this.mapHistoryItem(t)),
          withdrawItems.map((w: any) => this.mapWithdrawRequest(w)),
          depositItems.map((d: any) => this.mapDepositRequest(d))
        );

        this.computeTotals(this.recentTransactions, depositItems, withdrawItems);
        this.dailyActivity = this.buildDailyActivity(this.recentTransactions, depositItems, withdrawItems);
        this.buildDonut(depositItems, withdrawItems, this.recentTransactions);

        this.isLoadingBalance = false;
        this.isLoadingStats = false;
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingBalance = false;
        this.isLoadingStats = false;
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      }
    });
  }

  private mapWithdrawRequest(w: any): WalletTxn {
    const status = (w.status || 'Pending').toString();
    const method = (w.method || 'Withdrawal').toString();
    return {
      id: `wr-${w.id}`,
      type: 'Withdrawal',
      amount: -Math.abs(Number(w.amount) || 0),
      status,
      date: w.creationTime,
      description: `${method} withdrawal · ${status}`
    };
  }

  private mapDepositRequest(d: any): WalletTxn {
    const status = (d.status || 'Pending').toString();
    const method = (d.method || 'Deposit').toString();
    return {
      id: `dr-${d.id}`,
      type: 'Deposit',
      amount: Math.abs(Number(d.amount) || 0),
      status,
      date: d.creationTime,
      description: `${method} deposit · ${status}`
    };
  }

  private mergeActivity(history: WalletTxn[], withdrawals: WalletTxn[], deposits: WalletTxn[]): WalletTxn[] {
    const seen = new Set<string>();
    return [...history, ...withdrawals, ...deposits]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter((t) => {
        const key = `${t.type}|${Math.abs(t.amount)}|${new Date(t.date).toISOString().slice(0, 16)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  private mapHistoryItem(t: any): WalletTxn {
    const type = this.normalizeType(t);
    const isDebit = (t.movementType || '').toLowerCase() === 'debit' || type === 'Withdrawal';
    return {
      id: t.id,
      type,
      amount: isDebit ? -Math.abs(Number(t.amount) || 0) : Math.abs(Number(t.amount) || 0),
      status: t.status || 'Approved',
      date: t.creationTime,
      description: t.description || type
    };
  }

  private computeTotals(transactions: WalletTxn[], depositRequests: any[], withdrawRequests: any[]): void {
    const approvedDepositsFromRequests = depositRequests
      .filter((d) => this.normalizeStatus(d?.status) === 'approved')
      .reduce((sum, d) => sum + Math.abs(Number(d?.amount) || 0), 0);

    const walletDepositSum = transactions
      .filter((t) => t.type === 'Deposit' && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    this.totalDeposits = Math.max(approvedDepositsFromRequests, walletDepositSum);

    const withdrawFromTransactions = transactions
      .filter((t) => t.type === 'Withdrawal')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const withdrawFromRequests = withdrawRequests
      .reduce((sum, w) => sum + Math.abs(Number(w?.amount) || 0), 0);

    this.totalWithdrawals = Math.max(withdrawFromTransactions, withdrawFromRequests);

    this.totalTransfers = transactions
      .filter((t) => t.type === 'Transfer')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    this.pendingDepositsAmount = depositRequests
      .filter((d) => this.normalizeStatus(d?.status) === 'pending')
      .reduce((sum, d) => sum + Math.abs(Number(d?.amount) || 0), 0);
    this.pendingDepositsCount = depositRequests.filter((d) => this.normalizeStatus(d?.status) === 'pending').length;

    this.transactionCount = transactions.length + withdrawRequests.length;
    this.monthChangePercent = this.computeMonthChange(transactions);
  }

  private computeMonthChange(transactions: WalletTxn[]): number {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);

    const thisMonthTotal = transactions
      .filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear && t.amount > 0;
      })
      .reduce((s, t) => s + t.amount, 0);

    const lastMonthTotal = transactions
      .filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear() && t.amount > 0;
      })
      .reduce((s, t) => s + t.amount, 0);

    if (!lastMonthTotal) return thisMonthTotal > 0 ? 100 : 0;
    return Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 1000) / 10;
  }

  private buildDailyActivity(
    transactions: WalletTxn[],
    depositRequests: any[] = [],
    withdrawRequests: any[] = []
  ): DailyActivityPoint[] {
    const days = 7;
    const buckets: DailyActivityPoint[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      buckets.push({
        label: date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
        shortLabel: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        deposit: 0,
        withdraw: 0,
        transfer: 0
      });
    }

    const addToBucket = (dateValue: string, kind: 'deposit' | 'withdraw' | 'transfer', amount: number) => {
      const d = new Date(dateValue);
      if (Number.isNaN(d.getTime()) || !amount) return;

      for (const b of buckets) {
        const idx = buckets.indexOf(b);
        const refDate = new Date();
        refDate.setHours(0, 0, 0, 0);
        refDate.setDate(refDate.getDate() - (days - 1 - idx));
        if (refDate.getFullYear() === d.getFullYear() &&
            refDate.getMonth() === d.getMonth() &&
            refDate.getDate() === d.getDate()) {
          if (kind === 'deposit') b.deposit += amount;
          else if (kind === 'withdraw') b.withdraw += amount;
          else b.transfer += amount;
          break;
        }
      }
    };

    transactions.forEach((t) => {
      const amt = Math.abs(t.amount);
      if (t.type === 'Deposit') addToBucket(t.date, 'deposit', amt);
      else if (t.type === 'Withdrawal') addToBucket(t.date, 'withdraw', amt);
      else if (t.type === 'Transfer') addToBucket(t.date, 'transfer', amt);
    });

    depositRequests
      .filter((d) => this.normalizeStatus(d?.status) === 'approved')
      .forEach((d) => addToBucket(d.creationTime, 'deposit', Math.abs(Number(d?.amount) || 0)));

    withdrawRequests.forEach((w) =>
      addToBucket(w.creationTime, 'withdraw', Math.abs(Number(w?.amount) || 0))
    );

    return buckets;
  }

  private buildDonut(depositRequests: any[], withdrawRequests: any[], transactions: WalletTxn[]): void {
    const deposit = this.totalDeposits;
    const withdraw = this.totalWithdrawals;
    const transfer = this.totalTransfers;
    const other = transactions
      .filter((t) => !['Deposit', 'Withdrawal', 'Transfer'].includes(t.type))
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const total = deposit + withdraw + transfer + other || 1;
    const slices = [
      { label: 'Deposits', amount: deposit, color: '#10B981' },
      { label: 'Withdrawals', amount: withdraw, color: '#ef4444' },
      { label: 'Transfers', amount: transfer, color: '#3b82f6' },
      { label: 'Other', amount: other, color: '#94a3b8' }
    ].filter((s) => s.amount > 0);

    if (!slices.length) {
      this.breakdownSlices = [];
      this.donutGradient = 'conic-gradient(#e2e8f0 0% 100%)';
      return;
    }

    const rawPercents = slices.map((s) => (s.amount / total) * 100);
    const visualPercents = this.computeVisualPercents(slices, rawPercents);

    let cursor = 0;
    const parts: string[] = [];
    this.breakdownSlices = slices.map((s, i) => {
      const percent = rawPercents[i];
      const visual = visualPercents[i];
      const start = cursor;
      cursor += visual;
      parts.push(`${s.color} ${start}% ${cursor}%`);
      return {
        ...s,
        percent,
        displayPercent: this.formatSlicePercent(percent, s.amount)
      };
    });
    this.donutGradient = `conic-gradient(${parts.join(', ')})`;
  }

  /** Ensures small slices (e.g. $21 vs $2M deposit) stay visible on the donut. */
  private computeVisualPercents(
    slices: { amount: number }[],
    rawPercents: number[]
  ): number[] {
    const minVisual = 6;
    const needsBoost = rawPercents.some((p, i) => slices[i].amount > 0 && p > 0 && p < minVisual);
    if (!needsBoost) return rawPercents;

    let visual = rawPercents.map((p, i) =>
      slices[i].amount > 0 && p > 0 && p < minVisual ? minVisual : p
    );

    let sum = visual.reduce((a, b) => a + b, 0);
    if (sum > 100) {
      const largestIdx = visual.indexOf(Math.max(...visual));
      visual[largestIdx] = Math.max(minVisual, visual[largestIdx] - (sum - 100));
      sum = visual.reduce((a, b) => a + b, 0);
    }

    if (sum < 100 && visual.length) {
      const largestIdx = visual.indexOf(Math.max(...visual));
      visual[largestIdx] += 100 - sum;
    }

    return visual;
  }

  private formatSlicePercent(percent: number, amount: number): string {
    if (amount <= 0 || percent <= 0) return '0%';
    if (percent < 0.01) return '<0.01%';
    if (percent < 1) return `${percent.toFixed(2)}%`;
    if (percent < 10) return `${percent.toFixed(1)}%`;
    return `${Math.round(percent)}%`;
  }

  getDailyMax(): number {
    return Math.max(
      ...this.dailyActivity.map((d) => d.deposit + d.withdraw + d.transfer),
      1
    );
  }

  getStackHeight(value: number): number {
    const max = this.getDailyMax();
    if (!value) return 0;
    return Math.max(8, Math.round((value / max) * 100));
  }

  get chartYAxisLabels(): string[] {
    const max = this.getDailyMax();
    const steps = 6;
    const labels: string[] = [];
    for (let i = steps; i >= 0; i--) {
      const val = Math.round((max / steps) * i);
      labels.push('$ ' + val.toLocaleString());
    }
    return labels;
  }

  getDayTotal(day: DailyActivityPoint): number {
    return day.deposit + day.withdraw + day.transfer;
  }

  get filteredTransactions(): WalletTxn[] {
    if (this.activeFilter === 'All') return this.recentTransactions;
    return this.recentTransactions.filter((t) => {
      if (this.activeFilter === 'Deposit') return t.type === 'Deposit';
      if (this.activeFilter === 'Withdrawals') return t.type === 'Withdrawal';
      if (this.activeFilter === 'Transfer') return t.type === 'Transfer';
      return true;
    });
  }

  setFilter(filter: string) {
    this.activeFilter = filter;
    this.cdr.detectChanges();
  }

  private normalizeType(t: any): WalletTxn['type'] {
    const category = (t.category || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    const movement = (t.movementType || '').toLowerCase();

    if (category === 'deposit' || desc.includes('deposit') || movement === 'deposit') return 'Deposit';
    if (category === 'withdrawal' || desc.includes('withdraw') || desc.includes('payout') || desc.includes('withdrawal')) return 'Withdrawal';
    if (movement === 'debit' && (desc.includes('withdraw') || desc.includes('payout'))) return 'Withdrawal';
    if (category === 'transfer' || desc.includes('transfer')) return 'Transfer';
    return 'Transaction';
  }

  private normalizeStatus(status: unknown): string {
    return String(status ?? '').trim().toLowerCase();
  }

  copyWalletId() {
    if (!this.walletData.walletId || this.walletData.walletId === '---') return;

    navigator.clipboard.writeText(this.walletData.walletId).then(() => {
      this.toastService.showSuccess('Wallet ID copied to clipboard!');
    }).catch(() => {
      this.toastService.showError('Failed to copy Wallet ID');
    });
  }

  logout() {
    this.authService.logout();
    this.toastService.showSuccess('Logged out successfully');
    this.router.navigate(['/auth'], { replaceUrl: true });
  }
}
