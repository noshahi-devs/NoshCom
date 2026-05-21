import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AnalogClockService, AnalogClockState } from '../../../services/analog-clock.service';

@Component({
    selector: 'app-analog-clock',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './analog-clock.component.html',
    styleUrls: ['./analog-clock.component.scss']
})
export class AnalogClockComponent implements OnInit, OnDestroy {
    private clockService = inject(AnalogClockService);
    private destroyRef = inject(DestroyRef);

    clock: AnalogClockState = this.clockService.snapshot;

    ngOnInit(): void {
        this.clockService.connect();
        this.clock = this.clockService.snapshot;
        this.clockService.clock$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(state => {
                this.clock = state;
            });
    }

    ngOnDestroy(): void {
        this.clockService.disconnect();
    }
}
