type ConfigItem = {
    description: string; // job (manufacturer) description
    module: string; // JS module name which contains "fetchDetails" API
    cmd: string; // shell command to run for background crawling
    at: string; // job schedule in 'cron' format
};

/**
 * Crawler configuration (left in the code to be able to comment)
 *
 * Each item is a reference to a crawler job. Multiple jobs may refer
 * same crawler module (e.g. with various parameters)
 */
export const config: {
    [name: string]: ConfigItem;
} = {
    'asus-us': {
        description: 'www.asus.com/us',
        module: 'asus.js',
        cmd: 'node asus.js',
        at: '0 */2 * * *',
    },
    samsung: {
        description: 'www.samsung.com/us',
        module: 'samsung.js',
        cmd: 'node samsung.js',
        at: '0 */2 * * *',
    },
    makita: {
        description: 'www.makitatools.com',
        module: 'makita.js',
        cmd: 'node makita.js',
        at: '0 */2 * * *',
    },
};
