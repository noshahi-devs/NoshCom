import { Routes } from '@angular/router';
import { Dashboard } from './pages/dashboard/dashboard';
import { Cards } from './pages/cards/cards';
import { Transactions } from './pages/transactions/transactions';
import { Transfer } from './pages/transfer/transfer';
import { BusinessPlans } from './pages/business-plans/business-plans';
import { Tickets } from './pages/tickets/tickets';
import { Contact } from './pages/contact/contact';
import { Auth } from './pages/auth/auth';
import { ApplyCard } from './pages/apply-card/apply-card';
import { Deposit } from './pages/deposit/deposit';
import { DepositMethods } from './pages/deposit-methods/deposit-methods';
import { DepositHistory } from './pages/deposit-history/deposit-history';
import { Withdraw } from './pages/withdraw/withdraw';
import { WithdrawHistory } from './pages/withdraw-history/withdraw-history';
import { WithdrawMethods } from './pages/withdraw-methods/withdraw-methods';
import { Profile } from './pages/profile/profile';
import { ApproveDepositHistory } from './pages/approve-deposit-history/approve-deposit-history';
import { ApproveWithdrawHistory } from './pages/approve-withdraw-history/approve-withdraw-history';
import { ApproveSupport } from './pages/approve-support/approve-support';
import { ApproveAllTransactions } from './pages/approve-all-transactions/approve-all-transactions';
import { UserManagement } from './pages/user-management/user-management';
import { AdminDashboard } from './pages/admin-dashboard/admin-dashboard';
import { ApproveCards } from './pages/approve-cards/approve-cards';
import { UpgradePlan } from './pages/upgrade-plan/upgrade-plan.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/auth', pathMatch: 'full' },
  { path: 'auth', component: Auth },
  { path: 'profile', component: Profile, canActivate: [authGuard] },
  // Deleted dummy routes: home, product-detail, add-to-cart, checkout
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'cards', component: Cards, canActivate: [authGuard] },
  { path: 'apply-card', component: ApplyCard, canActivate: [authGuard] },
  { path: 'transactions', component: Transactions, canActivate: [authGuard] },
  { path: 'transfer', component: Transfer, canActivate: [authGuard] },
  { path: 'business-plans', component: BusinessPlans, canActivate: [authGuard] },
  { path: 'tickets', component: Tickets, canActivate: [authGuard] },
  { path: 'contact', component: Contact },
  // Deposit routes
  { path: 'deposit', component: Deposit, canActivate: [authGuard] },
  { path: 'deposit-methods', component: DepositMethods, canActivate: [authGuard] },
  { path: 'deposit-history', component: DepositHistory, canActivate: [authGuard] },
  { path: 'approve-deposits', component: ApproveDepositHistory, canActivate: [authGuard] },
  { path: 'approve-withdrawals', component: ApproveWithdrawHistory, canActivate: [authGuard] },
  { path: 'approve-support', component: ApproveSupport, canActivate: [authGuard] },
  { path: 'approve-transactions', component: ApproveAllTransactions, canActivate: [authGuard] },
  { path: 'approve-cards', component: ApproveCards, canActivate: [authGuard] },
  { path: 'user-management', component: UserManagement, canActivate: [authGuard] },
  { path: 'admin-dashboard', component: AdminDashboard, canActivate: [authGuard] },
  // Withdraw routes
  { path: 'withdraw', component: Withdraw, canActivate: [authGuard] },
  { path: 'withdraw-methods', component: WithdrawMethods, canActivate: [authGuard] },
  { path: 'withdraw-history', component: WithdrawHistory, canActivate: [authGuard] },
  { path: 'upgrade-plan', component: UpgradePlan, canActivate: [authGuard] }
];
