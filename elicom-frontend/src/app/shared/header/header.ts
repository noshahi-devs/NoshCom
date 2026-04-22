import { Component, signal, ElementRef, ViewChild, inject, effect, HostListener, AfterViewChecked, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, RouterModule } from '@angular/router';
import { CartService, CartItem } from '../../services/cart.service';
import { SearchService } from '../../services/search.service';
import { AuthService, User } from '../../services/auth.service';
import { CategoryService } from '../../services/category';
import { ProductService } from '../../services/product.service';
import { environment } from '../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { AuthModalComponent } from '../components/auth-modal/auth-modal.component';
import Swal from 'sweetalert2';
import { SmartPricePipe } from '../pipes/smart-price.pipe';

interface MegaMenuItem {
  label: string;
  query: string;
  image: string;
}

interface MegaMenuSection {
  title: string;
  items: MegaMenuItem[];
}

interface MegaMenu {
  key: string;
  heading: string;
  sections: MegaMenuSection[];
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterModule, FormsModule, AuthModalComponent, SmartPricePipe],
  templateUrl: './header.html',
  styleUrls: ['./header.scss'],
  encapsulation: ViewEncapsulation.None
})
export class Header implements OnInit, AfterViewChecked {
  userDropdown = signal(false);
  cartDropdown = signal(false);
  globeDropdown = signal(false);
  authModalOpen = signal(false); // Controls the Auth Modal visibility
  searchTerm = '';
  isSearchVisible = signal(true);
  activeMegaMenu = signal<string | null>(null);
  hoveredCategoryLabel = signal<string>('');
  hoveredCategory = signal<any | null>(null);

  categories = signal<any[]>([]);

  cartService = inject(CartService);
  searchService = inject(SearchService);
  authService = inject(AuthService); // Inject AuthService
  categoryService = inject(CategoryService);
  productService = inject(ProductService);
  router = inject(Router);
  private categoryProductCache = new Map<string, any[]>();

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
      if (this.cartService.consumeAutoOpenTrigger(trigger)) {
        this.openSidebar();
      }
    });

    // Handle body scroll when cart is open
    effect(() => {
      const isOpen = this.cartDropdown();
      const els = [document.body, document.documentElement];
      if (isOpen) {
        els.forEach(el => el.classList.add('no-scroll'));
      } else {
        els.forEach(el => el.classList.remove('no-scroll'));
      }
    });

    // Automatically close sidebar on route changes
    this.router.events.subscribe(event => {
      if (event.constructor.name === 'NavigationStart') {
        this.closeModal();
      }
    });

    // Listen to Auth Service requests to open modal
    this.authService.showAuthModal$.subscribe(show => {
      if (show && !this.authService.isAuthenticated) {
        this.authModalOpen.set(true);
      } else if (!show) {
        this.authModalOpen.set(false);
      }
    });

    // Auto-close auth modal if user becomes authenticated
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.authModalOpen.set(false);
        this.authService.closeAuthModal();
      }
    });
  }

  ngOnInit() {
    this.loadCategories();
    if (this.authService.isAuthenticated) {
      this.cartService.refreshFromBackend().subscribe();
    }
  }

  loadCategories() {
    this.categoryService.getHomepageCategories().subscribe({
      next: (res) => {
        this.categories.set((res || []).filter((cat: any) => this.isRenderableCategory(cat)));
      },
      error: (err) => {
        console.error('Failed to load nav categories', err);
      }
    });
  }

  openAllCategoriesMegaMenu() {
    this.hoveredCategory.set(null);
    this.hoveredCategoryLabel.set('All Categories');
    this.activeMegaMenu.set('all');
  }

  openMegaMenu(category: any) {
    const name = this.normalizeCategoryName(category?.name);
    const key = this.getCategoryMenuKey(category);

    this.hoveredCategory.set(category);
    this.hoveredCategoryLabel.set(name || 'Browse');
    this.activeMegaMenu.set(key);

    if (name) {
      this.loadCategoryProducts(name);
    }
  }

  keepMegaMenuOpen(menuKey: string) {
    this.activeMegaMenu.set(menuKey);
  }

  closeMegaMenu() {
    this.activeMegaMenu.set(null);
  }

  getMegaMenu(menuKey: string | undefined): MegaMenu | undefined {
    if (!menuKey) {
      return undefined;
    }

    if (menuKey === 'all') {
      return this.buildAllCategoriesMegaMenu();
    }

    return this.buildCategoryMegaMenu(this.hoveredCategory() || this.findCategoryByMenuKey(menuKey));
  }

  getCategoryMenuKey(category: any): string | null {
    return this.normalizeMenuKey(category?.slug || category?.name);
  }

  getCategoryQuery(category: any): Record<string, string> {
    const name = this.normalizeCategoryName(category?.name);
    return name ? { category: name } : {};
  }

  isRenderableCategory(category: any): boolean {
    return !!this.normalizeCategoryName(category?.name);
  }

  private loadCategoryProducts(categoryName: string) {
    const key = this.normalizeMenuKey(categoryName);
    if (!key || this.categoryProductCache.has(key)) {
      return;
    }

    this.productService.search(categoryName).subscribe({
      next: (res: any) => {
        const items = this.extractItems(res)
          .filter((item: any) => {
            const cat = this.normalizeCategoryName(item?.categoryName || item?.category?.name || item?.category);
            return !cat || cat.toLowerCase() === categoryName.toLowerCase();
          })
          .map((item: any) => this.mapProductToMenuItem(item))
          .filter((item: MegaMenuItem | null): item is MegaMenuItem => !!item);

        this.categoryProductCache.set(key, items);
      },
      error: (err) => {
        console.error('Failed to load products for mega menu', err);
        this.categoryProductCache.set(key, []);
      }
    });
  }

  private buildAllCategoriesMegaMenu(): MegaMenu {
    const categories = this.categories();
    const sections = this.splitIntoColumns(categories, 4).map((column, index) => ({
      title: index === 0 ? 'All Categories' : index === 1 ? 'Popular' : index === 2 ? 'More' : 'Explore',
      items: column.map((cat: any) => this.mapCategoryToMenuItem(cat)).filter((item): item is MegaMenuItem => !!item)
    }));

    return {
      key: 'all',
      heading: 'All Categories',
      sections
    };
  }

  private buildCategoryMegaMenu(category: any): MegaMenu {
    const name = this.normalizeCategoryName(category?.name);
    const relatedCategories = this.getRelatedCategories(category);
    const productItems = this.categoryProductCache.get(this.normalizeMenuKey(name)) || [];
    const productColumns = this.splitIntoColumns(productItems, 3);

    const sections: MegaMenuSection[] = [
      {
        title: name || 'Category',
        items: [category, ...relatedCategories]
          .map((cat: any) => this.mapCategoryToMenuItem(cat))
          .filter((item): item is MegaMenuItem => !!item)
      },
      ...productColumns.map((column, index) => ({
        title: index === 0 ? 'Products' : index === 1 ? 'More Products' : 'Trending',
        items: column
      }))
    ];

    return {
      key: this.normalizeMenuKey(name) || 'default',
      heading: name || 'Browse',
      sections
    };
  }

  private normalizeCategoryName(value: any): string {
    return (value ?? '').toString().trim();
  }

  private normalizeMenuKey(value: any): string {
    return this.normalizeCategoryName(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  private extractItems(res: any): any[] {
    if (Array.isArray(res)) return res;
    if (res?.result?.items && Array.isArray(res.result.items)) return res.result.items;
    if (res?.result && Array.isArray(res.result)) return res.result;
    if (res?.items && Array.isArray(res.items)) return res.items;
    return [];
  }

  private mapCategoryToMenuItem(cat: any): MegaMenuItem | null {
    const label = this.normalizeCategoryName(cat?.name || cat?.categoryName || cat?.title);
    if (!label) return null;

    return {
      label,
      query: label,
      image: cat?.imageUrl || cat?.image || 'assets/images/placeholder.jpg'
    };
  }

  private mapProductToMenuItem(product: any): MegaMenuItem | null {
    const label = this.normalizeCategoryName(product?.name || product?.title || product?.productName);
    if (!label) return null;

    const rawImage =
      product?.image1 ||
      product?.productImage ||
      product?.imageUrl ||
      (Array.isArray(product?.images) ? product.images[0] : null) ||
      'assets/images/placeholder.jpg';

    return {
      label,
      query: label,
      image: this.resolveImageUrl(rawImage)
    };
  }

  private getRelatedCategories(category: any): any[] {
    const all = this.categories();
    const currentName = this.normalizeCategoryName(category?.name);
    const currentKey = this.normalizeMenuKey(currentName);
    const tokens = this.getCategoryTokens(currentName);

    const scored = all
      .filter((item: any) => this.normalizeCategoryName(item?.name) && this.normalizeMenuKey(item?.name) !== currentKey)
      .map((item: any) => {
        const candidateName = this.normalizeCategoryName(item?.name);
        const candidateTokens = this.getCategoryTokens(candidateName);
        const shared = candidateTokens.filter(token => tokens.includes(token)).length;
        const familyBoost = tokens.some(token => candidateName.toLowerCase().includes(token)) ? 1 : 0;
        return { item, score: shared + familyBoost };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item);

    if (scored.length > 0) {
      return scored.slice(0, 6);
    }

    return all
      .filter((item: any) => this.normalizeMenuKey(item?.name) !== currentKey)
      .slice(0, 6);
  }

  private getCategoryTokens(value: string): string[] {
    return this.normalizeCategoryName(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter(token => token.length > 2 && !['and', 'the', 'for', 'with', 'from', 'living', 'category'].includes(token));
  }

  private splitIntoColumns<T>(items: T[], columnCount: number): T[][] {
    const safeCount = Math.max(1, columnCount);
    const columns: T[][] = Array.from({ length: safeCount }, () => []);
    items.forEach((item, index) => {
      columns[index % safeCount].push(item);
    });
    return columns;
  }

  private findCategoryByMenuKey(menuKey: string): any | null {
    const key = this.normalizeMenuKey(menuKey);
    return this.categories().find((cat: any) => this.normalizeMenuKey(cat?.slug || cat?.name) === key) || null;
  }

  private resolveImageUrl(rawValue: any): string {
    const value = this.normalizeImageValue(rawValue);
    if (!value) {
      return 'assets/images/placeholder.jpg';
    }

    const urlMatch = value.match(/https?:\/\/[^\s"'<>]+/i);
    if (urlMatch) {
      return urlMatch[0];
    }

    if (value.includes('cdn.elicom.com')) {
      return 'assets/images/placeholder.jpg';
    }

    if (value.startsWith('http') || value.startsWith('/') || value.startsWith('assets/')) {
      return value;
    }

    return `${environment.apiUrl}/images/products/${value}`;
  }

  private normalizeImageValue(rawValue: any): string {
    let value = (rawValue ?? '').toString().trim();
    if (!value) return '';

    value = value
      .replace(/^\["/, '')
      .replace(/"\]$/, '')
      .replace(/^"/, '')
      .replace(/"$/, '')
      .replace(/\\"/g, '');

    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return this.normalizeImageValue(parsed[0]);
        }
      } catch {
        // fall through
      }
    }

    return value;
  }

  trackByCategory(index: number, item: any) {
    return item?.id || item?.categoryId || item?.slug || item?.name || index;
  }

  trackByMenuGroup(index: number, group: MegaMenuSection) {
    return group.title || index;
  }

  trackByMenuItem(index: number, item: MegaMenuItem) {
    return item.label || index;
  }

  @ViewChild('navbar', { static: true })
  navbar!: ElementRef<HTMLElement>;

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (Date.now() - this.lastCartOpenAt < 250) {
      return;
    }
    
    // Close if click is outside cart-wrapper, sidebar, and Swal dialogs
    const isCartClick = !!target.closest('.cart-wrapper') || !!target.closest('.cart-sidebar');
    const isOverlayClick = !!target.closest('.cart-overlay');
    const isSwalClick = !!target.closest('.swal2-container');
    
    if (!isCartClick && !isOverlayClick && !isSwalClick && this.cartDropdown()) {
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

  openSidebar() {
    this.cartDropdown.set(true);
    this.lastCartOpenAt = Date.now();
  }

  closeModal() {
    this.cartDropdown.set(false);
  }

  proceedToCheckout() {
    this.closeModal();
    this.router.navigate(['/add-to-cart']);
  }

  onMouseEnterCart() {
    // Logic removed for sidebar
  }

  onMouseLeaveCart() {
    // Logic removed for sidebar
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
        this.authService.navigateToDashboard();
        return;
      }

      if (this.authService.isCustomer()) {
        this.router.navigate(['/customer/dashboard']);
        return;
      }

      this.router.navigate(['/customer/dashboard']);
    } else {
      // If not logged in, open login modal
      this.authService.openAuthModal();
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

  onAuthModalClose() {
    this.authModalOpen.set(false);
    this.authService.closeAuthModal();
  }

  onAuthAuthenticated() {
    this.authModalOpen.set(false);
    this.authService.closeAuthModal();
  }

  getUserDisplayName(user: User | null): string {
    if (!user) {
      return 'Guest';
    }

    const fullName = `${user.name || ''} ${user.surname || ''}`.trim();
    return fullName || user.userName || user.emailAddress || 'Member';
  }

  getUserInitial(user: User | null): string {
    const label = this.getUserDisplayName(user);
    return label.charAt(0).toUpperCase() || 'U';
  }
}
