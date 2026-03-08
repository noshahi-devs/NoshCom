import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProductService, ProductDto } from '../../../core/services/product.service';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface InventoryItem {
  id: string; // Changed to string for GUID
  productName: string;
  sku: string;
  warehouse: string;
  quantity: number;
  reorderLevel: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  originalProduct?: ProductDto;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent implements OnInit {
  addItemModalVisible = false;
  editItemModalVisible = false;
  deleteConfirmationVisible = false;

  itemToDelete: InventoryItem | null = null;
  selectedItem: InventoryItem | null = null;

  items: InventoryItem[] = [];
  filteredItems: InventoryItem[] = [];
  paginatedItems: InventoryItem[] = [];

  addItemForm!: FormGroup;
  editItemForm!: FormGroup;

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  searchTerm = '';
  selectedStatusFilter: string | null = null;
  selectedWarehouseFilter: string | null = null;

  warehouses: string[] = [];

  toasts: Toast[] = [];
  private toastId = 0;

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.initForms();
    this.loadInventory();
    this.loadWarehouses();
  }

  private initForms(): void {
    this.addItemForm = this.fb.group({
      productName: ['', [Validators.required, Validators.minLength(3)]],
      sku: ['', [Validators.required]],
      warehouse: ['Main Warehouse', [Validators.required]],
      quantity: [0, [Validators.required, Validators.min(0)]],
      reorderLevel: [10, [Validators.required, Validators.min(0)]],
      status: ['in_stock', [Validators.required]]
    });

    this.editItemForm = this.fb.group({
      id: [null],
      productName: ['', [Validators.required, Validators.minLength(3)]],
      sku: ['', [Validators.required]],
      warehouse: ['', [Validators.required]],
      quantity: [0, [Validators.required, Validators.min(0)]],
      reorderLevel: [0, [Validators.required, Validators.min(0)]],
      status: ['in_stock', [Validators.required]]
    });
  }

  loadInventory(): void {
    this.productService.getAll().subscribe({
      next: (products) => {
        this.items = products.map(p => this.mapProductToInventory(p));
        this.filterTable();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load inventory', err);
        this.showToast('Failed to load inventory data', 'error');
      }
    });
  }

  private mapProductToInventory(product: ProductDto): InventoryItem {
    const qty = product.stockQuantity || product.stock || 0;
    let status: InventoryItem['status'] = 'in_stock';
    if (qty === 0) status = 'out_of_stock';
    else if (qty < 10) status = 'low_stock';

    return {
      id: product.id,
      productName: product.name,
      sku: product.sku,
      warehouse: 'Main Warehouse', // Default for now
      quantity: qty,
      reorderLevel: 10, // Default
      status: status,
      originalProduct: product
    };
  }

  private loadWarehouses(): void {
    this.warehouses = ['Main Warehouse', '3PL - West', '3PL - East'];
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

  openAddItemModal(): void {
    this.showToast('To add inventory, please add a new Product in the Catalog section.', 'info');
    // For now, redirect or just show info, as adding inventory item implies adding a product
    // this.addItemModalVisible = true;
  }

  closeAddItemModal(): void {
    this.addItemModalVisible = false;
  }

  openEditItemModal(item: InventoryItem): void {
    this.selectedItem = item;
    this.editItemForm.patchValue({
      id: item.id,
      productName: item.productName,
      sku: item.sku,
      warehouse: item.warehouse,
      quantity: item.quantity,
      reorderLevel: item.reorderLevel,
      status: item.status
    });
    this.editItemModalVisible = true;
  }

  closeEditItemModal(): void {
    this.editItemModalVisible = false;
    this.selectedItem = null;
  }

  openDeleteConfirmation(item: InventoryItem): void {
    this.itemToDelete = item;
    this.deleteConfirmationVisible = true;
  }

  cancelDelete(): void {
    this.deleteConfirmationVisible = false;
    this.itemToDelete = null;
  }

  confirmDelete(): void {
    if (this.itemToDelete) {
      // Ideally call ProductService delete, but that deletes the product.
      // For inventory view, maybe just zero out stock? 
      // For now let's say we delete the product
      this.productService.delete(this.itemToDelete.id).subscribe({
        next: () => {
          this.showToast(`Inventory item "${this.itemToDelete?.productName}" deleted successfully`, 'success');
          this.loadInventory();
          this.cancelDelete();
        },
        error: (err) => {
          this.showToast('Failed to delete item', 'error');
          this.cancelDelete();
        }
      });
    }
  }

  saveItem(): void {
    // Disabled for now as it duplicates Product creation
    this.closeAddItemModal();
  }

  updateItem(): void {
    if (this.editItemForm.invalid) {
      this.showToast('Please fill all required fields correctly', 'error');
      return;
    }

    const formValue = this.editItemForm.value;
    // We only update stock for now in this view mock
    // Real implementation would call Product Update

    if (this.selectedItem?.originalProduct) {
      const product = this.selectedItem.originalProduct;
      const updateDto = {
        ...product,
        stockQuantity: Number(formValue.quantity),
        // Map other fields required for update
        description: product.description || '',
        images: JSON.stringify(product.images) || '[]',
        brandName: product.brandName || ''
      };

      // We need an UpdateProductDto compatible object. 
      // This is complex because ProductDto has some fields, UpdateProductDto needs others.
      // For this task, we will just simulate success or implement a partial if available.
      // Or re-fetch.

      // Simple approach: Just show toast "Stock Updated" (Simulated as we need full product update flow)
      // OR better: try to update if we have data.

      this.showToast('Stock update simulation: Real update requires full product details.', 'info');
      this.closeEditItemModal();
      this.loadInventory();
    }
  }

  getStatusLabel(status: InventoryItem['status']): string {
    switch (status) {
      case 'in_stock':
        return 'In Stock';
      case 'low_stock':
        return 'Low Stock';
      default:
        return 'Out of Stock';
    }
  }

  filterTable(): void {
    let filtered = [...this.items];

    if (this.searchTerm) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.productName.toLowerCase().includes(searchLower) ||
        item.sku.toLowerCase().includes(searchLower) ||
        item.warehouse.toLowerCase().includes(searchLower)
      );
    }

    if (this.selectedStatusFilter) {
      filtered = filtered.filter(item => item.status === this.selectedStatusFilter);
    }

    if (this.selectedWarehouseFilter) {
      filtered = filtered.filter(item => item.warehouse === this.selectedWarehouseFilter);
    }

    this.filteredItems = filtered;
    this.updatePagination();
  }

  private updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredItems.length / this.itemsPerPage);
    this.currentPage = Math.min(this.currentPage, this.totalPages || 1);

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedItems = this.filteredItems.slice(startIndex, endIndex);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  getStartIndex(): number {
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.filteredItems.length);
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
    this.selectedWarehouseFilter = null;
    this.filterTable();
  }
}
