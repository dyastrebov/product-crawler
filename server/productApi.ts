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
    let orderBy =
        (req.query.orderBy && String(req.query.orderBy).split(/ *, */)) ||
        undefined;
    let page =
        req.query.start && req.query.limit
            ? { start: Number(req.query.start), limit: Number(req.query.limit) }
            : undefined;
    let cols = req.query.cols && String(req.query.cols).split(',');

    try {
        let data = await dal.products.select(
            cols || '*',
            filter,
            orderBy,
            page
        );
        res.json(data);
    } catch (err) {
        return res.status(400).send(err.toString());
    }
});

let modules: { [name: string]: any } = {};

/**
 * Get product details
 */
productApi.get('/:rowid', async (req, res) => {
    let item = await dal.products.get(req.params.rowid);
    if (!item) {
        return res.status(404).send('Not found');
    }

    let modConf = config[item.crawler];
    if (!modConf) {
        console.error(
            `Unknown crawler name '${item.crawler}' faced in the product rowid='${req.params.rowid}'`
        );
        res.status(500).send('Server misconfiguraion');
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
            res.status(500).send('Server misconfiguraion');
        }
    }

    let result;
    try {
        result = await mod.fetchDetails(item);
    } catch (err) {
        console.error(
            `Failed to fetch details for rowid='${req.params.rowid}' (module='${modConf.module}')`,
            err
        );
        res.status(502).send('Failed to fetch data from the source');
    }

    res.json(result);
});

export default productApi;
