import fetch, { RequestInfo, RequestInit } from 'node-fetch';
import { JSDOM } from 'jsdom';
import dal from '../../utils/dal';

// These are the common tools used by the crawlers. It is assumed that over the time
// all generalized logic should be pushed here, and individual crawlers will only
// orchestrate the process. Currently, however, the common part is not yet clear,
// so most of the logic resides in the crawlers themselves

export class FetchError extends Error {
    response: any;

    constructor(message: string, response: any) {
        super(message);
        this.response = response;
    }
}

export async function fetchHtml(url: string, opts?: any) {
    const res = await fetch(url, opts).then((res) => res.text());
    return new JSDOM(res);
}

export async function fetchJson(
    url: RequestInfo,
    init?: RequestInit | undefined
): Promise<any> {
    const res = await fetch(url, init);
    return await res.json();
}

export async function fetchImages(urls: Array<string>) {
    let images = new Array<string>();
    const encoding = 'base64';

    for (const url of urls) {
        const res = await fetch(url);
        let mimeType = (res.headers.get('Content-Type') || '').replace(
            /;.*$/,
            ''
        );
        if (!mimeType.startsWith('image/')) continue;

        let data = await res.buffer();
        images.push(
            'data:' + mimeType + ';' + encoding + ',' + data.toString(encoding)
        );
    }

    return images;
}

export type Product = {
    category: string;
    sub_category: string;
    name: string;
    info: any;
};

function unixTime() {
    return Math.round(new Date().getTime() / 1000);
}

/***
 * Push detected products to the database. This must be
 * called by the crawler after the products are collected
 * (or during the process itself)
 */
export async function updateProducts(
    crawlerName: string,
    items: Array<Product>
) {
    for (const item of items) {
        const row = Object.assign(
            { crawler: crawlerName, last_seen: unixTime() },
            item
        );
        row.info = JSON.stringify(row.info);

        await dal.products.delete({
            crawler: row.crawler,
            category: row.category,
            sub_category: row.sub_category,
            name: row.name,
        });
        await dal.products.insert(row);
    }
}
