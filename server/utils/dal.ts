/**
 * Database abstraction layer. It is assumed that no SQL code can appear outside 
 * of this module. The module should also provide convenient factories for building
 * APIs for endpoints 
 */
import sqlite3 from 'sqlite3';
import sqlite, { open } from 'sqlite';
import fs from 'fs';

const dbPath = __dirname + '/../db';
const dbName = dbPath + '/products.sqlite';

type DB = sqlite.Database<sqlite3.Database, sqlite3.Statement>;

let db: DB = null as unknown as DB; // avoid 'db may be null' warnings
let isNew = false;

export type Filter = { [name: string]: any };

class Query {
    args: { [id: string]: any } = {};
    lastArgId: number = 0;
}

/**
 * Generates API to access a amed table
 * 
 * @param tableName - table to generate the bindings for
 * @param columns - known (allowed) table columns
 * @returns API of 'get', 'select', 'insert', etc. statements
 */
function tableApi(tableName: string, columns: Array<string>) {
    columns = ['rowid', ...columns];
    function getWhere(query: Query, filter: Filter) {
        let values = Object.keys(filter)
            .map((name) => {
                if (columns.indexOf(name) < 0)
                    throw new Error(`Invalid query column name - '${name}'`);
                let id = ':_val' + query.lastArgId;
                query.lastArgId++;
                query.args[id] = filter[name];
                return `${name} like ${id}`;
            })
            .join(' and ');
        return values ? ' where ' + values : '';
    }

    return {
        get: async function (rowid: string) {
            await DAL.init();
            let res = await db.all(`select * from ${tableName} where rowid=?`, [
                rowid,
            ]);
            return res[0];
        },
        select: async function (
            colList: Array<string> | '*',
            filter?: Filter,
            orderBy?: Array<string>,
            page?: { start: number; limit: number }
        ) {
            await DAL.init();

            let cols = '';
            if (colList != '*') {
                cols = colList
                    .filter((col) => {
                        if (columns.indexOf(col) < 0)
                            throw new Error(
                                `Invalid query column name - '${col}'`
                            );
                        return true;
                    })
                    .join(',');
            } else {
                cols = colList;
            }

            const q = new Query();
            let sql = `select ${cols} from ${tableName} ${getWhere(
                q,
                filter || []
            )}`;

            if (orderBy && orderBy.length) {
                // check if all columns are legit
                orderBy.forEach((col) => {
                    col = col.replace(/( asc| desc)$/, '');
                    if (columns.indexOf(col) < 0)
                        throw new Error(`Invalid query column name - '${col}'`);
                });

                sql += ' order by ' + orderBy.join(', ');
            }

            if (page) {
                sql += ` limit ${Number(page.limit)} offset ${Number(
                    page.start
                )}`;
            }
            //console.log(sql);
            return db.all(sql, q.args);
        },

        insert: async function (row: any) {
            await DAL.init();
            let cols = Object.keys(row);

            // check if all columns are legit
            const q = new Query();
            cols.forEach((col) => {
                q.args[':' + col] = row[col];
                if (columns.indexOf(col) < 0)
                    throw new Error(`Invalid query column name - '${col}'`);
            });

            await db.run(
                `insert into ${tableName}(${cols.join(',')}) values (${cols
                    .map((col) => ':' + col)
                    .join(',')})`,
                q.args
            );
        },

        delete: async function (filter: Filter) {
            await DAL.init();

            const q = new Query();
            return db.run(
                `DELETE from ${tableName} ${getWhere(q, filter)}`,
                q.args
            );
        },
    };
}

const DAL = {
    init: async function (): Promise<boolean> {
        if (db) return isNew;

        isNew = !fs.existsSync(dbName);

        if (isNew && !fs.existsSync(dbPath)) {
            fs.mkdirSync(dbPath);
        }

        db = await open({ filename: dbName, driver: sqlite3.Database });
        db.configure('busyTimeout', 10000);

        if (isNew) {
            await db.exec(
                'create table products(crawler text, category text, sub_category text, name text, info text, last_seen integer)'
            );
        }

        return isNew;
    },

    /**
     * Define a binding for 'products' table
     */
    products: tableApi('products', [
        'crawler',
        'category',
        'sub_category',
        'name',
        'info',
        'last_seen',
    ]),
};

export default DAL;
