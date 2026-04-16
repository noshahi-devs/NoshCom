import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { RecentlyViewedItem, RecentlyViewedService } from '../../core/services/recently-viewed.service';

@Component({
  selector: 'app-recently-viewed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recently-viewed.component.html',
  styleUrls: ['./recently-viewed.component.scss']
})
export class RecentlyViewedComponent implements OnInit {
  items: RecentlyViewedItem[] = [];

  constructor(
    private recentlyViewedService: RecentlyViewedService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.items = this.recentlyViewedService.list();
  }

  open(item: RecentlyViewedItem): void {
    const routeSlug = this.getProductRoute(item);
    const queryParams: Record<string, string> = {};
    if (item.id) {
      queryParams['id'] = String(item.id);
    }
    if (item.sku) {
      queryParams['sku'] = String(item.sku);
    }

    if (routeSlug) {
      this.router.navigate(['/product', routeSlug], { queryParams });
      return;
    }

    this.router.navigate(['/shop']);
  }

  private getProductRoute(item: RecentlyViewedItem): string {
    const raw = (item.slug || item.name || item.sku || item.id || '').toString().trim();
    if (!raw) {
      return '';
    }

    return raw
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async clear(): Promise<void> {
    const res = await Swal.fire({ title: 'Clear recently viewed?', text: 'This will remove the list from this browser.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Clear' });
    if (!res.isConfirmed) return;
    this.recentlyViewedService.clear();
    this.refresh();
  }
}
