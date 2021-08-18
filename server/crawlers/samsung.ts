import {
    fetchText,
    fetchJson,
    fetchHtml,
    FetchError,
    updateProducts,
    Product,
} from './base/tools';

const siteUrl = 'https://www.samsung.com';

async function crawl() {
    // Read the list of category URLs

    const catList: Array<{ name: string; url: string; code?: string }> = []; //["n0002407", /*"n0002201"*/];

    console.log('Reading product categories...');
    const res = await fetchJson(
        `${siteUrl}/us/smg/content/samsung/content-library/gnb/gnb-header/json/pub/gnb-header-menu.json`
    );

    if (typeof res?.menuOptions?.forEach !== 'function') {
        throw new FetchError(
            'Cannot extract category urls - the structure might have changed!',
            res
        );
    }

    function linkWalk(catName: string, items: any) {
        for (const item of items) {
            if (item?.titleTabHeadline) catName = item.titleTabHeadline;
            if (typeof item?.linkUrl == 'string') {
                let url = item.linkUrl;
                if (url.startsWith('/')) url = siteUrl + url;
                url = url.replace(/[?#].*/, ''); // cut query and hash part
                if (!url.endsWith('/')) url += '/';
                if (
                    url.match(/\/all-[^\/]+\/$/) && // has "all-" in the last fragment
                    !catList.find((c) => c.url == url) // is not a duplicate
                ) {
                    catList.push({ name: catName, url: url });
                }
            }
            if (typeof item?.children?.forEach == 'function') {
                linkWalk(catName, item.children);
            }
        }
    }
    linkWalk('', res.menuOptions);

    console.log('Converting category URLs into codes...');
    for (const cat of catList) {
        const res = await fetchText(cat.url);

        const match = res?.match(
            /<input name="categoryCode" type="hidden" value="([a-zA-Z0-9]+)"/
        );
        if (match && match[1]) {
            cat.code = match[1].toLowerCase();
            console.log(`${cat.url} -> ${cat.code}`);
        } else {
            console.warn(`${cat.url} -> not found`);
        }
    }

    const pageSize = 24;

    function fetchPage(args: { code: string }, pageIndex: number) {
        return fetchJson(
            `${siteUrl}/us/product-finder/shop/pf_search/s/?category_code=${
                args.code
            }&from=${pageIndex * pageSize}&size=${pageSize}&sort=featured`,
            true
        );
    }

    const facedIds: { [index: string]: boolean } = {};
    for (const category of catList) {
        if (!category.code) continue;

        console.log(`Reading category ${category.code}...`);
        let pageIndex = 0;
        while (true) {
            const res = await fetchPage({ code: category.code }, pageIndex++);
            if (!res) break;
            const products = res?.products;
            if (typeof products?.forEach !== 'function')
                throw new FetchError('failed to get products page', res);
            if (!products.length) break;

            for (const p of products) {
                if (!facedIds[p.modelCode]) {
                    facedIds[p.modelCode] = true;
                    p.category = category.name;

                    await updateProducts(
                        process.env.JOB_NAME || 'samsung-generic',
                        [
                            {
                                category: p.category,
                                sub_category: p.familyTitle,
                                name: p.title,
                                info: p,
                            },
                        ]
                    );
                }
                // else console.log(`Duplicate ${p.modelCode}`); //- skip this item
                // as it has probably been listed in another category already
            }
        }
    }
    console.log('Done');
}

/**
 * Fetch item details. This function is called when coresponding Web API is called
 *
 * @param item - item info (reference), as it was collected during the crawler execution
 * @returns - data in arbitrary format
 */
export async function fetchDetails(item: Product) {
    const info = JSON.parse(item.info);

    let specs: any = {};

    if (typeof info.keySummary?.forEach == 'function') {
        const summary = new Array<string>();
        info.keySummary.forEach((key: any) => {
            const value = (
                (key.displayValue || key.value) +
                ' ' +
                (key.desc || '')
            ).trim();
            value && summary.push(value);
        });
        if (summary.length) specs['Key Summary'] = summary;
    }

    if (info.linkUrl) {
        const page = await fetchHtml(siteUrl + info.linkUrl);
        page?.window.document
            .querySelectorAll('.sub-specs__item__name')
            .forEach((nameTag) => {
                const name = nameTag.textContent?.trim();
                if (name) {
                    const valueTag = nameTag.parentElement?.querySelector(
                        '.sub-specs__item__value'
                    );
                    if (valueTag) {
                        specs[name] = valueTag.textContent?.trim();
                    }
                }
            });
    }

    if (Object.keys(specs).length == 0) {
        let errMsg = 'Could not retrieve SPECs for this product.';
        if (info.linkUrl) {
            errMsg +=
                'Some pages may not have it - see:\n' + siteUrl + info.linkUrl;
        }
        specs = errMsg;
    }

    return {
        images: info.galleryImage,
        info: specs,
    };
}

if (require.main === module) {
    // run as a job
    crawl();
}
