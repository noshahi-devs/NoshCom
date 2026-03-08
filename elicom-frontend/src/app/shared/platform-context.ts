export type PlatformName = 'WorldCart' | 'PrimeShip' | 'EasyFinora';

function safePathname(): string {
    try {
        return window.location.pathname.toLowerCase();
    } catch {
        return '';
    }
}

function safeHostname(): string {
    try {
        return window.location.hostname.toLowerCase();
    } catch {
        return '';
    }
}

export function resolvePlatformName(pathname?: string, hostname?: string): PlatformName {
    const path = (pathname ?? safePathname()).toLowerCase();
    const host = (hostname ?? safeHostname()).toLowerCase();

    const isPrimeShip = host.includes('primeship') || path.includes('/primeship');
    if (isPrimeShip) return 'PrimeShip';

    const isEasyFinora =
        host.includes('easyfinora') ||
        host.includes('globalpay') ||
        path.includes('/easyfinora') ||
        path.includes('/globalpay');
    if (isEasyFinora) return 'EasyFinora';

    return 'WorldCart';
}

export function resolveTenantId(pathname?: string, hostname?: string): string {
    const platform = resolvePlatformName(pathname, hostname);
    if (platform === 'PrimeShip') return '2';
    if (platform === 'EasyFinora') return '3';
    return '1';
}
