"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = require("winston");
const httpTransportOptions = {
    host: 'http-intake.logs.datadoghq.com',
    path: `/api/v2/logs?dd-api-key=${process.env.DATADOG_API_KEY}&ddsource=nodejs&service=testingapp`,
    ssl: false,
};
console.log('process.env.DATADOG_API_KEY', process.env.DATADOG_API_KEY);
const logger = (0, winston_1.createLogger)({
    level: 'info',
    exitOnError: false,
    format: winston_1.format.json(),
    transports: [new winston_1.transports.Http(httpTransportOptions)],
});
exports.default = logger;
logger.log('info', 'Ahother!');
logger.info('more logs', { color: 'blue' });
//# sourceMappingURL=logger.js.map