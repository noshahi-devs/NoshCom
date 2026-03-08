import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

type FieldKey =
  | 'location'
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'address1'
  | 'state'
  | 'city'
  | 'zip';

@Component({
  selector: 'app-shipping-address',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shipping-address.html',
  styleUrls: ['./shipping-address.scss']
})
export class ShippingAddress {

  showSummary = false;

  emptyFields = {
    location: '',
    firstName: '',
    lastName: '',
    phone: '',
    address1: '',
    state: '',
    city: '',
    zip: ''
  };

  fields = { ...this.emptyFields };
  savedFields: typeof this.emptyFields | null = null;

  touched: Partial<Record<FieldKey, boolean>> = {};
  focused: Partial<Record<FieldKey, boolean>> = {};

  /* ================= HELPERS ================= */

  set(field: FieldKey, e: Event) {
    const value = (e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
    this.fields[field] = value;
  }

  focus(field: FieldKey) {
    this.focused[field] = true;
  }

  blur(field: FieldKey) {
    this.focused[field] = false;
    this.touch(field);
  }

  touch(field: FieldKey) {
    this.touched[field] = true;
  }

  invalid(field: FieldKey): boolean {
    return !!this.touched[field] && !this.fields[field];
  }

  /* ================= SAVE ================= */

  submit(e: Event) {
    e.preventDefault();

    (Object.keys(this.fields) as FieldKey[]).forEach(f => this.touch(f));

    const isValid = (Object.values(this.fields) as string[]).every(v => v.trim() !== '');
    if (!isValid) return;

    this.savedFields = { ...this.fields };
    this.showSummary = true;
  }

  /* ================= EDIT ================= */

  edit() {
    if (!this.savedFields) return;
    this.fields = { ...this.savedFields };
    this.showSummary = false;
  }

  /* ================= CHANGE ================= */

  change() {
    this.fields = { ...this.emptyFields };
    this.touched = {};
    this.focused = {};
    this.showSummary = false;
  }
}
