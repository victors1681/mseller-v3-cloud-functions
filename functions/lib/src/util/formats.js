"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = void 0;
const formatCurrency = (value, data, withSymbol = true) => {
    var _a, _b;
    const code = ((data === null || data === void 0 ? void 0 : data.locale) && ((_a = data === null || data === void 0 ? void 0 : data.locale) === null || _a === void 0 ? void 0 : _a.code)) || 'en-US';
    const currency = ((data === null || data === void 0 ? void 0 : data.locale) && ((_b = data === null || data === void 0 ? void 0 : data.locale) === null || _b === void 0 ? void 0 : _b.currency)) || 'USD';
    try {
        if (typeof value === 'number') {
            if (withSymbol) {
                return value.toLocaleString(code, { style: 'currency', currency });
            }
            return value.toLocaleString(code, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }
    catch (err) {
        console.error(code, currency, err);
    }
    return value;
};
exports.formatCurrency = formatCurrency;
//# sourceMappingURL=formats.js.map