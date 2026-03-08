import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShippingAddress } from './shipping-address';

describe('ShippingAddress', () => {
  let component: ShippingAddress;
  let fixture: ComponentFixture<ShippingAddress>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShippingAddress]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShippingAddress);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
