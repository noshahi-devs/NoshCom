import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CheckoutProduct } from './checkout-product';

describe('CheckoutProduct', () => {
  let component: CheckoutProduct;
  let fixture: ComponentFixture<CheckoutProduct>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckoutProduct]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CheckoutProduct);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
