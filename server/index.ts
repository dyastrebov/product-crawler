import express, { Application } from 'express';
import staticEnv from './utils/staticEnv';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import jobApi from './jobApi';
import productApi from './productApi';

const app: Application = express();
const port = 5677;

// Input parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// APIs
app.use('/jobs', jobApi);
app.use('/products', productApi);

// Static and supplementary UIs
app.use(
    '/swagger',
    swaggerUi.serve,
    swaggerUi.setup(JSON.parse(fs.readFileSync('./swagger.json').toString()))
);
app.use('/', staticEnv(port + 1));

app.listen(port, (): void => {
    console.log(`Listening on port ${port}`);
});
