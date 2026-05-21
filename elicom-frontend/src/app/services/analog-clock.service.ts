import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AnalogClockState {
    currentTime: string;
    currentDate: string;
    hourHandRotation: number;
    minuteHandRotation: number;
    secondHandRotation: number;
}

@Injectable({ providedIn: 'root' })
export class AnalogClockService {
    private static readonly TIME_ZONE = 'America/New_York';
    private readonly stateSubject = new BehaviorSubject<AnalogClockState>(this.buildState());
    readonly clock$ = this.stateSubject.asObservable();
    private timer: ReturnType<typeof setInterval> | null = null;
    private subscriberCount = 0;

    constructor(private zone: NgZone) {}

    connect(): void {
        this.subscriberCount++;
        if (this.subscriberCount === 1) {
            this.tick();
            this.zone.runOutsideAngular(() => {
                this.timer = setInterval(() => {
                    this.zone.run(() => this.tick());
                }, 1000);
            });
        }
    }

    disconnect(): void {
        this.subscriberCount = Math.max(0, this.subscriberCount - 1);
        if (this.subscriberCount === 0 && this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    get snapshot(): AnalogClockState {
        return this.stateSubject.value;
    }

    private tick(): void {
        this.stateSubject.next(this.buildState());
    }

    private buildState(): AnalogClockState {
        const now = new Date();
        const nyDate = new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: AnalogClockService.TIME_ZONE
        }).format(now);
        const nyTime = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: AnalogClockService.TIME_ZONE
        }).format(now);
        const nyParts = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false,
            timeZone: AnalogClockService.TIME_ZONE
        }).formatToParts(now);
        const getPart = (type: string) => Number(nyParts.find(part => part.type === type)?.value || 0);
        const hours24 = getPart('hour');
        const minutes = getPart('minute');
        const seconds = getPart('second');
        const hours12 = hours24 % 12;

        return {
            currentTime: nyTime,
            currentDate: nyDate.replace(/ /g, '-'),
            hourHandRotation: (hours12 + minutes / 60 + seconds / 3600) * 30,
            minuteHandRotation: (minutes + seconds / 60) * 6,
            secondHandRotation: seconds * 6
        };
    }
}
