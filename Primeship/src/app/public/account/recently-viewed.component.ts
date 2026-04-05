import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { RecentlyViewedItem, RecentlyViewedService } from '../../core/services/recently-viewed.service';

@Component({
  selector: 'app-recently-viewed',
  standalone: false,
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
    const qp: any = {};
    if (item.id) qp.id = item.id;
    if (item.sku && !qp.id) qp.sku = item.sku;
    const slug = item.slug || 'item';
    this.router.navigate(['/product', slug], { queryParams: qp });
  }

  async clear(): Promise<void> {
    const res = await Swal.fire({ title: 'Clear recently viewed?', text: 'This will remove the list from this browser.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Clear' });
    if (!res.isConfirmed) return;
    this.recentlyViewedService.clear();
    this.refresh();
  }
}
