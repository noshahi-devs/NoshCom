import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, UserDto } from '../../../core/services/user.service';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  lastLogin: Date | null;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  searchTerm = '';
  selectedStatus = 'all';
  selectedRole = 'all';

  // Modal states
  statusConfirmVisible = false;
  userToToggle: User | null = null;
  newStatus: 'active' | 'inactive' | null = null;

  // Toast states
  successPopupVisible = false;
  successMessage = '';
  errorPopupVisible = false;
  errorMessage = '';

  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.userService.getAll().subscribe({
      next: (users) => {
        this.users = users.map(u => ({
          id: u.id,
          name: u.fullName,
          email: u.emailAddress,
          role: u.roleNames && u.roleNames.length > 0 ? u.roleNames.join(', ') : 'User',
          status: u.isActive ? 'active' : 'inactive',
          createdAt: new Date(u.creationTime),
          lastLogin: u.lastLoginTime ? new Date(u.lastLoginTime) : null
        }));
        this.applyFilters();
      },
      error: (err) => {
        console.error('Failed to load users', err);
        this.showError('Failed to load users');
      }
    });
  }

  applyFilters(): void {
    const term = this.searchTerm.trim().toLowerCase();
    this.filteredUsers = this.users.filter(user => {
      const matchesSearch = !term ||
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term);

      const matchesStatus = this.selectedStatus === 'all' || user.status === this.selectedStatus;

      // Role filter might need adjustment if roles are comma separated strings now
      const matchesRole = this.selectedRole === 'all' || user.role.toLowerCase().includes(this.selectedRole.toLowerCase());

      return matchesSearch && matchesStatus && matchesRole;
    });
  }

  openStatusConfirm(user: User): void {
    this.userToToggle = user;
    this.newStatus = user.status === 'active' ? 'inactive' : 'active';
    this.statusConfirmVisible = true;
  }

  closeStatusConfirm(): void {
    this.statusConfirmVisible = false;
    this.userToToggle = null;
    this.newStatus = null;
  }

  confirmStatusToggle(): void {
    if (!this.userToToggle || !this.newStatus) return;

    const user = this.userToToggle;
    const action = this.newStatus === 'active'
      ? this.userService.activate(user.id)
      : this.userService.deactivate(user.id);

    action.subscribe({
      next: () => {
        user.status = this.newStatus!;
        this.applyFilters();
        this.closeStatusConfirm();
        this.showSuccess(`User ${user.name} is now ${user.status}`);
      },
      error: (err) => {
        console.error(err);
        this.showError('Failed to update user status');
        this.closeStatusConfirm();
      }
    });
  }

  getStatusColor(status: 'active' | 'inactive'): string {
    return status === 'active' ? '#10b981' : '#ef4444';
  }

  getRoleBadgeClass(role: string): string {
    const lowerRole = role.toLowerCase();
    if (lowerRole.includes('admin')) return 'admin';
    if (lowerRole.includes('supplier')) return 'seller';
    if (lowerRole.includes('customer')) return 'customer';
    return 'customer'; // default
  }

  formatDate(date: Date | null): string {
    if (!date) return 'Never';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Toast methods
  showSuccess(message: string): void {
    this.successMessage = message;
    this.successPopupVisible = true;
    setTimeout(() => {
      this.successPopupVisible = false;
    }, 2500);
  }

  showError(message: string): void {
    this.errorMessage = message;
    this.errorPopupVisible = true;
    setTimeout(() => {
      this.errorPopupVisible = false;
    }, 3200);
  }

  closeSuccessPopup(): void {
    this.successPopupVisible = false;
  }

  closeErrorPopup(): void {
    this.errorPopupVisible = false;
  }
}
