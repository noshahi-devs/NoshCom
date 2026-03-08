import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ShippingPartner {
    id: number;
    name: string;
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
export class ShippingPartnersComponent implements OnInit {
    partners: ShippingPartner[] = [
        { id: 1, name: 'Total Quality Logistics (TQL)', address: '4230 Cincinnati-Dayton Rd, West Chester, OH, USA', zipCode: '45069', website: 'https://www.tql.com', country: 'USA' },
        { id: 2, name: 'B-Stock Solutions', address: '1351 4th St, Suite 400, San Francisco, CA, USA', zipCode: '94158', website: 'https://bstock.com', country: 'USA' },
        { id: 3, name: 'C.H. Robinson Worldwide', address: '14701 Charlson Rd, Eden Prairie, MN, USA', zipCode: '55347', website: 'https://www.chrobinson.com', country: 'USA' },
        { id: 4, name: 'ShipMonk', address: '1661 W Las Olas Blvd, Fort Lauderdale, FL, USA', zipCode: '33312', website: 'https://www.shipmonk.com', country: 'USA' },
        { id: 5, name: 'Ware2Go', address: '2400 18th St NW, Suite 200, Atlanta, GA, USA', zipCode: '30309', website: 'https://ware2go.co', country: 'USA' },
        { id: 6, name: 'FreightPOP', address: '2200 E College Ave, Suite 204, Decatur, GA, USA', zipCode: '30030', website: 'https://freightpop.com', country: 'USA' },
        { id: 7, name: 'NHS Supply Chain', address: '1st Floor, 5 Waltham Close, Leicester, UK', zipCode: 'LE4 9LG', website: 'https://www.supplychain.nhs.uk', country: 'UK' },
        { id: 8, name: 'DHL Express', address: '2-4 Victoria Way, Burgess Hill, UK', zipCode: 'RH15 9AZ', website: 'https://www.dhl.com', country: 'UK' },
        { id: 9, name: 'Fortec Distribution Network', address: 'Fortec House, Drayton Manor Business Park, UK', zipCode: 'Tamworth, B78 3HL', website: 'https://www.fortec-distribution.com', country: 'UK' },
        { id: 10, name: 'Menzies Distribution', address: 'Menzies House, 6th Floor, 10-12 Union Street, Glasgow, UK', zipCode: 'G1 3QW', website: 'https://www.menziesdistribution.com', country: 'UK' },
        { id: 11, name: 'Wincanton', address: 'Wincanton House, 1 Manning Road, Heywood, UK', zipCode: 'OL10 3HE', website: 'https://www.wincanton.co.uk', country: 'UK' },
        { id: 12, name: 'M&H Logistics', address: '2nd Floor, M&H House, 123 High Street, Epsom, Surrey, UK', zipCode: 'KT19 8AU', website: 'https://mnhlogistics.com', country: 'UK' },
        { id: 13, name: 'Allport Cargo Services', address: '12-16 Swan Street, Manchester, UK', zipCode: 'M4 5JW', website: 'https://allportcargoservices.com', country: 'UK' },
        { id: 14, name: 'Samskip', address: '3rd Floor, 68-70 Carter Lane, London, UK', zipCode: 'EC4V 5EL', website: 'https://www.samskip.com', country: 'UK' }
    ];

    groupedPartners: { [key: string]: ShippingPartner[] } = {};
    countries: string[] = [];

    ngOnInit() {
        this.groupPartners();
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
}
