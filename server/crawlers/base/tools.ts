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

    toString(): string {
        return super.toString() + ' ' + JSON.stringify(this.response);
    }
}

function doFetch(
    url: RequestInfo,
    resType: 'text' | 'json',
    noExceptions = false,
    init?: RequestInit | undefined
): Promise<any> {
    let res = fetch(url, init).then((res) => res[resType]());
    if (noExceptions) {
        res = res.catch((err) => {
            console.error(`Failed to fetch '${url}'`, err);
            return null;
        });
    }
    return res;
}

export async function fetchText(
    url: string,
    noExceptions = false,
    opts?: RequestInit | undefined
): Promise<string | null> {
    return await doFetch(url, 'text', noExceptions, opts);
}

export async function fetchHtml(
    url: string,
    noExceptions = false,
    opts?: RequestInit | undefined
): Promise<JSDOM | null> {
    const res = await doFetch(url, 'text', noExceptions, opts);
    return res ? new JSDOM(res) : res;
}

export async function fetchJson(
    url: string,
    noExceptions = false,
    opts?: RequestInit | undefined
) {
    return await doFetch(url, 'json', noExceptions, opts);
}

export async function fetchImages(urls: Array<string>) {
    const images = new Array<string>();
    const encoding = 'base64';

    for (const url of urls) {
        const res = await fetch(url);
        const mimeType = (res.headers.get('Content-Type') || '').replace(
            /;.*$/,
            ''
        );
        if (!mimeType.startsWith('image/')) continue;

        const data = await res.buffer();
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
