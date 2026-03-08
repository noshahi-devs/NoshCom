import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { GameLoaderComponent } from '../../../shared/components/game-loader/game-loader.component';
import { UserService, UserDto, CreateUserDto, UpdateUserDto } from '../../../core/services/user.service';
import { OrderService, Order } from '../../../core/services/order.service';
import { forkJoin } from 'rxjs';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  totalOrders: number;
  totalSpent: number;
  createdAt: Date;
}

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, GameLoaderComponent],
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.scss']
})
export class CustomersComponent implements OnInit {
  addCustomerModalVisible = false;
  editCustomerModalVisible = false;
  deleteConfirmationVisible = false;

  customerToDelete: Customer | null = null;
  selectedCustomer: Customer | null = null;

  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  paginatedCustomers: Customer[] = [];

  addCustomerForm!: FormGroup;
  editCustomerForm!: FormGroup;

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  searchTerm = '';
  selectedStatusFilter: string | null = null;

  isLoading = false;
  toasts: Toast[] = [];
  private toastId = 0;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private userService: UserService,
    private orderService: OrderService
  ) { }

  ngOnInit(): void {
    this.initForms();
    this.loadCustomers(); // Load real data
  }

  private initForms(): void {
    this.addCustomerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      surname: ['', [Validators.required]],
      userName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      status: [true],
      password: ['123456'] // Default password for new users
    });

    this.editCustomerForm = this.fb.group({
      id: [null],
      name: ['', [Validators.required, Validators.minLength(3)]],
      surname: ['', [Validators.required]],
      userName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      status: [true]
    });
  }

  loadCustomers(): void {
    this.isLoading = true;

    // Fetch users and orders in parallel to calculate spending
    forkJoin({
      users: this.userService.getAll(),
      orders: this.orderService.getAllOrders() // These are SupplierOrders (Wholesale)
    }).subscribe({
      next: ({ users, orders }) => {
        this.customers = users.map(u => {
          // Total Volume = Wholesale orders placed by this user (reseller)
          // Match by resellerId or creatorUserId
          const userOrders = (orders || []).filter(o =>
            Number(o.resellerId) === u.id ||
            Number(o.sellerId) === u.id ||
            Number((o as any).creatorUserId) === u.id
          );

          const totalVolume = userOrders.reduce((sum, order: any) => {
            const orderTotal = order.totalAmount || order.totalPurchaseAmount || (order.items || []).reduce((itemSum: number, item: any) => {
              const price = Number(item.price) || 0;
              const qty = Number(item.qty || item.quantity) || 0;
              return itemSum + (price * qty);
            }, 0);
            return sum + Number(orderTotal || 0);
          }, 0);

          return {
            id: u.id,
            name: u.fullName || (u.name + ' ' + u.surname),
            email: u.emailAddress,
            phone: (u as any).phoneNumber || '',
            status: u.isActive ? 'active' : 'inactive',
            totalOrders: userOrders.length,
            totalSpent: totalVolume,
            createdAt: new Date(u.creationTime)
          };
        });

        this.filterTable();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load sellers', err);
        this.showToast('Failed to load sellers', 'error');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleUserStatus(customer: Customer): void {
    const isActactivating = customer.status === 'inactive';
    const action = isActactivating ? this.userService.activate(customer.id) : this.userService.deactivate(customer.id);

    action.subscribe({
      next: () => {
        this.showToast(`Seller ${isActactivating ? 'activated' : 'deactivated'} successfully`, 'success');
        this.loadCustomers(); // Reload to reflect status
      },
      error: (err) => {
        console.error(err);
        this.showToast(`Failed to ${isActactivating ? 'activate' : 'deactivate'} seller`, 'error');
      }
    });
  }

  showToast(message: string, type: Toast['type'] = 'info'): void {
    const id = ++this.toastId;
    this.toasts.push({ id, message, type });
    setTimeout(() => this.removeToast(id), 5000);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  getToastIcon(type: string): string {
    switch (type) {
      case 'success':
        return 'pi pi-check-circle';
      case 'error':
        return 'pi pi-times-circle';
      case 'warning':
        return 'pi pi-exclamation-triangle';
      default:
        return 'pi pi-info-circle';
    }
  }

  openAddCustomerModal(): void {
    this.addCustomerForm.reset({
      name: '',
      surname: '',
      userName: '',
      email: '',
      phone: '',
      status: true,
      password: 'Password123!' // Default strong password
    });
    this.addCustomerModalVisible = true;
    this.cdr.detectChanges();
  }

  closeAddCustomerModal(): void {
    this.addCustomerModalVisible = false;
    this.cdr.detectChanges();
  }

  openEditCustomerModal(customer: Customer): void {
    this.selectedCustomer = customer;
    // We need to fetch full details or key off existing. 
    // Ideally we call get(id) to fill form, but for now using grid data.
    // Splitting name to name/surname is hacky, but ok for now.
    const nameParts = customer.name.split(' ');
    const name = nameParts[0];
    const surname = nameParts.slice(1).join(' ') || '-';

    this.editCustomerForm.patchValue({
      id: customer.id,
      name: name,
      surname: surname,
      userName: customer.email, // Often email is username
      email: customer.email,
      phone: customer.phone,
      status: customer.status === 'active'
    });
    this.editCustomerModalVisible = true;
    this.cdr.detectChanges();
  }

  closeEditCustomerModal(): void {
    this.editCustomerModalVisible = false;
    this.selectedCustomer = null;
    this.cdr.detectChanges();
  }

  openDeleteConfirmation(customer: Customer): void {
    this.customerToDelete = customer;
    this.deleteConfirmationVisible = true;
    this.cdr.detectChanges();
  }

  cancelDelete(): void {
    this.deleteConfirmationVisible = false;
    this.customerToDelete = null;
    this.cdr.detectChanges();
  }

  confirmDelete(): void {
    if (this.customerToDelete) {
      this.userService.delete(this.customerToDelete.id).subscribe({
        next: () => {
          this.showToast(`Customer "${this.customerToDelete?.name}" deleted successfully`, 'success');
          this.loadCustomers();
          this.cancelDelete();
        },
        error: (err) => {
          this.showToast('Failed to delete customer', 'error');
          this.cancelDelete();
        }
      });
    }
  }

  saveCustomer(): void {
    if (this.addCustomerForm.invalid) {
      this.showToast('Please fill all required fields correctly', 'error');
      return;
    }

    const formValue = this.addCustomerForm.value;
    const input: CreateUserDto = {
      userName: formValue.userName || formValue.email,
      name: formValue.name,
      surname: formValue.surname,
      emailAddress: formValue.email,
      isActive: formValue.status,
      roleNames: ['Customer'],
      password: formValue.password
    };

    this.userService.create(input).subscribe({
      next: () => {
        this.showToast('Customer added successfully', 'success');
        this.closeAddCustomerModal();
        this.loadCustomers();
      },
      error: (err) => {
        console.error(err);
        this.showToast('Failed to create customer', 'error');
      }
    });
  }

  updateCustomer(): void {
    if (this.editCustomerForm.invalid) {
      this.showToast('Please fill all required fields correctly', 'error');
      return;
    }

    const formValue = this.editCustomerForm.value;
    const input: UpdateUserDto = {
      id: formValue.id,
      userName: formValue.userName || formValue.email,
      name: formValue.name,
      surname: formValue.surname,
      emailAddress: formValue.email,
      isActive: formValue.status,
      roleNames: ['Customer']
    };

    this.userService.update(input).subscribe({
      next: () => {
        this.showToast('Customer updated successfully', 'success');
        this.closeEditCustomerModal();
        this.loadCustomers();
      },
      error: (err) => {
        this.showToast('Failed to update customer', 'error');
      }
    });
  }

  getStatusLabel(status: Customer['status']): string {
    return status === 'active' ? 'Active' : 'Inactive';
  }

  formatCurrency(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  filterTable(): void {
    let filtered = [...this.customers];

    if (this.searchTerm) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(searchLower) ||
        customer.email.toLowerCase().includes(searchLower) ||
        customer.phone.toLowerCase().includes(searchLower)
      );
    }

    if (this.selectedStatusFilter) {
      filtered = filtered.filter(customer => customer.status === this.selectedStatusFilter);
    }

    this.filteredCustomers = filtered;
    this.updatePagination();
    this.cdr.detectChanges();
  }

  private updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredCustomers.length / this.itemsPerPage);
    this.currentPage = Math.min(this.currentPage, this.totalPages || 1);

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedCustomers = this.filteredCustomers.slice(startIndex, endIndex);
    this.cdr.detectChanges();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
      this.cdr.detectChanges();
    }
  }

  getStartIndex(): number {
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.filteredCustomers.length);
  }

  getPageNumbers(): number[] {
    const pageNumbers: number[] = [];
    const maxPagesToShow = 5;

    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return pageNumbers;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatusFilter = null;
    this.filterTable();
  }
}
