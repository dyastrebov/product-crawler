import { Router } from 'express';
import dal from './utils/dal';
import { config } from './crawlers/config';

const productApi = Router();

/**
 * Get products using a filter, with sorting, etc. Supports pagination
 */
productApi.get('/', async (req, res) => {
    let filter: any;
    try {
        filter = req.query.filter && JSON.parse(String(req.query.filter));
    } catch (err) {
        return res.status(400).send(err.toString());
    }
    const orderBy =
        (req.query.orderBy && String(req.query.orderBy).split(/ *, */)) ||
        undefined;
    const page =
        req.query.start && req.query.limit
            ? { start: Number(req.query.start), limit: Number(req.query.limit) }
            : undefined;
    const cols = req.query.cols && String(req.query.cols).split(',');

    try {
        const data = await dal.products.select(
            cols || '*',
            filter,
            orderBy,
            page
        );
        return res.json(data);
    } catch (err) {
        return res.status(400).send(err.toString());
    }
});

const modules: { [name: string]: any } = {};

const requests: { [rowid: number]: Promise<any> } = {};
/**
 * Get product details
 */
productApi.get('/:rowid', async (req, res) => {
    const rowid = Number(req.params.rowid);
    if (isNaN(rowid)) {
        return res.status(400).send('Wrong argument');
    }

    // Check if a request for the same item is already in-progress
    // This allows to implement a sort of 'long-polling' - if the client
    // connection breaks, resending same request will continue waiting for
    // the data.
    let fetcher = requests[rowid];
    if (!fetcher) {
        const item = await dal.products.get(Number(req.params.rowid));
        if (!item) {
            return res.status(404).send('Not found');
        }

        const modConf = config[item.crawler];
        if (!modConf) {
            console.error(
                `Unknown crawler name '${item.crawler}' faced in the product rowid='${req.params.rowid}'`
            );
            return res.status(500).send('Server misconfiguraion');
        }

        let mod = modules[modConf.module];
        if (!mod) {
            try {
                mod = modules[modConf.module] = require('./crawlers/' +
                    modConf.module);
            } catch (err) {
                console.error(
                    `Failed to initialize module '${modConf.module}'`,
                    err
                );
                return res.status(500).send('Server misconfiguraion');
            }
        }

        fetcher = requests[rowid] = mod
            .fetchDetails(item)
            .finally((result: any) => {
                delete requests[rowid];
                return result;
            });
    }

    let result;
    try {
        result = await fetcher;
    } catch (err) {
        if (req.aborted) return;
        console.error(
            `Failed to fetch details for rowid='${req.params.rowid}'`,
            err
        );
        return res.status(502).send('Failed to fetch data from the source');
    }

    if (req.aborted) return;
    res.json(result);
});

export default productApi;
