"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = require("winston");
const packageJSON = require('../../package.json');
const httpTransportOptions = {
    host: 'http-intake.logs.datadoghq.com',
    path: `/api/v2/logs?dd-api-key=${process.env.DATADOG_API_KEY}&ddsource=nodejs&service=${packageJSON.name}`,
    ssl: false,
};
const logger = (0, winston_1.createLogger)({
    level: 'info',
    exitOnError: false,
    format: winston_1.format.json(),
    transports: [new winston_1.transports.Http(httpTransportOptions)],
});
exports.default = logger;
//# sourceMappingURL=logger.js.map