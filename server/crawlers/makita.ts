import { fetchHtml, updateProducts, Product } from './base/tools';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const siteUrl = 'https://www.makitatools.com';

async function crawl() {
    console.log('Reading category list...');

    let page = await fetchHtml(siteUrl);

    type Category = { catName: string; subCatName: string; href: string };

    const catList: Array<Category> = [];
    page.window.document
        .querySelectorAll('.sub-menu-slideout')
        .forEach((el) => {
            const catName = el.querySelector(
                '.sub-menu-header .sub-menu-label'
            )?.textContent;
            if (!catName) return;

            el.querySelectorAll('li a.level-c').forEach((el) => {
                const subCatName = el.textContent?.trim();
                const href = el.getAttribute('href');
                if (!subCatName || !href) return;
                if (!href.startsWith('/')) return; // not a link to the same site
                catList.push({
                    catName: catName,
                    subCatName: subCatName,
                    href: href,
                });
            });
        });

    async function fetchCat(cat: Category, href: string) {
        console.log(`Reading ${cat.catName} -> ${cat.subCatName} - ${href}...`);

        const wrapper = await fetch(siteUrl + href).then((res) => res.text());
        const m = wrapper.match(
            /.getInfo\("(\d{1,6})", *"(.*?)", *"(.)", *"(\/.*?)", (\d\d), (true|false)\)/
        );
        if (!m) {
            const list = new JSDOM(wrapper);
            let hrefs = new Array<string>();
            list.window.document
                .querySelectorAll('.tile .title a.makita-link')
                .forEach((el) => {
                    let href = el.getAttribute('href');
                    href && hrefs.push(href);
                });

            if (hrefs.length) {
                for (const href of hrefs) {
                    await fetchCat(cat, href);
                }
            } else {
                console.warn(
                    `No list for the category ${cat.catName} -> ${cat.subCatName} - ${href}`
                );
            }
            return;
        }

        let pageIdx = 0;
        while (true) {
            const list = await fetchHtml(
                siteUrl +
                    `/tool/getproducts?cat=${m[1]}&subcat=${
                        m[2]
                    }&producttypecode=${
                        m[3]
                    }&filters=&page=${++pageIdx}&perpage=25`
            );
            let nAdded = 0;
            list.window.document
                .querySelectorAll('.product-tile.js-tool-box.js-tile')
                .forEach((el) => {
                    const prod: any = {
                        catName: cat.catName,
                        subCatName: cat.subCatName,
                    };
                    prod.modelNum = el.querySelector('.model-num')?.textContent;
                    prod.href = el
                        .querySelector('a.image-box')
                        ?.getAttribute('href');
                    prod.img = el
                        .querySelector('a.image-box img')
                        ?.getAttribute('data-src');
                    prod.desc = el
                        .querySelector('.product-details')
                        ?.textContent?.trim();

                    updateProducts(process.env.JOB_NAME || 'makita-generic', [
                        {
                            category: prod.catName,
                            sub_category: prod.subCatName,
                            name: prod.modelNum,
                            info: prod,
                        },
                    ]);

                    nAdded++;
                });
            if (!nAdded) {
                if (pageIdx == 1) console.warn('No products found for ', cat);
                break;
            }
        }
    }

    for (const cat of catList) {
        await fetchCat(cat, cat.href);
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
    let info = JSON.parse(item.info);
    const page = await fetchHtml(siteUrl + info.href);

    const images = new Array<string>();
    page.window.document
        .querySelectorAll('.image-gallery img')
        .forEach((img) => {
            let url = img.getAttribute('data-dyn-url');
            if (url) images.push(url);
        });

    const features = new Array<string>();
    page.window.document.querySelectorAll('.ul-features > li').forEach((f) => {
        const text = f.textContent;
        if (text) features.push(text.trim());
    });

    const specs: any = {};
    page.window.document.querySelectorAll('.detail-specs > li').forEach((s) => {
        const name = s.querySelector('.spec-name')?.textContent;
        const value = s.querySelector('.spec-value')?.textContent || '';
        if (name) specs[name.replace(/: *$/, '').trim()] = value.trim();
    });

    return {
        images: images,
        info: {
            Specs: specs,
            Features: features,
        },
    };
}

if (require.main === module) {
    // run as a job
    crawl();
}
