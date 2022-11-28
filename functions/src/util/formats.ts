export const formatCurrency = (value: number, data: any, withSymbol: boolean = true) => {
    const code = (data?.locale && data?.locale?.code) || 'en-US';
    const currency = (data?.locale && data?.locale?.currency) || 'USD';
    try {
        if (typeof value === 'number') {
            if (withSymbol) {
                return value.toLocaleString(code, { style: 'currency', currency });
            }
            return value.toLocaleString(code, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    } catch (err) {
        console.error(code, currency, err);
    }
    return value;
};
