import { Component, OnInit, Output, EventEmitter, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchService } from '../../../services/search.service';

@Component({
    selector: 'app-search-sidebar',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './search-sidebar.html',
    styleUrl: './search-sidebar.scss'
})
export class SearchSidebar implements OnInit, OnChanges {
    // Collapse State
    collapsedSections: Record<string, boolean> = {};

    // View More State (Simplified for dynamic)
    showMore: Record<string, boolean> = {
        category: false
    };

    // Filters
    selectedFilters: string[] = [];
    selectedCategory: string | null = null;
    searchTerm: string = '';

    // Price Slider
    minPrice = 0;
    maxPrice = 10000;
    priceGap = 10;

    // Inputs for Dynamic Filters
    @Input() isOpen: boolean = false;
    @Input() categories: string[] = [];
    @Input() colors: string[] = [];
    @Input() sizes: string[] = [];
    @Input() types: string[] = [];
    @Input() fits: string[] = [];
    @Input() lengths: string[] = [];
    @Input() priceLimit: { min: number, max: number } = { min: 0, max: 10000 };
    @Input() loading: boolean = false;

    // Outputs
    @Output() filterChange = new EventEmitter<any>();

    constructor(private searchService: SearchService) { }

    ngOnInit() {
        this.searchService.searchTerm$.subscribe(term => {
            this.searchTerm = term;
        });
    }

    ngOnChanges() {
        if (this.priceLimit) {
            // Set slider to full range of current results if not already filtered
            if (this.minPrice === 0 || this.minPrice < this.priceLimit.min) {
                this.minPrice = this.priceLimit.min;
            }
            if (this.maxPrice === 10000 || this.maxPrice > this.priceLimit.max) {
                this.maxPrice = this.priceLimit.max;
            }
        }

        // If category list changes and current selection is invalid, clear it
        if (this.selectedCategory && !this.categories.includes(this.selectedCategory)) {
            this.selectedCategory = null;
            this.selectedFilters = this.selectedFilters.filter(f => !this.isCategoryValue(f));
        }
    }

    toggleSection(section: string) {
        this.collapsedSections[section] = !this.collapsedSections[section];
    }

    toggleViewMore(section: string) {
        this.showMore[section] = !this.showMore[section];
    }

    // ... (existing code)

    /* ================= FILTERS ================= */

    onDropdownChange() {
        this.emitFilterChange();
    }

    // Handle Checkbox/Radio Changes
    onFilterChange(e: Event, type: 'checkbox' | 'radio') {
        const input = e.target as HTMLInputElement;
        const value = input.value;

        if (type === 'checkbox') {
            if (input.checked) {
                this.addChip(value);
            } else {
                this.removeChip(value);
            }
        } else {
            // For category radio, ensure only one category chip exists
            this.selectedCategory = value;
            this.selectedFilters = this.selectedFilters.filter(f => !this.isCategoryValue(f));
            this.addChip(value);
        }
        this.emitFilterChange();
    }

    addChip(text: string) {
        if (!this.selectedFilters.includes(text)) {
            this.selectedFilters.push(text);
        }
    }

    removeChip(text: string) {
        if (text.startsWith('Price:')) {
            this.resetPrice();
            // remove explicitly from chips (resetPrice deals with internal vars)
            this.selectedFilters = this.selectedFilters.filter(f => f !== text);
            this.emitFilterChange();
            return;
        }

        this.selectedFilters = this.selectedFilters.filter(f => f !== text);
        if (this.isCategoryValue(text)) {
            this.selectedCategory = null;
        }

        // Uncheck input if it exists
        setTimeout(() => {
            const inputs = document.querySelectorAll(`input[value="${text}"]`);
            inputs.forEach((inp: any) => {
                inp.checked = false;
            });
            this.emitFilterChange();
        });
    }

    clearAll() {
        this.selectedFilters = [];
        this.selectedCategory = null;
        this.resetPrice();

        // Reset inputs
        setTimeout(() => {
            const inputs = document.querySelectorAll('input[type="checkbox"], input[type="radio"]');
            inputs.forEach((inp: any) => inp.checked = false);
            this.emitFilterChange();
        });
    }

    /* ================= PRICE ================= */

    onPriceChange() {
        if (this.minPrice > this.maxPrice - this.priceGap) {
            this.minPrice = this.maxPrice - this.priceGap;
        }
        if (this.maxPrice < this.minPrice + this.priceGap) {
            this.maxPrice = this.minPrice + this.priceGap;
        }
        this.updatePriceChip();
        this.emitFilterChange();
    }

    updatePriceChip() {
        // Remove existing price chip
        this.selectedFilters = this.selectedFilters.filter(f => !f.startsWith('Price:'));
        // Add new one
        this.selectedFilters.push(`Price: $${this.minPrice} - $${this.maxPrice}`);
    }

    resetPrice() {
        this.minPrice = this.priceLimit.min;
        this.maxPrice = this.priceLimit.max;
        // logic to remove chip handled in updatePriceChip or caller
        this.selectedFilters = this.selectedFilters.filter(f => !f.startsWith('Price:'));
    }

    private emitFilterChange() {
        const checkboxFilters = this.selectedFilters.filter(f =>
            !f.startsWith('Price:') && !this.isCategoryValue(f)
        );

        this.filterChange.emit({
            filters: checkboxFilters,
            category: this.selectedCategory,
            price: { min: this.minPrice, max: this.maxPrice },
            search: this.searchTerm
        });
    }

    private isCategoryValue(value: string): boolean {
        return this.categories.includes(value);
    }
}
