import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-verified',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-shell">
      <div class="page-card">
        <h1>Verified</h1>
        <p class="lead">Shop with confidence. Verified items go through extra checks for authenticity and quality.</p>
        <div class="grid">
          <div class="tile">
            <h3>Verified Suppliers</h3>
            <p>We validate business details and sourcing history.</p>
          </div>
          <div class="tile">
            <h3>Quality Checks</h3>
            <p>Extra screening for packaging, materials, and compliance.</p>
          </div>
          <div class="tile">
            <h3>Support</h3>
            <p>Priority help for verified-order issues.</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-shell { min-height: 60vh; padding: 70px 16px; background: #fff; }
    .page-card { max-width: 980px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 26px; box-shadow: 0 10px 25px rgba(15,23,42,0.06); }
    .lead { color: #4B5563; margin-top: 10px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
    .tile { border: 1px solid #E5E7EB; border-radius: 14px; padding: 14px; background: #F9FAFB; }
    .tile p { margin: 6px 0 0; color: #4B5563; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  `]
})
export class VerifiedComponent { }

@Component({
  selector: 'app-collaborations',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-shell">
      <div class="page-card">
        <h1>Collaborations</h1>
        <p class="lead">Limited collections and partner drops curated for quality and value.</p>
        <ul class="list">
          <li><strong>Brand Partnerships</strong> — seasonal launches with selected suppliers.</li>
          <li><strong>Creator Picks</strong> — curated bundles across categories.</li>
          <li><strong>Business Deals</strong> — volume pricing for wholesale buyers.</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .page-shell { min-height: 60vh; padding: 70px 16px; background: #fff; }
    .page-card { max-width: 980px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 26px; box-shadow: 0 10px 25px rgba(15,23,42,0.06); }
    .lead { color: #4B5563; margin-top: 10px; }
    .list { margin: 18px 0 0; padding-left: 18px; color: #111827; }
    .list li { margin: 10px 0; }
  `]
})
export class CollaborationsComponent { }

@Component({
  selector: 'app-shop-by-room',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-shell">
      <div class="page-card">
        <h1>Shop by Room</h1>
        <p class="lead">Pick a room to see popular categories and ideas.</p>
        <div class="room-grid">
          <a class="room" routerLink="/category/furniture">Living Room</a>
          <a class="room" routerLink="/category/bedding-bath">Bedroom</a>
          <a class="room" routerLink="/category/kitchen">Kitchen</a>
          <a class="room" routerLink="/category/lighting">Office</a>
          <a class="room" routerLink="/category/outdoor">Outdoor</a>
          <a class="room" routerLink="/category/decor-pillows">Decor</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-shell { min-height: 60vh; padding: 70px 16px; background: #fff; }
    .page-card { max-width: 980px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 26px; box-shadow: 0 10px 25px rgba(15,23,42,0.06); }
    .lead { color: #4B5563; margin-top: 10px; }
    .room-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
    .room { border: 1px solid #E5E7EB; border-radius: 14px; padding: 14px; text-decoration: none; color: #111827; font-weight: 700; background: #F9FAFB; }
    .room:hover { background: #F3F4F6; }
    @media (max-width: 900px) { .room-grid { grid-template-columns: 1fr; } }
  `]
})
export class ShopByRoomComponent { }

@Component({
  selector: 'app-inspiration',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-shell">
      <div class="page-card">
        <h1>Inspiration</h1>
        <p class="lead">Ideas and trending picks to help you decide faster.</p>
        <div class="grid">
          <div class="tile">
            <h3>Trending Right Now</h3>
            <p>New arrivals and best sellers across the store.</p>
          </div>
          <div class="tile">
            <h3>Budget Upgrades</h3>
            <p>Small changes that make a big difference.</p>
          </div>
          <div class="tile">
            <h3>Seasonal Collections</h3>
            <p>Fresh looks curated for the season.</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-shell { min-height: 60vh; padding: 70px 16px; background: #fff; }
    .page-card { max-width: 980px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 26px; box-shadow: 0 10px 25px rgba(15,23,42,0.06); }
    .lead { color: #4B5563; margin-top: 10px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
    .tile { border: 1px solid #E5E7EB; border-radius: 14px; padding: 14px; background: #F9FAFB; }
    .tile p { margin: 6px 0 0; color: #4B5563; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  `]
})
export class InspirationComponent { }

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-shell">
      <div class="page-card">
        <h1>Services</h1>
        <p class="lead">Extra help for ordering, design, and business sourcing.</p>
        <div class="service-grid">
          <a class="service" routerLink="/design-services">Design Services</a>
          <a class="service" routerLink="/track-order">Order Tracking</a>
          <a class="service" routerLink="/contact-support">Help & Contact</a>
          <a class="service" routerLink="/returns-policy">Returns</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-shell { min-height: 60vh; padding: 70px 16px; background: #fff; }
    .page-card { max-width: 980px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 26px; box-shadow: 0 10px 25px rgba(15,23,42,0.06); }
    .lead { color: #4B5563; margin-top: 10px; }
    .service-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
    .service { border: 1px solid #E5E7EB; border-radius: 14px; padding: 14px; text-decoration: none; color: #111827; font-weight: 700; background: #F9FAFB; }
    .service:hover { background: #F3F4F6; }
    @media (max-width: 900px) { .service-grid { grid-template-columns: 1fr; } }
  `]
})
export class ServicesComponent { }

@Component({
  selector: 'app-design-services',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-shell">
      <div class="page-card">
        <h1>Design Services</h1>
        <p class="lead">Tell us what you’re planning and we’ll help with a curated shortlist.</p>

        <div class="form">
          <label>
            Project type
            <select [(ngModel)]="projectType">
              <option value="Home Refresh">Home Refresh</option>
              <option value="Office Setup">Office Setup</option>
              <option value="Outdoor Space">Outdoor Space</option>
              <option value="Wholesale Sourcing">Wholesale Sourcing</option>
            </select>
          </label>

          <label>
            Budget (optional)
            <input [(ngModel)]="budget" placeholder="e.g. 500" />
          </label>

          <label>
            Notes
            <textarea [(ngModel)]="notes" rows="5" placeholder="Share your style, colors, sizes, timeline..."></textarea>
          </label>

          <button type="button" (click)="submit()">Request Design Help</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-shell { min-height: 60vh; padding: 70px 16px; background: #fff; }
    .page-card { max-width: 720px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 26px; box-shadow: 0 10px 25px rgba(15,23,42,0.06); }
    .lead { color: #4B5563; margin-top: 10px; }
    .form { display: grid; gap: 12px; margin-top: 18px; }
    label { display: grid; gap: 6px; font-weight: 700; color: #111827; font-size: 13px; }
    input, select, textarea { border: 1px solid #D1D5DB; border-radius: 10px; padding: 10px 12px; font-size: 14px; outline: none; }
    button { border: none; border-radius: 12px; padding: 12px 14px; background: #111827; color: #fff; font-weight: 800; cursor: pointer; }
    button:hover { background: #0B1220; }
  `]
})
export class DesignServicesComponent {
  projectType = 'Home Refresh';
  budget = '';
  notes = '';

  submit(): void {
    const payload = {
      projectType: this.projectType,
      budget: this.budget,
      notes: this.notes,
      createdAt: new Date().toISOString()
    };

    try {
      const raw = localStorage.getItem('designServiceRequests');
      const arr = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(arr) ? [payload, ...arr].slice(0, 25) : [payload];
      localStorage.setItem('designServiceRequests', JSON.stringify(next));
    } catch {
      // ignore
    }

    Swal.fire({ title: 'Request sent', text: 'Our team will contact you soon.', icon: 'success' });
    this.budget = '';
    this.notes = '';
  }
}

@Component({
  selector: 'app-gift-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-shell">
      <div class="page-card">
        <h1>Gift Card</h1>
        <p class="lead">Redeem a gift card code to add store credit to this browser.</p>

        <div class="row">
          <input [(ngModel)]="code" placeholder="Enter gift card code" />
          <button type="button" (click)="redeem()">Redeem</button>
        </div>

        <div class="credit">
          <span>Saved credit:</span>
          <strong>{{ credit | number:'1.2-2' }}</strong>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-shell { min-height: 60vh; padding: 70px 16px; background: #fff; }
    .page-card { max-width: 720px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 26px; box-shadow: 0 10px 25px rgba(15,23,42,0.06); }
    .lead { color: #4B5563; margin-top: 10px; }
    .row { display: flex; gap: 10px; margin-top: 16px; }
    input { flex: 1; border: 1px solid #D1D5DB; border-radius: 12px; padding: 12px 14px; font-size: 14px; outline: none; }
    button { border: none; border-radius: 12px; padding: 12px 14px; background: #111827; color: #fff; font-weight: 800; cursor: pointer; }
    .credit { margin-top: 18px; color: #111827; display: flex; gap: 8px; align-items: center; }
    .credit span { color: #6B7280; }
  `]
})
export class GiftCardComponent {
  code = '';
  credit = 0;

  constructor() {
    this.credit = this.getCredit();
  }

  private getCredit(): number {
    try {
      const raw = localStorage.getItem('giftCardCredit');
      const val = raw ? Number(raw) : 0;
      return Number.isFinite(val) ? val : 0;
    } catch {
      return 0;
    }
  }

  private setCredit(next: number): void {
    this.credit = next;
    try {
      localStorage.setItem('giftCardCredit', String(next));
    } catch {
      // ignore
    }
  }

  redeem(): void {
    const trimmed = (this.code || '').trim();
    if (!trimmed) {
      Swal.fire({ title: 'Enter a code', text: 'Please type a gift card code.', icon: 'info' });
      return;
    }

    const amount = 25;
    this.setCredit(this.credit + amount);
    Swal.fire({ title: 'Redeemed', text: `Added ${amount} credit.`, icon: 'success' });
    this.code = '';
  }
}

@Component({
  selector: 'app-rewards',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-shell">
      <div class="page-card">
        <h1>Rewards</h1>
        <p class="lead">Earn points on purchases and redeem them for discounts.</p>
        <div class="tile">
          <div class="k">Points (demo)</div>
          <div class="v">{{ points }}</div>
          <button type="button" (click)="earn()">Earn 50</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-shell { min-height: 60vh; padding: 70px 16px; background: #fff; }
    .page-card { max-width: 720px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 26px; box-shadow: 0 10px 25px rgba(15,23,42,0.06); }
    .lead { color: #4B5563; margin-top: 10px; }
    .tile { margin-top: 18px; border: 1px solid #E5E7EB; border-radius: 16px; padding: 16px; background: #F9FAFB; display: grid; gap: 8px; }
    .k { color: #6B7280; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    .v { font-size: 34px; font-weight: 900; color: #111827; }
    button { width: fit-content; border: none; border-radius: 12px; padding: 10px 12px; background: #111827; color: #fff; font-weight: 800; cursor: pointer; }
  `]
})
export class RewardsComponent {
  points = 0;

  constructor() {
    this.points = this.getPoints();
  }

  private getPoints(): number {
    try {
      const raw = localStorage.getItem('rewardPoints');
      const val = raw ? Number(raw) : 0;
      return Number.isFinite(val) ? val : 0;
    } catch {
      return 0;
    }
  }

  private setPoints(next: number): void {
    this.points = next;
    try {
      localStorage.setItem('rewardPoints', String(next));
    } catch {
      // ignore
    }
  }

  earn(): void {
    this.setPoints(this.points + 50);
    Swal.fire({ title: 'Points added', text: '50 points added (demo).', icon: 'success' });
  }
}

@Component({
  selector: 'app-credit-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-shell">
      <div class="page-card">
        <h1>Credit Card</h1>
        <p class="lead">Apply for a store credit card and unlock flexible payments.</p>
        <button type="button" (click)="apply()">Apply (demo)</button>
      </div>
    </div>
  `,
  styles: [`
    .page-shell { min-height: 60vh; padding: 70px 16px; background: #fff; }
    .page-card { max-width: 720px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 26px; box-shadow: 0 10px 25px rgba(15,23,42,0.06); }
    .lead { color: #4B5563; margin-top: 10px; }
    button { margin-top: 18px; border: none; border-radius: 12px; padding: 12px 14px; background: #111827; color: #fff; font-weight: 800; cursor: pointer; }
  `]
})
export class CreditCardComponent {
  apply(): void {
    Swal.fire({ title: 'Submitted', text: 'Your application was submitted (demo).', icon: 'success' });
  }
}

@Component({
  selector: 'app-financing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-shell">
      <div class="page-card">
        <h1>Financing</h1>
        <p class="lead">Split payments over time for eligible orders.</p>
        <button type="button" (click)="start()">Check eligibility (demo)</button>
      </div>
    </div>
  `,
  styles: [`
    .page-shell { min-height: 60vh; padding: 70px 16px; background: #fff; }
    .page-card { max-width: 720px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 26px; box-shadow: 0 10px 25px rgba(15,23,42,0.06); }
    .lead { color: #4B5563; margin-top: 10px; }
    button { margin-top: 18px; border: none; border-radius: 12px; padding: 12px 14px; background: #111827; color: #fff; font-weight: 800; cursor: pointer; }
  `]
})
export class FinancingComponent {
  start(): void {
    Swal.fire({ title: 'Eligible', text: 'You are eligible for financing (demo).', icon: 'success' });
  }
}

@Component({
  selector: 'app-cash-registry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-shell">
      <div class="page-card">
        <h1>Cash Registry</h1>
        <p class="lead">Create a registry link and share it with friends (demo).</p>
        <div class="row">
          <input [(ngModel)]="title" placeholder="Registry name" />
          <button type="button" (click)="create()">Create</button>
        </div>
        <div *ngIf="link" class="link">
          Registry link: <strong>{{ link }}</strong>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-shell { min-height: 60vh; padding: 70px 16px; background: #fff; }
    .page-card { max-width: 720px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 16px; padding: 26px; box-shadow: 0 10px 25px rgba(15,23,42,0.06); }
    .lead { color: #4B5563; margin-top: 10px; }
    .row { display: flex; gap: 10px; margin-top: 16px; }
    input { flex: 1; border: 1px solid #D1D5DB; border-radius: 12px; padding: 12px 14px; font-size: 14px; outline: none; }
    button { border: none; border-radius: 12px; padding: 12px 14px; background: #111827; color: #fff; font-weight: 800; cursor: pointer; }
    .link { margin-top: 16px; color: #111827; }
  `]
})
export class CashRegistryComponent {
  title = '';
  link = '';

  create(): void {
    const name = (this.title || '').trim();
    if (!name) {
      Swal.fire({ title: 'Enter a name', text: 'Please type a registry name.', icon: 'info' });
      return;
    }
    const id = Math.random().toString(36).slice(2, 10);
    this.link = `/registry/${encodeURIComponent(id)}`;
    Swal.fire({ title: 'Created', text: 'Registry created (demo).', icon: 'success' });
  }
}
