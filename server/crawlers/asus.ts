import { JSDOM } from 'jsdom';
import {
    fetchJson,
    fetchHtml,
    FetchError,
    updateProducts,
    Product,
} from './base/tools';

const websiteCode = 'us';

async function crawl() {
    // Read the list of categories

    const catList: Array<{
        code1: string;
        code2: string;
    }> = [];

    console.log('Reading product categories...');
    const res = await fetchJson(
        `https://odinapi.asus.com/apiv2/TopMenu?SystemCode=asus&WebsiteCode=${websiteCode}&siteID=www&sitelang=`
    );

    const list = res?.Result?.ProductLine?.MenuList;
    if (typeof list?.forEach !== 'function') {
        throw new FetchError(
            'Cannot extract categories - the structure might have changed!',
            res
        );
    }

    for (const item of list) {
        if (!item.WebPath || typeof item?.PDLevel2?.forEach !== 'function') {
            throw new FetchError(
                'Cannot extract sub-categories - the structure might have changed!',
                res
            );
        }
        for (const subItem of item.PDLevel2) {
            if (!subItem.WebPath)
                throw new FetchError(
                    `Cannot extract sub-category name for ${item} -> ${subItem} - the structure might have changed!`,
                    res
                );
            catList.push({ code1: item.WebPath, code2: subItem.WebPath });
        }
    }

    function fetchPage(
        args: { code1: string; code2: string },
        pageIndex: number
    ) {
        return fetchJson(
            `https://odinapi.asus.com/apiv2/SeriesFilterResult?SystemCode=asus&WebsiteCode=${websiteCode}&ProductLevel1Code=${
                args.code1
            }&ProductLevel2Code=${args.code2}&PageSize=20&PageIndex=${
                pageIndex + 1
            }&CategoryName=&SeriesName=&SubSeriesName=&Spec=&SubSpec=&Sort=Newsest&siteID=www&sitelang=`
        );
    }

    const facedIds: { [index: string]: boolean } = {};
    for (const category of catList) {
        console.log(`Reading ${category.code1} -> ${category.code2}...`);
        let pageIndex = 0;
        while (true) {
            const res = await fetchPage(category, pageIndex++);
            const products = res?.Result?.ProductList;
            if (typeof products?.forEach !== 'function')
                throw new FetchError('failed to get products page', res);
            if (!products.length) break;

            for (const p of products) {
                if (!facedIds[p.ProductURL as string]) {
                    facedIds[p.ProductURL as string] = true;

                    await updateProducts(
                        process.env.JOB_NAME || 'asus-generic',
                        [
                            {
                                category: (
                                    (p.Level1Path || '') +
                                    ' ' +
                                    (p.Level2Path || '')
                                ).trim(),
                                sub_category: p.Level3Path || p.CategoryName,
                                name: (p.Name || '')
                                    .replace(/<.*?>/g, '')
                                    .trim(),
                                info: p,
                            },
                        ]
                    );
                }
                // else console.log(`Duplicate ${p.ProductURL}`); - skip this item
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

    const imgUrls = new Array<string>();
    info.ImageList &&
        info.ImageList.forEach(
            (list: any) =>
                list &&
                list.ImageURL.forEach(
                    (url: any) => url && imgUrls.push(String(url))
                )
        );

    if (info.ModelSpec) {
        info.ModelSpec = new JSDOM(
            info.ModelSpec
        ).window.document.body.textContent?.trim();
    }

    const specs: any = {};
    if (info.ProductURL) {
        const conf = info.isRogFlag
            ? {
                  pageSuffix: 'spec/',
                  titleClass: '_productSpecItemTitle_',
                  specClass: '_productSpecItemContent_',
              }
            : {
                  pageSuffix: 'techspec/',
                  titleClass: 'TechSpec__title',
                  specClass: 'TechSpec__content',
              };

        if (!info.ProductURL.endsWith('/')) info.ProductURL += '/';
        const page = await fetchHtml(info.ProductURL + conf.pageSuffix);
        page.window.document.querySelectorAll('h2').forEach((h2) => {
            if (h2.className.indexOf(conf.titleClass) >= 0) {
                const name = (h2.textContent || '').trim();
                let text = '';
                h2.parentElement?.querySelectorAll('div').forEach((div) => {
                    if (div.className.indexOf(conf.specClass) >= 0) {
                        text += '\n' + (div.textContent || '').trim();
                    }
                });
                specs[name] = text.trim();
            }
        });
    }

    return {
        images: imgUrls,
        info: {
            'Model Spec': info.ModelSpec,
            ...specs,
        },
    };
}

if (require.main === module) {
    // run as a job
    crawl();
}
