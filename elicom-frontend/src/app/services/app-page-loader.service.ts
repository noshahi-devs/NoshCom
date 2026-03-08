import { Injectable, computed, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class AppPageLoaderService {
    private routeLoading = signal(false);
    private navCycleActive = false;
    private navSettled = false;
    private firstDataArrived = false;
    private forceHideTimer: ReturnType<typeof setTimeout> | null = null;
    private settleFallbackTimer: ReturnType<typeof setTimeout> | null = null;

    readonly isLoading = computed(() => this.routeLoading());

    startInitialLoad(): void {
        this.startCycle();
    }

    onNavigationStart(): void {
        this.startCycle();
    }

    onNavigationSettled(): void {
        if (!this.navCycleActive) return;
        this.navSettled = true;
        this.tryFinishCycle();
    }

    isNavigationCycleActive(): boolean {
        return this.navCycleActive;
    }

    markDataArrived(): void {
        if (!this.navCycleActive) return;
        this.firstDataArrived = true;
        this.tryFinishCycle();
    }

    private startCycle(): void {
        this.clearTimers();
        this.navCycleActive = true;
        this.navSettled = false;
        this.firstDataArrived = false;
        this.routeLoading.set(true);

        // Hard cap: loader should never block UI for too long.
        this.forceHideTimer = setTimeout(() => this.finishCycle(), 2800);
    }

    private tryFinishCycle(): void {
        if (!this.navCycleActive || !this.navSettled) return;

        if (this.firstDataArrived) {
            this.finishCycle(140);
            return;
        }

        // If route settled but no API response observed, hide quickly anyway.
        if (!this.settleFallbackTimer) {
            this.settleFallbackTimer = setTimeout(() => this.finishCycle(), 350);
        }
    }

    private finishCycle(delayMs: number = 0): void {
        this.clearTimers();

        const hide = () => {
            this.navCycleActive = false;
            this.navSettled = false;
            this.firstDataArrived = false;
            this.routeLoading.set(false);
        };

        if (delayMs > 0) {
            this.settleFallbackTimer = setTimeout(hide, delayMs);
            return;
        }

        hide();
    }

    private clearTimers(): void {
        if (this.forceHideTimer) {
            clearTimeout(this.forceHideTimer);
            this.forceHideTimer = null;
        }
        if (this.settleFallbackTimer) {
            clearTimeout(this.settleFallbackTimer);
            this.settleFallbackTimer = null;
        }
    }
}
