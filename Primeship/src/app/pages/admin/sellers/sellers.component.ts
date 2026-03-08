import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Toast } from '../../../core/models/toast.interface';
import { GameLoaderComponent } from '../../../shared/components/game-loader/game-loader.component';
import { UserService, UserDto, CreateUserDto, UpdateUserDto } from '../../../core/services/user.service';

interface Seller {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive' | 'pending';
  joinDate: Date;
  totalProducts: number;
  totalSales: number;
}

@Component({
  selector: 'app-sellers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, GameLoaderComponent],
  templateUrl: './sellers.component.html',
  styleUrls: ['./sellers.component.scss']
})
export class SellersComponent implements OnInit {
  sellers: Seller[] = [];
  filteredSellers: Seller[] = [];
  searchTerm = '';
  statusFilter = 'all';
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  toast: Toast | null = null;
  showAddModal = false;
  showEditModal = false;
  showDeleteModal = false;
  selectedSeller: Seller | null = null;
  sellerForm: FormGroup;
  isLoading = false;

  // Make Math available in the template
  Math = Math;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private userService: UserService
  ) {
    this.sellerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      surname: ['', [Validators.required]],
      userName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^[0-9]{10,15}$/)]],
      status: ['active', Validators.required],
      password: ['123456'] // Default
    });
  }

  ngOnInit(): void {
    this.loadSellers();
  }

  loadSellers(): void {
    this.isLoading = true;
    this.userService.getAll().subscribe({
      next: (users) => {
        // Filter only users that likely represent sellers/suppliers
        const sellerUsers = users; // .filter(u => u.roleNames?.includes('Supplier'));

        this.sellers = sellerUsers.map(u => ({
          id: u.id,
          name: u.fullName || u.name + ' ' + u.surname,
          email: u.emailAddress,
          phone: '',
          status: u.isActive ? 'active' : 'inactive',
          joinDate: new Date(u.creationTime),
          totalProducts: 0, // Needs separate API or enriched DTO
          totalSales: 0 // Needs separate API or enriched DTO
        }));

        this.filterSellers();
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

  getPageNumbers(): number[] {
    const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  get paginatedSellers(): Seller[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredSellers.slice(startIndex, startIndex + this.itemsPerPage);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.cdr.detectChanges();
  }

  filterSellers(): void {
    this.filteredSellers = this.sellers.filter(seller => {
      const matchesSearch = !this.searchTerm ||
        seller.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        seller.email.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus = this.statusFilter === 'all' ||
        seller.status === this.statusFilter;

      return matchesSearch && matchesStatus;
    });

    this.totalItems = this.filteredSellers.length;
    this.currentPage = 1; // Reset to first page when filters change
    this.cdr.detectChanges();
  }

  openAddModal(): void {
    this.sellerForm.reset({
      name: '',
      surname: '',
      userName: '',
      email: '',
      phone: '',
      status: 'active',
      password: 'Password123!'
    });
    this.showAddModal = true;
    this.cdr.detectChanges();
  }

  openEditModal(seller: Seller): void {
    this.selectedSeller = seller;

    const nameParts = seller.name.split(' ');
    const name = nameParts[0];
    const surname = nameParts.slice(1).join(' ') || '-';

    this.sellerForm.patchValue({
      name: name,
      surname: surname,
      userName: seller.email,
      email: seller.email,
      phone: seller.phone,
      status: seller.status
    });
    this.showEditModal = true;
    this.cdr.detectChanges();
  }

  openDeleteModal(seller: Seller): void {
    this.selectedSeller = seller;
    this.showDeleteModal = true;
    this.cdr.detectChanges();
  }

  closeModal(): void {
    this.showAddModal = false;
    this.showEditModal = false;
    this.showDeleteModal = false;
    this.selectedSeller = null;
    this.sellerForm.reset();
    this.cdr.detectChanges();
  }

  saveSeller(): void {
    if (this.sellerForm.invalid) {
      this.showToast('Please fill all required fields correctly', 'error');
      return;
    }

    const formValue = this.sellerForm.value;

    if (this.showAddModal) {
      const input: CreateUserDto = {
        userName: formValue.userName || formValue.email,
        name: formValue.name,
        surname: formValue.surname,
        emailAddress: formValue.email,
        isActive: formValue.status === 'active',
        roleNames: ['Supplier'],
        password: formValue.password
      };

      this.userService.create(input).subscribe({
        next: () => {
          this.showToast('Seller saved successfully', 'success');
          this.closeModal();
          this.loadSellers();
        },
        error: (err) => {
          this.showToast('Failed to save seller', 'error');
        }
      });
    } else if (this.showEditModal && this.selectedSeller) {
      const input: UpdateUserDto = {
        id: this.selectedSeller.id,
        userName: formValue.userName || formValue.email,
        name: formValue.name,
        surname: formValue.surname,
        emailAddress: formValue.email,
        isActive: formValue.status === 'active',
        roleNames: ['Supplier']
      };

      this.userService.update(input).subscribe({
        next: () => {
          this.showToast('Seller updated successfully', 'success');
          this.closeModal();
          this.loadSellers();
        },
        error: (err) => {
          this.showToast('Failed to update seller', 'error');
        }
      });
    }
  }

  deleteSeller(): void {
    if (!this.selectedSeller) return;

    this.userService.delete(this.selectedSeller.id).subscribe({
      next: () => {
        this.showToast('Seller deleted successfully', 'success');
        this.closeModal();
        this.loadSellers();
      },
      error: (err) => {
        this.showToast('Failed to delete seller', 'error');
      }
    });
  }

  showToast(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    this.toast = { message, type };
    setTimeout(() => {
      this.toast = null;
    }, 3000);
  }
}
