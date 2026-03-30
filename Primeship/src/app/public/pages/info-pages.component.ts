import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-about-us',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="page-container py-5">
      <div class="container text-center">
        <h1 class="mb-4">About Prime Ship</h1>
        <p class="lead">Your trusted global marketplace for premium products.</p>
        <div class="content mt-5 text-start">
          <h3>Our Story</h3>
          <p>Founded in 2026, Prime Ship has been dedicated to bringing the best products from around the world to your doorstep with speed and reliability.</p>
          <h3 class="mt-4">Our Mission</h3>
          <p>To provide a seamless, premium shopping experience for every customer, ensuring quality and satisfaction at every step.</p>
        </div>
      </div>
    </div>
  `,
    styles: [`.page-container { min-height: 60vh; padding: 80px 0; }`]
})
export class AboutUsComponent { }

@Component({
    selector: 'app-returns-policy',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="page-container py-5">
      <div class="container">
        <h1 class="mb-4">Returns & Refund Policy</h1>
        <div class="content mt-5">
          <h3>30-Day Hassle-Free Returns</h3>
          <p>We want you to be completely satisfied with your purchase. If you're not happy, you can return your item within 30 days for a full refund or exchange.</p>
          <h3 class="mt-4">How to Return</h3>
          <p>1. Contact our support team.<br>2. Pack your item securely.<br>3. Ship it back to our local warehouse.</p>
        </div>
      </div>
    </div>
  `,
    styles: [`.page-container { min-height: 60vh; padding: 80px 0; }`]
})
export class ReturnsPolicyComponent { }

@Component({
    selector: 'app-contact-support',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="page-container py-5">
      <div class="container text-center">
        <h1 class="mb-4">Contact Support</h1>
        <p class="lead">We're here to help you 24/7.</p>
        <div class="support-options mt-5">
          <div class="option p-4 border rounded mb-3">
            <h3>Email Support</h3>
            <p>support@noshahibaba.com</p>
          </div>
          <div class="option p-4 border rounded">
            <h3>WhatsApp Support</h3>
            <p>+44 123 456 7890</p>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`.page-container { min-height: 60vh; padding: 80px 0; } .option { max-width: 400px; margin: 0 auto; }`]
})
export class ContactSupportComponent { }

@Component({
    selector: 'app-track-order',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="page-container py-5">
      <div class="container text-center">
        <h1 class="mb-4">Track Your Order</h1>
        <div class="search-box mt-5 p-4 border rounded mx-auto" style="max-width: 500px;">
          <input type="text" class="form-control mb-3" placeholder="Enter Order ID (e.g. #ORD-12345)">
          <button class="btn btn-primary w-100" style="background: var(--primary); border: none;">Track Now</button>
        </div>
      </div>
    </div>
  `,
    styles: [`.page-container { min-height: 60vh; padding: 80px 0; }`]
})
export class TrackOrderComponent { }
