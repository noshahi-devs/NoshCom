import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrls: ['./footer.scss'],
})
export class Footer {

  countries = [
    { name: 'Pakistan', code: '+92' },
    { name: 'India', code: '+91' },
    { name: 'USA', code: '+1' },
    { name: 'UK', code: '+44' },
    { name: 'Afghanistan', code: '+93' },
  ];

  updatePhoneCode(event: Event) {
    const select = event.target as HTMLSelectElement;
    console.log(select.value);
  }
}
