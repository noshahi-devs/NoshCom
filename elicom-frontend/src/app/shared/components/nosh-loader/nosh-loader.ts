import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-nosh-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nosh-loader.html',
  styleUrls: ['./nosh-loader.scss']
})
export class NoshLoader {
  @Input() brandName = 'Smart Shop UK';
  @Input() brandInitials = 'S';
  @Input() title = '';
  @Input() message = '';
  @Input() compact = false;
}
