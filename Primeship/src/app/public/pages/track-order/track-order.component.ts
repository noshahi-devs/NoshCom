import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './track-order.html',
  styleUrl: './track-order.css',
})
export class TrackOrderComponent {
  orderId: string = '';

  trackOrder() {
    if (!this.orderId) {
      Swal.fire('Error', 'Please enter a valid Order ID', 'error');
      return;
    }

    Swal.fire({
      title: 'Searching...',
      text: 'Fetching your order status...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // Simulate API call
    setTimeout(() => {
      Swal.fire({
        title: 'Order Found!',
        html: `
          <div style="text-align: left; padding: 10px;">
            <p><strong>Status:</strong> In Transit</p>
            <p><strong>Estimated Delivery:</strong> Oct 28, 2026</p>
            <p><strong>Carrier:</strong> Prime Logistics</p>
          </div>
        `,
        icon: 'success'
      });
    }, 1500);
  }
}
