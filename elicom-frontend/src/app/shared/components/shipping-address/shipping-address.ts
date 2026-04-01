import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';

type FieldKey =
  | 'location'
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'email'
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

  @Output() addressSaved = new EventEmitter<void>();

  showSummary = false;

  emptyFields = {
    location: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address1: '',
    state: '',
    city: '',
    zip: ''
  };

  fields = { ...this.emptyFields };
  savedFields: typeof this.emptyFields | null = null;

  touched: Partial<Record<FieldKey, boolean>> = {};
  focused: Partial<Record<FieldKey, boolean>> = {};

  // Data Sources
  states: string[] = US_STATES.sort();
  cities: string[] = [];

  countries = [
    { name: 'Australia', code: 'AU', dial_code: '+61', flag: 'https://flagcdn.com/au.svg' },
    { name: 'Brazil', code: 'BR', dial_code: '+55', flag: 'https://flagcdn.com/br.svg' },
    { name: 'Canada', code: 'CA', dial_code: '+1', flag: 'https://flagcdn.com/ca.svg' },
    { name: 'China', code: 'CN', dial_code: '+86', flag: 'https://flagcdn.com/cn.svg' },
    { name: 'France', code: 'FR', dial_code: '+33', flag: 'https://flagcdn.com/fr.svg' },
    { name: 'Germany', code: 'DE', dial_code: '+49', flag: 'https://flagcdn.com/de.svg' },
    { name: 'India', code: 'IN', dial_code: '+91', flag: 'https://flagcdn.com/in.svg' },
    { name: 'Japan', code: 'JP', dial_code: '+81', flag: 'https://flagcdn.com/jp.svg' },
    { name: 'Mexico', code: 'MX', dial_code: '+52', flag: 'https://flagcdn.com/mx.svg' },
    { name: 'Pakistan', code: 'PK', dial_code: '+92', flag: 'https://flagcdn.com/pk.svg' },
    { name: 'Saudi Arabia', code: 'SA', dial_code: '+966', flag: 'https://flagcdn.com/sa.svg' },
    { name: 'Turkey', code: 'TR', dial_code: '+90', flag: 'https://flagcdn.com/tr.svg' },
    { name: 'UAE', code: 'AE', dial_code: '+971', flag: 'https://flagcdn.com/ae.svg' },
    { name: 'United Kingdom', code: 'GB', dial_code: '+44', flag: 'https://flagcdn.com/gb.svg' },
    { name: 'United States', code: 'US', dial_code: '+1', flag: 'https://flagcdn.com/us.svg' }
  ];

  selectedCountry = this.countries.find(c => c.code === 'US') || this.countries[0];

  private readonly STORAGE_KEY = 'elicom.shippingAddress';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        this.fields = { ...this.emptyFields, ...saved };
      }
    } catch {
      // ignore storage errors
    }

    // Default to United States when no saved location
    if (!this.fields.location) {
      this.fields.location = 'United States';
    }

    if (this.fields.location === 'United States') {
      this.states = US_STATES.sort();
    } else {
      this.states = [];
      this.cities = [];
    }

    const byLocation = this.countries.find(c => c.name === this.fields.location);
    if (byLocation) {
      this.selectedCountry = byLocation;
    }

    // Default phone to selected country dial code if empty
    if (!this.fields.phone && this.selectedCountry?.dial_code) {
      this.fields.phone = this.selectedCountry.dial_code;
    }
  }

  /* ================= HELPERS ================= */

  set(field: FieldKey, e: Event) {
    const value = (e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
    this.fields[field] = value;

    if (field === 'location') {
      const prevDial = this.selectedCountry?.dial_code || '';
      // Reset state/city when country changes
      this.fields.state = '';
      this.fields.city = '';
      this.cities = [];
      this.states = [];
      this.touch('state');
      this.touch('city');

      const byLocation = this.countries.find(c => c.name === value);
      if (byLocation) {
        this.selectedCountry = byLocation;
        if (!this.fields.phone || (prevDial && this.fields.phone.startsWith(prevDial))) {
          this.fields.phone = this.selectedCountry.dial_code;
        }
      }

      // Update states dropdown if available for this country
      if (value === 'United States') {
        this.states = US_STATES.sort();
      } else {
        this.states = []; // Empty means show text input
      }
    } else if (field === 'state') {
      if (this.fields.location === 'United States') {
        // Populate cities based on state ONLY for US currently
        const stateCities = CITIES_BY_STATE[value] || [];
        this.cities = stateCities.sort();

        // Reset city selection
        this.fields.city = '';
        this.touch('city');
      } else {
        this.cities = []; // Empty means show text input
      }
    }
  }

  onCountryChange(event: any) {
    const dialCode = event.target.value;
    const country = this.countries.find(c => c.dial_code === dialCode);
    if (country) {
      const prevDial = this.selectedCountry?.dial_code || '';
      this.selectedCountry = country;
      if (!this.fields.phone || (prevDial && this.fields.phone.startsWith(prevDial))) {
        this.fields.phone = this.selectedCountry.dial_code;
      }
    }
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
    if (!this.touched[field]) return false;

    const val = this.fields[field];
    if (!val) return true; // Empty check

    // Special validation for Phone logic
    if (field === 'phone') {
      const storedVal = val.replace(/\D/g, ''); // Remove non-digits
      return storedVal.length < 10 || storedVal.length > 15; // Increased max length for intl numbers
    }

    return false;
  }

  /* ================= SAVE ================= */

  submit(e?: Event) {
    if (e) e.preventDefault();
    this.saveAddress();
  }

  saveAddress() {
    console.log('[ShippingAddress] 🚚 Saving Address:', this.fields);
    (Object.keys(this.fields) as FieldKey[]).forEach(f => this.touch(f));

    // Re-run invalid check for all fields
    const hasError = (Object.keys(this.fields) as FieldKey[]).some(f => this.invalid(f));

    if (hasError) return;

    this.savedFields = { ...this.fields };
    this.showSummary = true;
    this.addressSaved.emit();

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.fields));
    } catch {
      // ignore storage errors
    }

    Swal.fire({
      title: "Success!",
      text: "Shipping address saved successfully.",
      icon: "success",
      timer: 2000,
      showConfirmButton: false
    });
  }

  /* ================= EDIT ================= */

  edit() {
    if (!this.savedFields) return;
    this.fields = { ...this.savedFields };
    this.showSummary = false;

    // Restore states/cities for the saved state
    if (this.fields.location === 'United States') {
      this.states = US_STATES.sort();
      if (this.fields.state) {
        this.cities = CITIES_BY_STATE[this.fields.state]?.sort() || [];
      }
    } else {
      this.states = [];
      this.cities = [];
    }
  }

  /* ================= CHANGE ================= */

  change() {
    this.fields = { ...this.emptyFields };
    this.touched = {};
    this.focused = {};
    this.showSummary = false;
    this.cities = [];
    this.states = [];

    this.selectedCountry = this.countries.find(c => c.code === 'US') || this.countries[0];
    this.fields.location = 'United States';
    this.states = US_STATES.sort();
    this.fields.phone = this.selectedCountry.dial_code;

    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }

  getAddressData() {
    return this.savedFields || this.fields;
  }
}

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];

// Mock Data for demonstration - In a real app backend would provide this or a library
const CITIES_BY_STATE: Record<string, string[]> = {
  "New York": ["Albany", "Buffalo", "New York City", "Rochester", "Syracuse", "Yonkers"],
  "California": ["Los Angeles", "San Diego", "San Francisco", "San Jose", "Fresno", "Sacramento"],
  "Texas": ["Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso"],
  "Florida": ["Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg"],
  // Add generic fallback for others to avoid broken UI in demo
  "Alabama": ["Birmingham", "Montgomery", "Mobile", "Huntsville"],
  "Alaska": ["Anchorage", "Juneau", "Fairbanks"],
  "Arizona": ["Phoenix", "Tucson", "Mesa", "Chandler"],
  "Arkansas": ["Little Rock", "Fort Smith", "Fayetteville"],
  "Colorado": ["Denver", "Colorado Springs", "Aurora", "Fort Collins"],
  "Connecticut": ["Bridgeport", "New Haven", "Stamford", "Hartford"],
  "Delaware": ["Wilmington", "Dover", "Newark"],
  "Georgia": ["Atlanta", "Columbus", "Augusta", "Savannah"],
  "Hawaii": ["Honolulu", "Hilo", "Kailua"],
  "Idaho": ["Boise", "Meridian", "Nampa"],
  "Illinois": ["Chicago", "Aurora", "Naperville", "Joliet"],
  "Indiana": ["Indianapolis", "Fort Wayne", "Evansville"],
  "Iowa": ["Des Moines", "Cedar Rapids", "Davenport"],
  "Kansas": ["Wichita", "Overland Park", "Kansas City"],
  "Kentucky": ["Louisville", "Lexington", "Bowling Green"],
  "Louisiana": ["New Orleans", "Baton Rouge", "Shreveport"],
  "Maine": ["Portland", "Lewiston", "Bangor"],
  "Maryland": ["Baltimore", "Columbia", "Germantown"],
  "Massachusetts": ["Boston", "Worcester", "Springfield"],
  "Michigan": ["Detroit", "Grand Rapids", "Warren"],
  "Minnesota": ["Minneapolis", "St. Paul", "Rochester"],
  "Mississippi": ["Jackson", "Gulfport", "Southaven"],
  "Missouri": ["Kansas City", "St. Louis", "Springfield"],
  "Montana": ["Billings", "Missoula", "Great Falls"],
  "Nebraska": ["Omaha", "Lincoln", "Bellevue"],
  "Nevada": ["Las Vegas", "Henderson", "Reno"],
  "New Hampshire": ["Manchester", "Nashua", "Concord"],
  "New Jersey": ["Newark", "Jersey City", "Paterson"],
  "New Mexico": ["Albuquerque", "Las Cruces", "Rio Rancho"],
  "North Carolina": ["Charlotte", "Raleigh", "Greensboro"],
  "North Dakota": ["Fargo", "Bismarck", "Grand Forks"],
  "Ohio": ["Columbus", "Cleveland", "Cincinnati"],
  "Oklahoma": ["Oklahoma City", "Tulsa", "Norman"],
  "Oregon": ["Portland", "Salem", "Eugene"],
  "Pennsylvania": ["Philadelphia", "Pittsburgh", "Allentown"],
  "Rhode Island": ["Providence", "Warwick", "Cranston"],
  "South Carolina": ["Charleston", "Columbia", "North Charleston"],
  "South Dakota": ["Sioux Falls", "Rapid City", "Aberdeen"],
  "Tennessee": ["Nashville", "Memphis", "Knoxville"],
  "Utah": ["Salt Lake City", "West Valley City", "Provo"],
  "Vermont": ["Burlington", "South Burlington", "Rutland"],
  "Virginia": ["Virginia Beach", "Norfolk", "Chesapeake"],
  "Washington": ["Seattle", "Spokane", "Tacoma"],
  "West Virginia": ["Charleston", "Huntington", "Morgantown"],
  "Wisconsin": ["Milwaukee", "Madison", "Green Bay"],
  "Wyoming": ["Cheyenne", "Casper", "Laramie"]
};
