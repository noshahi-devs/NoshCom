import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CheckoutSummary } from './checkout-summary';

describe('CheckoutSummary', () => {
  let component: CheckoutSummary;
  let fixture: ComponentFixture<CheckoutSummary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckoutSummary]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CheckoutSummary);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
