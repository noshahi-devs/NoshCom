import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductService, ProductDto, CreateProductDto, UpdateProductDto } from '../../../core/services/product.service';
import { CategoryService, CategoryDto } from '../../../core/services/category.service';
import { StorageService } from '../../../core/services/storage.service';
import { ToastService } from '../../../core/services/toast.service';
import { GameLoaderComponent } from '../../../shared/components/game-loader/game-loader.component';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, GameLoaderComponent],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss']
})
export class ProductsComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('editFileInput') editFileInput!: ElementRef;

  // Modal states
  addProductModalVisible = false;
  editProductModalVisible = false;
  deleteConfirmationVisible = false;
  viewProductModalVisible = false;
  productToDelete: ProductDto | null = null;
  selectedProduct: ProductDto | null = null;

  // Data
  products: ProductDto[] = [];
  filteredProducts: ProductDto[] = [];
  paginatedProducts: ProductDto[] = [];
  categories: CategoryDto[] = [];

  // Forms
  addProductForm!: FormGroup;
  editProductForm!: FormGroup;

  // Table settings
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  searchTerm = '';
  selectedStatusFilter: boolean | null = null;
  selectedCategoryFilter: string | null = null;

  // Image management
  imageUrls: string[] = [];
  currentImageUrl = '';

  // Loading state
  isLoading = false;
  isCategoriesLoading = false;

  // Template compatibility properties
  imagePreviewUrls: string[] = []; // For template compatibility
  isUploading = false; // For template compatibility
  uploadingIndexes = new Set<number>();


  constructor(
    private fb: FormBuilder,
    public productService: ProductService,
    private categoryService: CategoryService,
    private storageService: StorageService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    console.log('🔄 ProductsComponent initialized');
    this.initForms();
    this.loadCategories();
    this.loadProducts();
  }

  private initForms(): void {
    this.addProductForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      sku: [{ value: '', disabled: true }, [Validators.required]],
      categoryId: ['', [Validators.required]],
      brandName: ['', [Validators.required]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      price: [null, [Validators.required, Validators.min(0.01)]],
      discountPercentage: [null, [Validators.min(0), Validators.max(100)]],
      stock: [null, [Validators.required, Validators.min(0)]],
      status: [true]
    });

    this.editProductForm = this.fb.group({
      id: [''],
      name: ['', [Validators.required, Validators.minLength(3)]],
      sku: [{ value: '', disabled: true }, [Validators.required]],
      categoryId: ['', [Validators.required]],
      brandName: ['', [Validators.required]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      price: [null, [Validators.required, Validators.min(0.01)]],
      discountPercentage: [null, [Validators.min(0), Validators.max(100)]],
      stock: [null, [Validators.required, Validators.min(0)]],
      status: [true]
    });

    // Auto-generate SKU and Slug when name or category changes
    this.addProductForm.get('name')?.valueChanges.subscribe(() => this.updateGeneratedFields());
    this.addProductForm.get('categoryId')?.valueChanges.subscribe(() => this.updateGeneratedFields());
  }

  private updateGeneratedFields(): void {
    const name = this.addProductForm.get('name')?.value;
    const categoryId = this.addProductForm.get('categoryId')?.value;

    if (name && categoryId) {
      const category = this.categories.find(c => c.id === categoryId);
      const prefix = category ?
        category.name.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 3) :
        'PRD';

      // Generate 8-character unique alphanumeric string
      // Mix of timestamp (last 4 chars) and random (4 chars) to ensure uniqueness
      const timestampPart = Date.now().toString(36).toUpperCase().slice(-4);
      const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      const uniqueCode = `${timestampPart}${randomPart}`;

      const sku = `${prefix}-${uniqueCode}`;

      this.addProductForm.patchValue({
        sku: sku
      }, { emitEvent: false });
    }
  }

  private generateRandomStock(): number {
    return Math.floor(Math.random() * (250 - 43 + 1)) + 43;
  }

  private isNameDuplicate(name: string, excludeId?: string): boolean {
    return this.products.some(p =>
      p.name.toLowerCase().trim() === name.toLowerCase().trim() && p.id !== excludeId
    );
  }

  // Load Categories from API
  loadCategories(): void {
    console.log('📥 Loading categories...');
    this.isCategoriesLoading = true;

    this.categoryService.getAll().subscribe({
      next: (categories) => {
        console.log('✅ Categories loaded:', categories.length);
        this.categories = categories;
        this.isCategoriesLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error loading categories:', error);
        this.toastService.showError('Failed to load categories');
        this.isCategoriesLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Load Products from API
  loadProducts(): void {
    console.log('📥 Loading products...');
    this.isLoading = true;

    this.productService.getAll().subscribe({
      next: (products) => {
        console.log('✅ Products loaded:', products.length);

        // Add template compatibility properties
        const normalized = products.map(p => ({
          ...p,
          images: this.productService.parseImages(p.images || (p as any).Images), // Parse JSON string to array with PascalCase fallback
          category: p.categoryName, // Alias
          price: p.resellerMaxPrice, // Use reseller price as base
          discountPrice: p.discountPercentage > 0 ? p.resellerMaxPrice - (p.resellerMaxPrice * p.discountPercentage / 100) : 0,
          stock: p.stockQuantity, // Alias
          featured: false, // Default
          metaTitle: p.name, // Default
          metaDescription: p.description, // Default
          createdAt: new Date() // Default
        }));

        // De-duplicate by id/sku/name to avoid multiple identical rows
        const seen = new Set<string>();
        this.products = normalized.filter(p => {
          const key = (p.id || p.sku || p.name || '').toString();
          if (!key) return true;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        this.filterTable();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.toastService.showError('Failed to load products');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Product CRUD Operations
  openAddProductModal(): void {
    this.addProductForm.reset({
      name: '',
      sku: '',
      categoryId: '',
      brandName: '',
      description: '',
      price: null,
      discountPercentage: null,
      stock: this.generateRandomStock(),
      status: true
    });
    this.imageUrls = [];
    this.imagePreviewUrls = [];
    this.currentImageUrl = '';
    this.addProductModalVisible = true;
    this.cdr.detectChanges();
  }

  closeAddProductModal(): void {
    this.addProductModalVisible = false;
    this.cdr.detectChanges();
  }

  openEditProductModal(product: ProductDto): void {
    this.viewProductModalVisible = false;
    this.selectedProduct = product;

    // Parse images safely
    const images = Array.isArray(product.images) ? product.images : this.productService.parseImages(product.images);
    this.imageUrls = [...images];
    this.imagePreviewUrls = [...images]; // For template compatibility

    this.editProductForm.patchValue({
      id: product.id,
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId,
      brandName: product.brandName,
      description: product.description,
      price: product.resellerMaxPrice,
      discountPercentage: product.discountPercentage,
      stock: product.stockQuantity,
      status: product.status
    });

    this.editProductModalVisible = true;
    this.cdr.detectChanges();
  }

  closeEditProductModal(): void {
    this.editProductModalVisible = false;
    this.selectedProduct = null;
    this.cdr.detectChanges();
  }

  openViewProductModal(product: ProductDto): void {
    this.selectedProduct = product;
    this.viewProductModalVisible = true;
    this.cdr.detectChanges();
  }

  closeViewProductModal(): void {
    this.viewProductModalVisible = false;
    this.selectedProduct = null;
    this.cdr.detectChanges();
  }

  openDeleteConfirmation(product: ProductDto): void {
    this.productToDelete = product;
    this.deleteConfirmationVisible = true;
  }

  cancelDelete(): void {
    this.deleteConfirmationVisible = false;
    this.productToDelete = null;
  }

  confirmDelete(): void {
    if (this.productToDelete) {
      console.log('🗑️ Deleting product:', this.productToDelete.name);

      this.productService.delete(this.productToDelete.id).subscribe({
        next: () => {
          console.log('✅ Product deleted successfully');
          this.toastService.showSuccess(`Product "${this.productToDelete!.name}" deleted successfully`);
          this.loadProducts();
          this.cancelDelete();
        },
        error: (error) => {
          console.error('❌ Error deleting product:', error);
          this.toastService.showError('Failed to delete product');
          this.cancelDelete();
        }
      });
    }
  }

  // Image Management
  addImageUrl(): void {
    if (this.currentImageUrl.trim()) {
      this.imageUrls.push(this.currentImageUrl.trim());
      this.currentImageUrl = '';
    }
  }

  removeImage(index: number): void {
    this.imageUrls.splice(index, 1);
    this.imagePreviewUrls.splice(index, 1);
  }

  onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            this.handleFileUpload(file);
          }
        }
      }
    }
  }

  private handleFileUpload(file: File): void {
    if (file.size > 2 * 1024 * 1024) {
      this.toastService.showError('Image size should be less than 2MB');
      return;
    }

    const index = this.imageUrls.length;
    this.uploadingIndexes.add(index);
    this.isUploading = true;
    this.cdr.detectChanges();

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const base64 = e.target.result;
      this.imageUrls.push(base64); // Temporary local preview
      this.imagePreviewUrls.push(base64);
      this.cdr.detectChanges();

      const productName = this.addProductModalVisible
        ? this.addProductForm.get('name')?.value
        : this.editProductForm.get('name')?.value;

      this.storageService.uploadImage(base64, `Product_${productName || 'Product'}`).subscribe({
        next: (res: any) => {
          if (res.success && res.result) {
            this.imageUrls[index] = res.result;
            this.imagePreviewUrls[index] = res.result;
            this.toastService.showSuccess(`Image ${index + 1} uploaded to Azure`);
          } else {
            this.toastService.showError(`Image ${index + 1} uploaded but no URL returned.`);
          }
          this.uploadingIndexes.delete(index);
          this.isUploading = this.uploadingIndexes.size > 0;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Azure upload failed', err);
          this.toastService.showError(`Failed to upload image ${index + 1} to Azure.`);
          this.uploadingIndexes.delete(index);
          this.isUploading = this.uploadingIndexes.size > 0;
          this.cdr.detectChanges();
        }
      });
    };
    reader.readAsDataURL(file);
  }

  saveProduct(): void {
    if (this.addProductForm.invalid) {
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }

    const formValue = this.addProductForm.getRawValue();

    // Duplication check
    if (this.isNameDuplicate(formValue.name)) {
      this.toastService.showError('A product with this name already exists');
      return;
    }

    const input: CreateProductDto = {
      tenantId: 2, // Explicitly set Prime Ship Tenant ID
      name: formValue.name,
      sku: formValue.sku,
      categoryId: formValue.categoryId,
      description: formValue.description,
      brandName: formValue.brandName,
      images: this.productService.stringifyImages(this.imageUrls),
      supplierPrice: this.calculateSupplierPrice(formValue.price, formValue.discountPercentage),
      resellerMaxPrice: formValue.price,
      discountPercentage: formValue.discountPercentage,
      stockQuantity: formValue.stock,
      status: formValue.status,
      slug: this.productService.generateSlug(formValue.name)
    };

    console.log('💾 Creating product:', input);

    this.productService.create(input).subscribe({
      next: (result) => {
        console.log('✅ Product created:', result);
        this.toastService.showSuccess('Product added successfully');
        this.closeAddProductModal();
        this.loadProducts();
      },
      error: (error) => {
        console.error('❌ Error creating product:', error);
        this.toastService.showError('Failed to create product');
      }
    });
  }

  updateProduct(): void {
    if (this.editProductForm.invalid) {
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }

    const formValue = this.editProductForm.getRawValue();

    // Duplication check
    if (this.isNameDuplicate(formValue.name, formValue.id)) {
      this.toastService.showError('Another product with this name already exists');
      return;
    }

    const input: UpdateProductDto = {
      id: formValue.id,
      tenantId: 2, // Explicitly set Prime Ship Tenant ID
      name: formValue.name,
      sku: formValue.sku,
      categoryId: formValue.categoryId,
      description: formValue.description,
      brandName: formValue.brandName,
      images: this.productService.stringifyImages(this.imageUrls),
      supplierPrice: this.calculateSupplierPrice(formValue.price, formValue.discountPercentage),
      resellerMaxPrice: formValue.price,
      discountPercentage: formValue.discountPercentage,
      stockQuantity: formValue.stock,
      status: formValue.status,
      slug: this.productService.generateSlug(formValue.name)
    };

    console.log('💾 Updating product:', input);

    this.productService.update(input).subscribe({
      next: (result) => {
        console.log('✅ Product updated:', result);
        this.toastService.showSuccess('Product updated successfully');
        this.closeEditProductModal();
        this.loadProducts();
      },
      error: (error) => {
        console.error('❌ Error updating product:', error);
        this.toastService.showError('Failed to update product');
      }
    });
  }

  // Helper Methods
  getCategoryName(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : '-';
  }

  getStatusLabel(status: boolean): string {
    return status ? 'Active' : 'Inactive';
  }

  getDiscountPercentage(price: number, discountPrice: number): string {
    if (!price || !discountPrice || discountPrice >= price) return '';
    const percentage = Math.round(((price - discountPrice) / price) * 100);
    return `-${percentage}%`;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price || 0);
  }

  private calculateSupplierPrice(price: number, discountPercentage: number): number {
    const normalizedPrice = Number(price) || 0;
    const normalizedDiscount = Math.max(0, Math.min(100, Number(discountPercentage) || 0));
    const discountedPrice = normalizedPrice - (normalizedPrice * normalizedDiscount / 100);
    return Number(Math.max(discountedPrice, 0).toFixed(2));
  }

  getFirstImage(product: ProductDto): string {
    const images = this.productService.parseImages(product.images);
    return images.length > 0 ? images[0] : 'https://via.placeholder.com/400x400?text=No+Image';
  }

  // Table Operations
  filterTable(): void {
    let filtered = [...this.products];

    // Apply search filter - trim to handle whitespace
    const trimmedSearch = this.searchTerm?.trim() || '';
    if (trimmedSearch) {
      const searchLower = trimmedSearch.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        product.categoryName?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (this.selectedStatusFilter !== null) {
      filtered = filtered.filter(product => product.status === this.selectedStatusFilter);
    }

    // Apply category filter
    if (this.selectedCategoryFilter) {
      filtered = filtered.filter(product => product.categoryId === this.selectedCategoryFilter);
    }

    this.filteredProducts = filtered;
    this.updatePagination();
  }

  private updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredProducts.length / this.itemsPerPage);
    this.currentPage = Math.min(this.currentPage, this.totalPages || 1);

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedProducts = this.filteredProducts.slice(startIndex, endIndex);
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
    this.searchTerm = '';
    this.selectedStatusFilter = null;
    this.selectedCategoryFilter = null;
    this.filterTable();
    this.cdr.detectChanges();
  }

  // Pagination helpers
  getStartIndex(): number {
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.filteredProducts.length);
  }

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

  // ========== TEMPLATE COMPATIBILITY METHODS ==========
  // These exist for compatibility with the existing HTML template

  toasts: any[] = [];

  removeToast(id: number): void {
    // No-op - using ToastService
  }

  getToastIcon(type: string): string {
    return 'pi pi-info-circle';
  }

  // Image upload methods (for template compatibility)
  triggerFileInput(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  triggerEditFileInput(): void {
    if (this.editFileInput) {
      this.editFileInput.nativeElement.click();
    }
  }

  onImageSelect(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: any) => {
        this.handleFileUpload(file);
      });
    }
  }

  onEditImageSelect(event: any): void {
    this.onImageSelect(event);
  }

  // ========== NULL-SAFETY HELPER METHODS ==========
  // These methods safely handle optional properties

  getProductStock(product: ProductDto): number {
    return product.stock || product.stockQuantity || 0;
  }

  getProductPrice(product: ProductDto): number {
    return product.price || product.resellerMaxPrice || 0;
  }

  getProductDiscountPrice(product: ProductDto): number {
    return product.discountPrice || 0;
  }

  getStatusClass(status: boolean): string {
    return status ? 'active' : 'inactive';
  }

  safeFormatPrice(price: number | undefined): string {
    return this.formatPrice(price || 0);
  }

  safeGetDiscountPercentage(price: number | undefined, discountPrice: number | undefined): string {
    return this.getDiscountPercentage(price || 0, discountPrice || 0);
  }

  getProductBrand(product: ProductDto): string {
    return product.brandName || (product as any).BrandName || 'Generic';
  }
}
