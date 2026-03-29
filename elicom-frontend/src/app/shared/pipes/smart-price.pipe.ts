import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'smartPrice',
  standalone: true
})
export class SmartPricePipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return '0';
    }

    if (Number.isInteger(numericValue)) {
      return numericValue.toString();
    }

    return numericValue.toFixed(2);
  }
}
