export function formatNumber(num: number, decimals = 2) {
    return num?.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}
