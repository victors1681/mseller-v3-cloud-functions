import { createLogger, format, transports } from 'winston';
import packageJSON  from  '../../package.json';

const httpTransportOptions = {
    host: 'http-intake.logs.datadoghq.com',
    path: `/api/v2/logs?dd-api-key=${process.env.DATADOG_API_KEY}&ddsource=nodejs&service=${packageJSON.name}`,
    ssl: true,
};

const logger = createLogger({
    level: 'info',
    exitOnError: false,
    format: format.json(),
    transports: [new transports.Http(httpTransportOptions)],
});

export default logger;
