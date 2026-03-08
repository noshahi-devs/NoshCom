import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type PartnerStatus = 'active' | 'inactive';

interface ThreePLPartner {
  id: number;
  name: string;
  code: string;
  contactPerson: string;
  phone: string;
  email: string;
  regions: string[];
  status: PartnerStatus;
  slaDays: number;
}

@Component({
  selector: 'app-threepl-partners',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './threepl-partners.component.html',
  styleUrls: ['./threepl-partners.component.scss']
})
export class ThreeplPartnersComponent implements OnInit {
  partners: ThreePLPartner[] = [];
  filteredPartners: ThreePLPartner[] = [];

  searchTerm = '';
  selectedStatus: PartnerStatus | 'all' = 'all';

  viewModalVisible = false;
  selectedPartner: ThreePLPartner | null = null;

  ngOnInit(): void {
    this.loadDummy();
    this.applyFilters();
  }

  private loadDummy(): void {
    this.partners = [
      {
        id: 1,
        name: 'DHL eCommerce',
        code: 'DHL',
        contactPerson: 'Sarah Khan',
        phone: '0300-7777777',
        email: 'support@dhl.example',
        regions: ['Punjab', 'Sindh'],
        status: 'active',
        slaDays: 2
      },
      {
        id: 2,
        name: 'Leopards Courier',
        code: 'LEO',
        contactPerson: 'Usman Ali',
        phone: '0301-8888888',
        email: 'ops@leopards.example',
        regions: ['Punjab', 'KPK', 'ICT'],
        status: 'active',
        slaDays: 3
      },
      {
        id: 3,
        name: 'TCS Logistics',
        code: 'TCS',
        contactPerson: 'Ayesha Malik',
        phone: '0302-9999999',
        email: 'partner@tcs.example',
        regions: ['Nationwide'],
        status: 'inactive',
        slaDays: 4
      },
      {
        id: 4,
        name: 'DSL eCommerce',
        code: 'DSL',
        contactPerson: 'Adeel Noshahi',
        phone: '0300-7777777',
        email: 'support@dhl.example',
        regions: ['Punjab', 'Sindh'],
        status: 'active',
        slaDays: 3
      },
    ];
  }

  applyFilters(): void {
    const q = this.searchTerm.trim().toLowerCase();

    this.filteredPartners = this.partners.filter(p => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.contactPerson.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q);

      const matchesStatus = this.selectedStatus === 'all' || p.status === this.selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'all';
    this.applyFilters();
  }

  openView(partner: ThreePLPartner): void {
    console.log('openView partner:', partner);
    this.selectedPartner = partner;
    this.viewModalVisible = true;
  }

  closeView(): void {
    this.viewModalVisible = false;
    this.selectedPartner = null;
  }
}
