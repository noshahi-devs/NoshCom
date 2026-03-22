import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidatorFn } from '@angular/forms';
import { ProductService, ProductDto, CreateProductDto, UpdateProductDto } from '../../../core/services/product.service';
import { ProductImportService, ProductImportResult } from '../../../core/services/product-import.service';
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
  latestCreatedProductId: string | null = null;
  latestCreatedProductSku: string | null = null;
  latestCreatedProductName: string | null = null;

  // Image management
  imageUrls: string[] = [];
  currentImageUrl = '';

  // Loading state
  isLoading = false;
  isCategoriesLoading = false;
  isImportingProduct = false;
  importUrl = '';
  importWarning = '';
  importPriceIsFinal = false;
  private readonly defaultImportDiscount = 5;
  private readonly pkrPerUsd = 280;
  private readonly amazonImportDivisor = 1690;
  private readonly importPkrHeuristicThreshold = 10000;

  // Template compatibility properties
  imagePreviewUrls: string[] = []; // For template compatibility
  isUploading = false; // For template compatibility
  uploadingIndexes = new Set<number>();


  constructor(
    private fb: FormBuilder,
    public productService: ProductService,
    private productImportService: ProductImportService,
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
      name: ['', [Validators.required, Validators.minLength(3), this.productNameValidator()]],
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
      name: ['', [Validators.required, Validators.minLength(3), this.productNameValidator()]],
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

  get isSkuGenerating(): boolean {
    if (!this.addProductModalVisible) return false;
    const raw = this.addProductForm.getRawValue();
    const name = (raw.name ?? '').toString().trim();
    const categoryId = raw.categoryId;
    const sku = (raw.sku ?? '').toString().trim();
    if (!name || !categoryId) return true;
    return !sku;
  }

  private productNameValidator(excludeId?: string): ValidatorFn {
    return (control: AbstractControl) => {
      const rawValue = (control.value ?? '').toString().trim();
      if (!rawValue) return null;

      const normalized = this.normalizeProductName(rawValue);
      const hasDuplicate = this.products.some(product => {
        if (excludeId && String(product.id) === String(excludeId)) {
          return false;
        }
        return this.normalizeProductName(product.name) === normalized;
      });

      return hasDuplicate ? { duplicate: true } : null;
    };
  }

  private normalizeProductName(value: string): string {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private sortProducts(products: ProductDto[], pinnedId?: string, pinnedSku?: string, pinnedName?: string): ProductDto[] {
    const toTime = (product: ProductDto): number => {
      const keys = [
        'updatedAt',
        'createdAt',
        'lastModificationTime',
        'lastModifiedAt',
        'lastModifiedTime',
        'creationTime',
        'createdOn',
        'createdAt',
        'UpdatedAt',
        'CreatedAt',
        'CreationTime'
      ];

      for (const key of keys) {
        const raw = (product as any)?.[key];
        if (!raw) continue;
        const parsed = new Date(raw).getTime();
        if (!Number.isNaN(parsed)) return parsed;
      }
      return 0;
    };

    return [...products].sort((a, b) => {
      if (pinnedId || pinnedSku || pinnedName) {
        const aPinned =
          (pinnedId && String(a.id) === String(pinnedId)) ||
          (pinnedSku && String(a.sku) === String(pinnedSku)) ||
          (pinnedName && this.normalizeProductName(a.name) === this.normalizeProductName(String(pinnedName)));
        const bPinned =
          (pinnedId && String(b.id) === String(pinnedId)) ||
          (pinnedSku && String(b.sku) === String(pinnedSku)) ||
          (pinnedName && this.normalizeProductName(b.name) === this.normalizeProductName(String(pinnedName)));
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
      }

      const bTime = toTime(b);
      const aTime = toTime(a);
      if (bTime !== aTime) return bTime - aTime;

      const bId = Number(b.id);
      const aId = Number(a.id);
      if (!Number.isNaN(bId) && !Number.isNaN(aId)) {
        return bId - aId;
      }

      return String(b.id ?? '').localeCompare(String(a.id ?? ''), undefined, { numeric: true });
    });
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
          createdAt: (p as any).creationTime ? new Date((p as any).creationTime)
            : (p as any).CreatedAt ? new Date((p as any).CreatedAt)
              : (p as any).createdAt ? new Date((p as any).createdAt)
                : undefined
        }));

        // De-duplicate by id/sku/name to avoid multiple identical rows
        const seen = new Set<string>();
        const deduped = normalized.filter(p => {
          const key = (p.id || p.sku || p.name || '').toString();
          if (!key) return true;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        this.products = this.sortProducts(
          deduped,
          this.latestCreatedProductId || undefined,
          this.latestCreatedProductSku || undefined,
          this.latestCreatedProductName || undefined
        );
        this.filterTable();
        this.isLoading = false;
        this.addProductForm.get('name')?.updateValueAndValidity({ emitEvent: false });
        this.editProductForm.get('name')?.updateValueAndValidity({ emitEvent: false });
        this.latestCreatedProductId = null;
        this.latestCreatedProductSku = null;
        this.latestCreatedProductName = null;
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
    this.importUrl = '';
    this.importWarning = '';
    this.importPriceIsFinal = false;
    this.addProductForm.get('name')?.updateValueAndValidity({ emitEvent: false });
    this.addProductModalVisible = true;
    this.cdr.detectChanges();
  }

  fetchProductFromUrl(): void {
    const url = this.importUrl?.trim();
    if (!url) {
      this.toastService.showError('Please paste a product URL first');
      return;
    }

    this.isImportingProduct = true;
    this.importWarning = '';
    this.importPriceIsFinal = false;
    this.cdr.detectChanges();

    this.productImportService.fetchProductByUrl(url).subscribe({
      next: (result) => {
        this.applyImportedProduct(result);
        this.isImportingProduct = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Product import failed:', error);
        this.toastService.showError('Failed to fetch product details from URL');
        this.isImportingProduct = false;
        this.cdr.detectChanges();
      }
    });
  }

  private applyImportedProduct(result: ProductImportResult): void {
    if (!result) return;

    if (result.warning) {
      this.importWarning = result.warning;
    }

    const patch: any = {};
    if (result.name) patch.name = this.sanitizeImportedName(result.name);
    if (result.brand) patch.brandName = result.brand;
    if (result.description) patch.description = result.description;
    const rawAmazonPrice = this.resolveImportPrice(result);
    const amazonPrice = this.normalizeImportPrice(rawAmazonPrice, result.currency, result.sourceUrl);
    if (amazonPrice > 0) {
      const pricing = this.computeImportPricing(amazonPrice, this.defaultImportDiscount);
      patch.price = pricing.price;
      patch.discountPercentage = pricing.discountPercentage;
      this.importPriceIsFinal = true;
    }

    const categoryId = this.findCategoryIdByHint(result.categoryHint);
    if (categoryId) {
      patch.categoryId = categoryId;
    }

    this.addProductForm.patchValue(patch);

    if (result.images && result.images.length) {
      this.imageUrls = [...result.images];
      this.imagePreviewUrls = [...result.images];
    }

    this.updateGeneratedFields();

    if (result.name || result.description) {
      this.toastService.showSuccess('Product details imported. Please review before saving.');
    }
  }

  private findCategoryIdByHint(hint?: string): string | null {
    if (!hint) return null;
    const normalizedHint = hint.toLowerCase().trim();
    if (!normalizedHint) return null;

    const exact = this.categories.find(c => c.name.toLowerCase().trim() === normalizedHint);
    if (exact) return exact.id;

    const partial = this.categories.find(c =>
      c.name.toLowerCase().includes(normalizedHint) || normalizedHint.includes(c.name.toLowerCase())
    );
    return partial ? partial.id : null;
  }

  private computeImportPricing(amazonPrice: number, discountPercentage: number): { price: number; discountPercentage: number } {
    // Pricing logic: take 65% of Amazon price, then apply discount percentage
    const basePrice = amazonPrice * 0.65;
    const normalizedDiscount = Math.max(0, Math.min(100, Number(discountPercentage) || 0));
    const finalPrice = basePrice * (1 - (normalizedDiscount / 100));
    return {
      price: this.roundCurrency(finalPrice),
      discountPercentage: normalizedDiscount
    };
  }

  private normalizeImportPrice(price: number, currency?: string, sourceUrl?: string): number {
    const normalized = Number(price) || 0;
    if (normalized <= 0) return 0;

    const currencyCode = (currency || '').toString().trim().toUpperCase();
    if (!currencyCode || currencyCode === 'USD' || currencyCode === '$' || currencyCode === 'US$') {
      if (currencyCode) return normalized;
      const isAmazon = this.isAmazonUrl(sourceUrl);
      if (isAmazon && normalized >= this.importPkrHeuristicThreshold) {
        return this.roundCurrency(normalized / this.amazonImportDivisor);
      }
      return normalized;
    }

    if (currencyCode === 'PKR' || currencyCode === 'RS' || currencyCode === 'RS.') {
      return this.roundCurrency(normalized / this.pkrPerUsd);
    }

    return normalized;
  }

  private isAmazonUrl(sourceUrl?: string): boolean {
    if (!sourceUrl) return false;
    return sourceUrl.toLowerCase().includes('amazon.');
  }

  private parseImportedPrice(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const match = value.replace(/,/g, '').match(/(\d+(?:\.\d{1,2})?)/);
      if (!match) return 0;
      const parsed = parseFloat(match[1]);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (value && typeof value === 'object') {
      const obj = value as any;
      const candidates = [obj.amount, obj.value, obj.price, obj.Price, obj.listPrice, obj.ListPrice];
      for (const candidate of candidates) {
        const parsed = this.parseImportedPrice(candidate);
        if (parsed > 0) return parsed;
      }
    }
    return 0;
  }
  private resolveImportPrice(result: ProductImportResult): number {
    const candidateValues: unknown[] = [
      result.price,
      result.listPrice,
      (result as any)?.currentPrice,
      (result as any)?.CurrentPrice,
      (result as any)?.salePrice,
      (result as any)?.SalePrice
    ];

    const parsed = candidateValues
      .map(value => this.parseImportedPrice(value as any))
      .filter(value => value > 0);

    if (!parsed.length) return 0;

    const withinRange = parsed.filter(value => value <= 10000);
    return Math.min(...(withinRange.length ? withinRange : parsed));
  }
  private sanitizeImportedName(name: string): string {
    const trimmed = name.trim();
    return trimmed
      .replace(/^Amazon\.?com\s*[:\-�|]\s*/i, '')
      .replace(/^Amazon\.?com\s*/i, '')
      .replace(/^Amazon\s*[:\-�|]\s*/i, '')
      .trim();
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

    this.editProductForm.get('name')?.setValidators([
      Validators.required,
      Validators.minLength(3),
      this.productNameValidator(product.id)
    ]);
    this.editProductForm.get('name')?.updateValueAndValidity({ emitEvent: false });

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

    const pricing = this.importPriceIsFinal
      ? this.resolveImportedPricingForSave(formValue.price, formValue.discountPercentage)
      : {
        resellerMaxPrice: this.roundCurrency(Number(formValue.price) || 0),
        supplierPrice: this.calculateSupplierPrice(formValue.price, formValue.discountPercentage)
      };

    const input: CreateProductDto = {
      tenantId: 2, // Explicitly set Prime Ship Tenant ID
      name: formValue.name,
      sku: formValue.sku,
      categoryId: formValue.categoryId,
      description: formValue.description,
      brandName: formValue.brandName,
      images: this.productService.stringifyImages(this.imageUrls),
      supplierPrice: pricing.supplierPrice,
      resellerMaxPrice: pricing.resellerMaxPrice,
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
        this.currentPage = 1;
        this.latestCreatedProductId = result?.id ? String(result.id) : null;
        this.latestCreatedProductSku = result?.sku ? String(result.sku) : formValue?.sku ? String(formValue.sku) : null;
        this.latestCreatedProductName = result?.name ? String(result.name) : formValue?.name ? String(formValue.name) : null;
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

    const pricing = this.importPriceIsFinal
      ? this.resolveImportedPricingForSave(formValue.price, formValue.discountPercentage)
      : {
        resellerMaxPrice: this.roundCurrency(Number(formValue.price) || 0),
        supplierPrice: this.calculateSupplierPrice(formValue.price, formValue.discountPercentage)
      };

    
    const input: UpdateProductDto = {
      id: formValue.id,
      tenantId: 2, // Explicitly set Prime Ship Tenant ID
      name: formValue.name,
      sku: formValue.sku,
      categoryId: formValue.categoryId,
      description: formValue.description,
      brandName: formValue.brandName,
      images: this.productService.stringifyImages(this.imageUrls),
      supplierPrice: pricing.supplierPrice,
      resellerMaxPrice: pricing.resellerMaxPrice,
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
  private resolveImportedPricingForSave(price: number, discountPercentage: number): { resellerMaxPrice: number; supplierPrice: number } {
    const normalizedPrice = Number(price) || 0;
    const normalizedDiscount = Math.max(0, Math.min(99, Number(discountPercentage) || 0));
    const basePrice = normalizedDiscount > 0 ? (normalizedPrice / (1 - normalizedDiscount / 100)) : normalizedPrice;
    return {
      resellerMaxPrice: this.roundCurrency(basePrice),
      supplierPrice: this.roundCurrency(normalizedPrice)
    };
  }

  private roundCurrency(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round((value + Number.EPSILON) * 100) / 100;
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












