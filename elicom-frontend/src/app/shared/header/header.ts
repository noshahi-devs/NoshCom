import { Component, signal, ElementRef, ViewChild, inject, effect, HostListener, AfterViewChecked, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, RouterModule } from '@angular/router';
import { CartService, CartItem } from '../../services/cart.service';
import { SearchService } from '../../services/search.service';
import { AuthService } from '../../services/auth.service';
import { CategoryService } from '../../services/category';
import { FormsModule } from '@angular/forms';
import { AuthModalComponent } from '../components/auth-modal/auth-modal.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterModule, FormsModule, AuthModalComponent],
  templateUrl: './header.html',
  styleUrls: ['./header.scss']
})
export class Header implements OnInit, AfterViewChecked {
  userDropdown = signal(false);
  cartDropdown = signal(false);
  globeDropdown = signal(false);
  authModalOpen = signal(false); // Controls the Auth Modal visibility
  searchTerm = '';
  isSearchVisible = signal(true);

  categories = signal<any[]>([]);

  cartService = inject(CartService);
  searchService = inject(SearchService);
  authService = inject(AuthService); // Inject AuthService
  categoryService = inject(CategoryService);
  router = inject(Router);

  // currentUser signal derived from AuthService
  currentUser = this.authService.currentUser$;
  isAuthenticated = this.authService.isAuthenticated$;

  autoHideTimer: any;
  isHovered = false;
  private lastCartOpenAt = 0;

  constructor() {
    // Listen for new items added to cart to auto-open the modal
    effect(() => {
      const trigger = this.cartService.cartAutoOpen();
      if (trigger > 0) {
        this.openModal();
      }
    });

    // Listen to Auth Service requests to open modal
    // We subscribe manually since effect() is for signals, or we could use toSignal if we strictly wanted signals
    this.authService.showAuthModal$.subscribe(show => {
      if (show) this.authModalOpen.set(true);
    });
  }

  ngOnInit() {
    this.loadCategories();
    if (this.authService.isAuthenticated) {
      this.cartService.refreshFromBackend().subscribe();
    }
  }

  loadCategories() {
    this.categoryService.getAllCategories(50).subscribe({
      next: (res) => {
        this.categories.set(res);
      },
      error: (err) => {
        console.error('Failed to load nav categories', err);
      }
    });
  }

  @ViewChild('navbar', { static: true })
  navbar!: ElementRef<HTMLElement>;

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (Date.now() - this.lastCartOpenAt < 250) {
      return;
    }
    // Close if click is outside cart-wrapper
    if (!target.closest('.cart-wrapper')) {
      this.cartDropdown.set(false);
      if (this.autoHideTimer) clearTimeout(this.autoHideTimer);
    }

    if (!target.closest('.currency-menu-wrapper')) {
      this.globeDropdown.set(false);
    }

    if (!target.closest('.user-menu-wrapper')) {
      this.userDropdown.set(false);
    }
  }

  ngAfterViewChecked() {
    // Set indeterminate state for store checkboxes
    this.getStores().forEach(storeName => {
      const checkbox = document.getElementById('store-' + storeName) as HTMLInputElement;
      if (checkbox) {
        const isPartiallyChecked = this.isAnyStoreItemChecked(storeName) && !this.isStoreChecked(storeName);
        checkbox.indeterminate = isPartiallyChecked;
      }
    });
  }

  openModal() {
    this.cartDropdown.set(true);
    this.lastCartOpenAt = Date.now();
    this.startTimer();
  }

  closeModal() {
    this.cartDropdown.set(false);
    if (this.autoHideTimer) clearTimeout(this.autoHideTimer);
  }

  startTimer() {
    if (this.autoHideTimer) clearTimeout(this.autoHideTimer);
    this.autoHideTimer = setTimeout(() => {
      if (!this.isHovered) {
        this.cartDropdown.set(false);
      }
    }, 3000);
  }

  onMouseEnterCart() {
    this.isHovered = true;
    if (this.autoHideTimer) clearTimeout(this.autoHideTimer);
  }

  onMouseLeaveCart() {
    this.isHovered = false;
    this.startTimer();
  }

  incrementQty(item: CartItem) {
    this.cartService.updateQuantity(item.productId, item.size, item.color, item.quantity + 1);
  }

  decrementQty(item: CartItem) {
    if (item.quantity > 1) {
      this.cartService.updateQuantity(item.productId, item.size, item.color, item.quantity - 1);
    }
  }

  removeItem(item: CartItem) {
    Swal.fire({
      title: "Are you sure?",
      text: "You will not be able to recover this item!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#DD6B55",
      confirmButtonText: "Yes, delete it!"
    }).then((result) => {
      if (result.isConfirmed) {
        this.cartService.removeItem(item);
        Swal.fire("Deleted!", "Your item has been deleted.", "success");
      }
    });
  }

  scrollAmount = 300;

  scrollLeft() {
    if (this.navbar) {
      this.navbar.nativeElement.scrollBy({ left: -this.scrollAmount, behavior: 'smooth' });
    }
  }

  scrollRight() {
    if (this.navbar) {
      this.navbar.nativeElement.scrollBy({ left: this.scrollAmount, behavior: 'smooth' });
    }
  }

  // Checkbox handling methods
  onItemCheckboxChange(item: CartItem) {
    this.cartService.toggleItemCheckbox(item.productId, item.size, item.color);
  }

  onStoreCheckboxChange(storeName: string, event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.cartService.toggleStoreCheckbox(storeName, checkbox.checked);
  }

  onAllCheckboxChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.cartService.toggleAllCheckbox(checkbox.checked);
  }

  isStoreChecked(storeName: string): boolean {
    return this.cartService.isStoreChecked(storeName);
  }

  isAnyStoreItemChecked(storeName: string): boolean {
    return this.cartService.isAnyStoreItemChecked(storeName);
  }

  isAllChecked(): boolean {
    return this.cartService.isAllChecked();
  }

  getStores(): string[] {
    return this.cartService.getStores();
  }

  getItemsByStore(storeName: string): CartItem[] {
    return this.cartService.getItemsByStore(storeName);
  }

  onSearch() {
    if (this.searchTerm.trim()) {
      this.searchService.setSearchTerm(this.searchTerm);
      this.router.navigate(['/search-result'], { queryParams: { q: this.searchTerm } });
    }
  }

  userMenuTimer: any;

  onMouseEnterUser() {
    // Only show if logged in
    // We can check the signal value or the service property directly if it's synchronous enough
    // But since isAuthenticated is an Observable in the template, let's strictly check:
    if (this.authService.isAuthenticated) {
      this.userDropdown.set(true);
      if (this.userMenuTimer) clearTimeout(this.userMenuTimer);
    }
  }

  onMouseLeaveUser() {
    if (this.authService.isAuthenticated) {
      this.userMenuTimer = setTimeout(() => {
        this.userDropdown.set(false);
      }, 300); // 300ms delay
    }
  }

  toggleUserMenu() {
    if (this.authService.isAuthenticated) {
      if (this.authService.isAdmin()) {
        this.router.navigate(['/admin/dashboard']);
        return;
      }

      if (this.authService.isSeller()) {
        this.router.navigate(['/seller/dashboard']);
        return;
      }

      if (this.authService.isCustomer()) {
        this.router.navigate(['/customer/dashboard']);
        return;
      }

      this.router.navigate(['/customer/dashboard']);
    } else {
      // If not logged in, open login modal
      this.authModalOpen.set(true);
    }
  }

  toggleSearch() {
    this.isSearchVisible.update(v => !v);
  }

  logout() {

    this.authService.logout();
    this.userDropdown.set(false);
    this.router.navigate(['/']);
  }
}
