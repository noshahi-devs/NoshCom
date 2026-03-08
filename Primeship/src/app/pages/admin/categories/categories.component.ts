import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CategoryService, CategoryDto, CreateCategoryDto, UpdateCategoryDto } from '../../../core/services/category.service';
import { StorageService } from '../../../core/services/storage.service';
import { ToastService } from '../../../core/services/toast.service';
import { GameLoaderComponent } from '../../../shared/components/game-loader/game-loader.component';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, GameLoaderComponent],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('editFileInput') editFileInput!: ElementRef;

  // Modal states
  addCategoryModalVisible = false;
  editCategoryModalVisible = false;
  deleteConfirmationVisible = false;
  categoryToDelete: CategoryDto | null = null;
  deleteConfirmationInput = '';
  productsCount = 0;

  // Image upload
  isUploading = false;
  imagePreviewUrl: string | null = null;
  editImagePreviewUrl: string | null = null;

  // Template compatibility properties
  toasts: any[] = [];
  parentCategories: any[] = [{ label: 'No Parent', value: null }];


  // Data
  categories: CategoryDto[] = [];
  filteredCategories: CategoryDto[] = [];
  paginatedCategories: CategoryDto[] = [];

  // Forms
  addCategoryForm!: FormGroup;
  editCategoryForm!: FormGroup;

  // Table settings
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  searchTerm = "";
  selectedStatusFilter: boolean | null = null;

  // Loading state
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private categoryService: CategoryService,
    private storageService: StorageService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.initForms();
    this.loadCategories();
  }



  private initForms(): void {
    this.addCategoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      imageUrl: [''],
      status: [true]
    });

    this.editCategoryForm = this.fb.group({
      id: [''],
      name: ['', [Validators.required, Validators.minLength(2)]],
      imageUrl: [''],
      status: [true]
    });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\\s-]/g, '')
      .replace(/\\s+/g, '-')
      .replace(/-+/g, '-');
  }

  // Load Categories from API
  loadCategories(): void {
    this.isLoading = true;

    this.categoryService.getAll().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.filterTable();
        this.isLoading = false;

        // Force change detection
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.toastService.showError('Failed to load categories. Please try again.');
        this.isLoading = false;
      }
    });
  }

  // Category CRUD Operations
  openAddCategoryModal(): void {
    this.addCategoryForm.reset({ name: '', slug: '', imageUrl: '', status: true });
    this.imagePreviewUrl = null;
    this.addCategoryModalVisible = true;
    this.cdr.detectChanges();
  }

  closeAddCategoryModal(): void {
    this.addCategoryModalVisible = false;
    this.imagePreviewUrl = null;
    this.cdr.detectChanges();
  }

  openEditCategoryModal(category: CategoryDto): void {
    this.editCategoryForm.patchValue({
      id: category.id,
      name: category.name,
      slug: category.slug,
      imageUrl: category.imageUrl,
      status: category.status
    });
    this.editImagePreviewUrl = category.imageUrl;
    this.editCategoryModalVisible = true;
    this.cdr.detectChanges();
  }

  closeEditCategoryModal(): void {
    this.editCategoryModalVisible = false;
    this.editImagePreviewUrl = null;
    this.cdr.detectChanges();
  }

  openDeleteConfirmation(category: CategoryDto): void {
    this.categoryToDelete = category;
    this.deleteConfirmationInput = '';
    this.productsCount = 0;
    this.deleteConfirmationVisible = true;
  }

  confirmDelete(): void {
    if (this.categoryToDelete) {
      // Check if user typed the category name correctly for force delete
      const forceDelete = this.deleteConfirmationInput === this.categoryToDelete.name;

      console.log('🗑️ Deleting category:', this.categoryToDelete.name, 'Force:', forceDelete);

      this.categoryService.delete(this.categoryToDelete.id, forceDelete).subscribe({
        next: () => {
          console.log('✅ Category deleted successfully');
          const message = forceDelete
            ? `Category "${this.categoryToDelete!.name}" and all its products deleted successfully`
            : `Category "${this.categoryToDelete!.name}" deleted successfully`;
          this.toastService.showSuccess(message);
          this.loadCategories();
          this.cancelDelete();
        },
        error: (error) => {
          console.error('❌ Error deleting category:', error);

          // Extract error message and products count from ABP response
          const errorMessage = error?.error?.error?.message || 'Failed to delete category. Please try again.';

          // Extract products count from error message
          const match = errorMessage.match(/has (\d+) product/);
          if (match) {
            this.productsCount = parseInt(match[1], 10);
          }

          this.toastService.showError(errorMessage);
          // Don't close modal if there are products - let user try force delete
          if (this.productsCount === 0) {
            this.cancelDelete();
          }
        }
      });
    }
  }

  cancelDelete(): void {
    this.deleteConfirmationVisible = false;
    this.categoryToDelete = null;
    this.deleteConfirmationInput = '';
    this.productsCount = 0;
  }

  saveCategory(): void {
    if (this.addCategoryForm.invalid) {
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }

    const formValue = this.addCategoryForm.value;
    const input: CreateCategoryDto = {
      tenantId: 2, // Explicitly set Prime Ship Tenant ID
      name: formValue.name,
      slug: formValue.slug || this.generateSlug(formValue.name),
      imageUrl: formValue.imageUrl,
      status: formValue.status
    };

    console.log('💾 Creating category:', input);

    this.categoryService.create(input).subscribe({
      next: (result) => {
        console.log('✅ Category created:', result);
        this.toastService.showSuccess('Category added successfully');
        this.closeAddCategoryModal();
        this.loadCategories();
      },
      error: (error) => {
        console.error('❌ Error creating category:', error);
        this.toastService.showError('Failed to create category. Please try again.');
      }
    });
  }

  updateCategory(): void {
    if (this.editCategoryForm.invalid) {
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }

    const formValue = this.editCategoryForm.value;
    const input: UpdateCategoryDto = {
      id: formValue.id,
      tenantId: 2, // Explicitly set Prime Ship Tenant ID
      name: formValue.name,
      slug: formValue.slug || this.generateSlug(formValue.name),
      imageUrl: formValue.imageUrl,
      status: formValue.status
    };

    console.log('💾 Updating category:', input);

    this.categoryService.update(input).subscribe({
      next: (result) => {
        console.log('✅ Category updated:', result);
        this.toastService.showSuccess('Category updated successfully');
        this.closeEditCategoryModal();
        this.loadCategories();
      },
      error: (error) => {
        console.error('❌ Error updating category:', error);
        this.toastService.showError('Failed to update category. Please try again.');
      }
    });
  }

  // Image upload methods
  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  triggerEditFileInput(): void {
    this.editFileInput.nativeElement.click();
  }

  onImageSelect(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        this.toastService.showError('Image size should be less than 2MB');
        return;
      }

      this.isUploading = true;
      this.cdr.detectChanges();

      const reader = new FileReader();
      reader.onload = (e: any) => {
        const base64 = e.target.result;
        this.imagePreviewUrl = base64; // Show local preview immediately

        const categoryName = this.addCategoryForm.get('name')?.value || 'Category';
        this.storageService.uploadImage(base64, `Category_${categoryName}`).subscribe({
          next: (res: any) => {
            if (res.success && res.result) {
              this.addCategoryForm.patchValue({ imageUrl: res.result });
              this.imagePreviewUrl = res.result; // Update preview with Azure URL
              this.toastService.showSuccess('Image uploaded successfully');
            } else {
              this.toastService.showError('Image uploaded but no URL returned. Using local copy for now.');
            }
            this.isUploading = false;
            this.cdr.detectChanges();
          },
          error: (err: any) => {
            console.error('Azure upload failed', err);
            this.toastService.showError('Failed to upload image to Azure. Using local copy.');
            this.isUploading = false;
            this.cdr.detectChanges();
          }
        });
      };
      reader.readAsDataURL(file);
    }
  }

  onEditImageSelect(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        this.toastService.showError('Image size should be less than 2MB');
        return;
      }

      this.isUploading = true;
      this.cdr.detectChanges();

      const reader = new FileReader();
      reader.onload = (e: any) => {
        const base64 = e.target.result;
        this.editImagePreviewUrl = base64; // Show local preview immediately

        const categoryName = this.editCategoryForm.get('name')?.value || 'Category';
        this.storageService.uploadImage(base64, `Category_${categoryName}`).subscribe({
          next: (res: any) => {
            if (res.success && res.result) {
              this.editCategoryForm.patchValue({ imageUrl: res.result });
              this.editImagePreviewUrl = res.result; // Update preview with Azure URL
              this.toastService.showSuccess('Image updated in Azure successfully');
            } else {
              this.toastService.showError('Image uploaded but no URL returned.');
            }
            this.isUploading = false;
            this.cdr.detectChanges();
          },
          error: (err: any) => {
            console.error('Azure upload failed', err);
            this.toastService.showError('Failed to upload image to Azure.');
            this.isUploading = false;
            this.cdr.detectChanges();
          }
        });
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.imagePreviewUrl = null;
    this.addCategoryForm.patchValue({ imageUrl: '' });
  }

  removeEditImage(): void {
    this.editImagePreviewUrl = null;
    this.editCategoryForm.patchValue({ imageUrl: '' });
  }

  // Helper Methods
  getStatusLabel(status: boolean): string {
    return status ? 'Active' : 'Inactive';
  }

  // Table Operations
  filterTable(): void {
    console.log('🔍 Filtering categories. Total:', this.categories.length);
    console.log('🔍 Search term:', JSON.stringify(this.searchTerm), 'Status filter:', this.selectedStatusFilter);
    let filtered = [...this.categories];

    // Apply search filter - trim to handle whitespace
    const trimmedSearch = this.searchTerm?.trim() || '';
    if (trimmedSearch) {
      const searchLower = trimmedSearch.toLowerCase();
      filtered = filtered.filter(category =>
        category.name.toLowerCase().includes(searchLower) ||
        category.slug.toLowerCase().includes(searchLower)
      );
      console.log('🔍 After search filter:', filtered.length);
    }

    // Apply status filter
    if (this.selectedStatusFilter !== null) {
      filtered = filtered.filter(category => category.status === this.selectedStatusFilter);
      console.log('🔍 After status filter:', filtered.length);
    }

    this.filteredCategories = filtered;
    console.log('✅ Filtered categories:', this.filteredCategories.length);
    this.updatePagination();
    this.cdr.detectChanges();
  }

  private updatePagination(): void {
    console.log('📄 Updating pagination. Filtered:', this.filteredCategories.length, 'ItemsPerPage:', this.itemsPerPage);
    this.totalPages = Math.ceil(this.filteredCategories.length / this.itemsPerPage);
    this.currentPage = Math.min(this.currentPage, this.totalPages || 1);
    console.log('📄 Total pages:', this.totalPages, 'Current page:', this.currentPage);

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    console.log('📄 Slice from', startIndex, 'to', endIndex);
    this.paginatedCategories = this.filteredCategories.slice(startIndex, endIndex);
    console.log('📄 Paginated categories:', this.paginatedCategories.length);
    console.log('📄 Paginated data:', this.paginatedCategories);
    this.cdr.detectChanges();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
      this.cdr.detectChanges();
    }
  }

  clearFilters(): void {
    console.log('🧹 Clearing filters');
    this.searchTerm = '';
    this.selectedStatusFilter = null;
    console.log('🧹 Filters cleared. searchTerm:', JSON.stringify(this.searchTerm), 'statusFilter:', this.selectedStatusFilter);
    this.filterTable();
    this.cdr.detectChanges();
  }

  // Pagination helper
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPages - 1);

    if (endPage - startPage < maxPages - 1) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }




  getParentName(parentId: any): string {
    return '-'; // No parent categories in current model
  }

  getStatusClass(status: boolean): string {
    return status ? 'active' : 'inactive';
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  getToastIcon(type: string): string {
    const icons: any = {
      success: 'pi-check-circle',
      error: 'pi-times-circle',
      warning: 'pi-exclamation-triangle',
      info: 'pi-info-circle'
    };
    return icons[type] || 'pi-info-circle';
  }
}
