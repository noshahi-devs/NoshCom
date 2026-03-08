import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { GlobalStateService } from '../../services/global-state.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgFor, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {

  constructor(
    private globalState: GlobalStateService,
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) { }

  menuSections = [
    {
      title: 'Overview',
      expanded: true,
      items: [
        { label: 'Dashboard', icon: '📊', route: '/dashboard' }
      ]
    },
    {
      title: 'My Cards',
      expanded: false,
      items: [
        { label: 'All Debit Cards', icon: '💳', route: '/cards' }
      ]
    },
    {
      title: 'Account Statement',
      expanded: false,
      items: [
        { label: 'Transactions', icon: '📝', route: '/transactions' }
      ]
    },
    {
      title: 'Send & Receive',
      expanded: false,
      items: [
        { label: 'Transfer Money', icon: '💸', route: '/transfer' }
      ]
    },
    {
      title: 'Deposit Management',
      expanded: false,
      items: [
        { label: 'Deposit', icon: '⬇️', route: '/deposit' },
        { label: 'Deposit Method', icon: '🏦', route: '/deposit-methods' },
        { label: 'All Deposit History', icon: '📋', route: '/deposit-history' }
      ]
    },
    // Hidden for future: Open Business (Business Plans)
    // {
    //   title: 'Open Business',
    //   expanded: false,
    //   items: [
    //     { label: 'Business Plans', icon: '💼', route: '/business-plans' }
    //   ]
    // },
    {
      title: 'Topup and Withdraw',
      expanded: false,
      items: [
        { label: 'Withdraw', icon: '⬆️', route: '/withdraw' },
        { label: 'Withdraw Method', icon: '🏧', route: '/withdraw-methods' },
        { label: 'All Withdraw', icon: '📜', route: '/withdraw-history' }
      ]
    },
    {
      title: 'Support Center',
      expanded: false,
      items: [
        { label: 'User Tickets', icon: '🎫', route: '/tickets' },
        { label: 'Upgrade Plan', icon: '🚀', route: '/upgrade-plan' },
        { label: 'Contact Us', icon: '📧', route: '/contact' }
      ]
    },
    {
      title: 'Admin Management',
      expanded: true,
      items: [
        { label: 'Admin Dashboard', icon: '🏛️', route: '/admin-dashboard' },
        { label: 'Approve Deposit', icon: '✅', route: '/approve-deposits' },
        { label: 'Approve Withdraw', icon: '🏧', route: '/approve-withdrawals' },
        { label: 'Global Transaction', icon: '📈', route: '/approve-transactions' },
        { label: 'User Management', icon: '👥', route: '/user-management' },
        { label: 'Support Management', icon: '🛠️', route: '/approve-support' },
        { label: 'Approve Cards', icon: '💳', route: '/approve-cards' },
        { label: 'Logout', icon: '🚪', route: '/auth' }
      ],
      isAdminOnly: true
    },
    {
      title: 'Exit',
      expanded: false,
      items: [
        { label: 'Logout', icon: '🚪', route: '/auth' }
      ],
      isAdminOnly: false // keep it for normal users too
    }
  ];

  get isAdmin(): boolean {
    // Use GlobalStateService for admin check
    const isAdminByRole = this.globalState.isAdmin();

    // Fallback to email check for backward compatibility
        const email = (sessionStorage.getItem('userEmail') || localStorage.getItem('userEmail'))?.toLowerCase().trim();
    const adminEmails = ['noshahi@easyfinora.com', 'noshahi@finora.com', 'admin@defaulttenant.com', 'gp_noshahi@easyfinora.com', 'admin'];
    const isAdminByEmail = adminEmails.includes(email || '');

    const isAdm = isAdminByRole || isAdminByEmail;
    return isAdm;
  }

  get filteredMenuSections() {
    if (this.isAdmin) {
      // Admins see ONLY admin sections (isAdminOnly: true)
      return this.menuSections.filter(section => section['isAdminOnly'] === true);
    }
    // Users see everything EXCEPT admin sections
    return this.menuSections.filter(section => !section['isAdminOnly']);
  }

  toggleSection(index: number) {
    this.menuSections.forEach((section, i) => {
      if (i === index) {
        section.expanded = !section.expanded;
      } else {
        section.expanded = false;
      }
    });
  }

  logout() {
    this.authService.logout();
    this.toastService.showSuccess('Logged out successfully');
    this.router.navigate(['/auth'], { replaceUrl: true });
  }

}
