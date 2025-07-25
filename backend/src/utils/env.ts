export function getEnv(name: string, fallback?: string): string {
    const value = process.env[name];
    if (value === undefined) {
        if (fallback !== undefined) return fallback;
        throw new Error(`❌ Missing required env var: ${name}`);
    }
    return value;
}
