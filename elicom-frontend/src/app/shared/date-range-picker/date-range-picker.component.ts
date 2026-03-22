import { Component, EventEmitter, OnInit, Output, HostListener, Input, OnChanges } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

export interface DateRangeResult {
  label: string;
  startDate?: string;
  endDate?: string;
  id: string;
}

@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CommonModule],
  providers: [DatePipe],
  templateUrl: './date-range-picker.component.html',
  styleUrls: ['./date-range-picker.component.scss']
})
export class DateRangePickerComponent implements OnInit {
  @Input() initialRangeId: string = 'max';
  @Input() storeCreatedAt?: string;
  @Output() onRangeChange = new EventEmitter<DateRangeResult>();

  isOpen = false;
  selectedRange: DateRangeResult;

  ranges: DateRangeResult[] = [];

  constructor(private datePipe: DatePipe) {
    this.selectedRange = { label: 'Maximum Data', id: 'max' };
  }

  ngOnInit() {
    this.initRanges();
    this.applyInitialRange();
  }

  ngOnChanges() {
    this.initRanges();
    this.applyInitialRange();
  }

  private applyInitialRange() {
    const initial = this.ranges.find(r => r.id === this.initialRangeId);
    if (initial) {
      this.selectedRange = initial;
    } else if (this.ranges.length > 0) {
      this.selectedRange = this.ranges[0];
    }
  }

  initRanges() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Formatting helper
    const formatDate = (date: Date) => date.toISOString();
    const displayFormat = (date: Date) => this.datePipe.transform(date, 'MM/dd/yyyy') || '';
    const displayYear = (date: Date) => this.datePipe.transform(date, 'yyyy') || '';
    const displayMonthYear = (date: Date) => this.datePipe.transform(date, 'MMM yyyy') || '';

    // Maximum Data
    // We send nothing, backend handles it.
    
    // Today
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    // Yesterday
    const yesterdayStart = new Date(today);
    yesterdayStart.setDate(today.getDate() - 1);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // This week (to date) - assuming week starts on Monday or Sunday. Let's say last 7 days to match UI.
    const last7DaysStart = new Date(today);
    last7DaysStart.setDate(today.getDate() - 7);

    // This month (to date)
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Last Month
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

    // This Year
    const thisYearStart = new Date(today.getFullYear(), 0, 1);

    // Last Year
    const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999);

    // Maximum Data
    let maxLabel = 'Maximum Data';
    if (this.storeCreatedAt) {
      const joiningDate = new Date(this.storeCreatedAt);
      const formatted = this.datePipe.transform(joiningDate, 'MM/dd/yyyy');
      if (formatted) {
        maxLabel = `Joined Date: ${formatted}`;
      }
    }

    this.ranges = [
      { id: 'max', label: maxLabel, startDate: undefined, endDate: undefined },
      { id: 'today', label: `Today - (${displayFormat(today)})`, startDate: formatDate(today), endDate: formatDate(endOfToday) },
      { id: 'yesterday', label: `Yesterday - (${displayFormat(yesterdayStart)})`, startDate: formatDate(yesterdayStart), endDate: formatDate(yesterdayEnd) },
      { id: '7days', label: `Last 7 Days to date - (${displayFormat(last7DaysStart)} to ${displayFormat(today)})`, startDate: formatDate(last7DaysStart), endDate: formatDate(endOfToday) },
      { id: 'thisMonth', label: `This Month to date - ${displayMonthYear(today)}`, startDate: formatDate(thisMonthStart), endDate: formatDate(endOfToday) },
      { id: 'lastMonth', label: `Last Month - (${displayMonthYear(lastMonthStart)})`, startDate: formatDate(lastMonthStart), endDate: formatDate(lastMonthEnd) },
      { id: 'thisYear', label: `This Year (${displayYear(thisYearStart)})`, startDate: formatDate(thisYearStart), endDate: formatDate(endOfToday) },
      { id: 'lastYear', label: `Last Year - (${displayYear(lastYearStart)})`, startDate: formatDate(lastYearStart), endDate: formatDate(lastYearEnd) }
    ];
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  selectRange(range: DateRangeResult, event: Event) {
    event.stopPropagation();
    this.selectedRange = range;
    this.isOpen = false;
    this.onRangeChange.emit(this.selectedRange);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.wc-date-range-container')) {
      this.isOpen = false;
    }
  }
}
