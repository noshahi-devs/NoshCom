import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-seller-coming-soon',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="coming-soon text-center py-5">
        <div class="card border-0 shadow-sm p-5 rounded-4 bg-white">
            <i class="fas fa-tools fa-4x text-primary mb-4"></i>
            <h2 class="fw-bold text-dark">{{ pageName }}</h2>
            <p class="text-muted">This module is currently being migrated and will be available soon.</p>
            <div class="mt-4">
                <button routerLink="/seller/dashboard" class="btn btn-primary px-4 rounded-pill">Back to Dashboard</button>
            </div>
        </div>
    </div>
    `,
    styles: [`
        .coming-soon { min-height: 60vh; display: flex; align-items: center; justify-content: center; }
        .card { max-width: 500px; width: 100%; border: 1px solid #eef2f7 !important; }
    `]
})
export class SellerComingSoonComponent implements OnInit {
    pageName: string = 'Page Under Development';

    constructor(private route: ActivatedRoute) { }

    ngOnInit() {
        const path = this.route.snapshot.url[this.route.snapshot.url.length - 1]?.path;
        if (path) {
            this.pageName = path.charAt(0).toUpperCase() + path.slice(1).replace('-', ' ') + ' Section';
        }
    }
}
