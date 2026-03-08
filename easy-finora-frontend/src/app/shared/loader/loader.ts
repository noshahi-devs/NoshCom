import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-loader',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './loader.html',
    styleUrl: './loader.scss',
})
export class Loader implements OnInit, OnDestroy {
    @Input() message: string = 'Syncing with the financial core...';

    motivatingMessages = [
        'Securing your digital wealth...',
        'Building your financial future...',
        'Connecting to the global network...',
        'Validating secure protocols...',
        'Optimizing your experience...'
    ];

    displayMessage: string = '';
    private interval: any;

    ngOnInit() {
        this.displayMessage = this.message;
        let index = 0;
        this.interval = setInterval(() => {
            this.displayMessage = this.motivatingMessages[index];
            index = (index + 1) % this.motivatingMessages.length;
        }, 2500);
    }

    ngOnDestroy() {
        if (this.interval) clearInterval(this.interval);
    }
}
