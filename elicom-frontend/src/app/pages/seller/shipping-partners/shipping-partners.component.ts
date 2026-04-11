import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ShippingPartner {
    id: number;
    name: string;
    serviceLine: string;
    tagline: string;
    address: string;
    zipCode: string;
    website: string;
    country: string;
}

@Component({
    selector: 'app-shipping-partners',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './shipping-partners.component.html',
    styleUrls: ['./shipping-partners.component.scss']
})
export class ShippingPartnersComponent implements OnInit, OnDestroy {
    partners: ShippingPartner[] = [
        {
            id: 1,
            name: 'TQL Fulfillment Network',
            serviceLine: 'Marketplace Freight Desk',
            tagline: 'Built for fast inventory movement, bulk pickup planning, and reliable regional dispatch coverage.',
            address: '4230 Cincinnati-Dayton Rd, West Chester, OH, USA',
            zipCode: '45069',
            website: 'https://www.tql.com',
            country: 'USA'
        },
        {
            id: 2,
            name: 'B-Stock Distribution Hub',
            serviceLine: 'Overflow Warehouse Support',
            tagline: 'A practical option for surplus stock routing, pallet handling, and secondary warehouse support.',
            address: '1351 4th St, Suite 400, San Francisco, CA, USA',
            zipCode: '94158',
            website: 'https://bstock.com',
            country: 'USA'
        },
        {
            id: 3,
            name: 'Robinson Cargo Desk',
            serviceLine: 'Cross-State Carrier Access',
            tagline: 'Useful when your store needs broader carrier coordination and cleaner interstate shipment flow.',
            address: '14701 Charlson Rd, Eden Prairie, MN, USA',
            zipCode: '55347',
            website: 'https://www.chrobinson.com',
            country: 'USA'
        },
        {
            id: 4,
            name: 'ShipMonk Seller Bridge',
            serviceLine: 'D2C Order Handling',
            tagline: 'Designed for modern seller operations with smoother pick, pack, and consumer order handling.',
            address: '1661 W Las Olas Blvd, Fort Lauderdale, FL, USA',
            zipCode: '33312',
            website: 'https://www.shipmonk.com',
            country: 'USA'
        },
        {
            id: 5,
            name: 'Ware2Go Dispatch Point',
            serviceLine: 'Distributed Fulfillment',
            tagline: 'A balanced option for distributing inventory closer to buyers and reducing last-mile delays.',
            address: '2400 18th St NW, Suite 200, Atlanta, GA, USA',
            zipCode: '30309',
            website: 'https://ware2go.co',
            country: 'USA'
        },
        {
            id: 6,
            name: 'NHS Supply Link',
            serviceLine: 'Structured UK Logistics',
            tagline: 'Best suited for organized stock transfer planning and dependable UK-based routing support.',
            address: '1st Floor, 5 Waltham Close, Leicester, UK',
            zipCode: 'LE4 9LG',
            website: 'https://www.supplychain.nhs.uk',
            country: 'UK'
        },
        {
            id: 7,
            name: 'DHL Commerce Lane',
            serviceLine: 'Express Export Channel',
            tagline: 'Strong for fast-moving parcels, international labeling, and streamlined export-ready operations.',
            address: '2-4 Victoria Way, Burgess Hill, UK',
            zipCode: 'RH15 9AZ',
            website: 'https://www.dhl.com',
            country: 'UK'
        },
        {
            id: 8,
            name: 'Fortec Delivery Grid',
            serviceLine: 'Retail Route Coverage',
            tagline: 'A good fit for stores that need scheduled transport, replenishment support, and route discipline.',
            address: 'Fortec House, Drayton Manor Business Park, UK',
            zipCode: 'Tamworth, B78 3HL',
            website: 'https://www.fortec-distribution.com',
            country: 'UK'
        },
        {
            id: 9,
            name: 'Menzies Route Control',
            serviceLine: 'Parcel Movement Team',
            tagline: 'Useful for consistent handoff between warehouse teams, parcel sorting, and delivery route control.',
            address: 'Menzies House, 6th Floor, 10-12 Union Street, Glasgow, UK',
            zipCode: 'G1 3QW',
            website: 'https://www.menziesdistribution.com',
            country: 'UK'
        },
        {
            id: 10,
            name: 'Wincanton Fulfillment Base',
            serviceLine: 'Large Volume Support',
            tagline: 'Works well for heavier order volume, scheduled store replenishment, and structured outbound flow.',
            address: 'Wincanton House, 1 Manning Road, Heywood, UK',
            zipCode: 'OL10 3HE',
            website: 'https://www.wincanton.co.uk',
            country: 'UK'
        },
        {
            id: 11,
            name: 'M&H Parcel Desk',
            serviceLine: 'Flexible Delivery Support',
            tagline: 'Helpful for mixed parcel loads, seller pickup coordination, and smoother local delivery handling.',
            address: '2nd Floor, M&H House, 123 High Street, Epsom, Surrey, UK',
            zipCode: 'KT19 8AU',
            website: 'https://mnhlogistics.com',
            country: 'UK'
        },
        {
            id: 12,
            name: 'Allport Cargo Gateway',
            serviceLine: 'International Freight Access',
            tagline: 'Ideal when your catalog needs broader freight access and better support for routed global movement.',
            address: '12-16 Swan Street, Manchester, UK',
            zipCode: 'M4 5JW',
            website: 'https://allportcargoservices.com',
            country: 'UK'
        }
    ];

    groupedPartners: { [key: string]: ShippingPartner[] } = {};
    countries: string[] = [];
    currentTimeDisplay = '';
    currentDateDisplay = '';
    hourHandRotation = 0;
    minuteHandRotation = 0;
    secondHandRotation = 0;
    private clockTimer: ReturnType<typeof setInterval> | null = null;

    ngOnInit() {
        this.groupPartners();
        this.updateClock();
        this.clockTimer = setInterval(() => this.updateClock(), 1000);
    }

    ngOnDestroy() {
        if (this.clockTimer) {
            clearInterval(this.clockTimer);
            this.clockTimer = null;
        }
    }

    groupPartners() {
        this.partners.forEach(partner => {
            if (!this.groupedPartners[partner.country]) {
                this.groupedPartners[partner.country] = [];
                this.countries.push(partner.country);
            }
            this.groupedPartners[partner.country].push(partner);
        });
    }

    getPartnerTone(index: number): string {
        const tones = ['tone-gold', 'tone-sky', 'tone-mint', 'tone-rose', 'tone-indigo', 'tone-amber'];
        return tones[index % tones.length];
    }

    getPartnerCategory(country: string): string {
        return country === 'USA' ? 'Priority 3PL Network' : 'International Fulfillment';
    }

    getPartnerActionLabel(country: string): string {
        return country === 'USA' ? 'Assign Pickup' : 'Use Partner';
    }

    private updateClock() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        this.currentTimeDisplay = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        this.currentDateDisplay = now.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).replace(/ /g, '-');

        this.hourHandRotation = ((hours % 12) + minutes / 60) * 30;
        this.minuteHandRotation = (minutes + seconds / 60) * 6;
        this.secondHandRotation = seconds * 6;
    }
}
