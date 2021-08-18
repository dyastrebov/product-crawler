/**
 * Database abstraction layer. It is assumed that no SQL code can appear outside
 * of this module. The module should also provide convenient factories for building
 * APIs for endpoints
 */
import { Pool } from 'pg';

type DB = Pool;

let db: DB = null as unknown as DB; // avoid 'db may be null' warnings
let isNew = false;

export type Filter = { [name: string]: any };

class Query {
    args: Array<any> = [];
    lastArgId = 1;
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
        const values = Object.keys(filter)
            .map((name) => {
                if (columns.indexOf(name) < 0)
                    throw new Error(`Invalid query column name - '${name}'`);
                query.args.push(filter[name]);
                return `${name} ilike $${query.lastArgId++}`;
            })
            .join(' and ');
        return values ? ' where ' + values : '';
    }

    return {
        get: async function (rowid: number) {
            await DAL.init();
            const res = await db.query(
                `select * from ${tableName} where rowid=$1`,
                [rowid]
            );
            return res.rows[0];
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
            return (await db.query(sql, q.args)).rows;
        },

        insert: async function (row: any) {
            await DAL.init();
            const cols = Object.keys(row);

            // check if all columns are legit
            const q = new Query();
            cols.forEach((col) => {
                if (columns.indexOf(col) < 0)
                    throw new Error(`Invalid query column name - '${col}'`);
                q.args.push(row[col]);
            });

            await db.query(
                `insert into ${tableName}(${cols.join(',')}) values (${cols
                    .map((col, idx) => '$' + (idx + 1))
                    .join(',')})`,
                q.args
            );
        },

        delete: async function (filter: Filter) {
            await DAL.init();

            const q = new Query();
            return db.query(
                `DELETE from ${tableName} ${getWhere(q, filter)}`,
                q.args
            );
        },
    };
}

const DAL = {
    init: async function (): Promise<boolean> {
        if (db) return isNew;

        db = new Pool({
            host: process.env['PG_HOST'] || 'localhost',
            user: process.env['PG_USER'] || 'postgres',
            password: process.env['PG_PASSWORD'] || 'postgres',
            database: process.env['PG_DATABASE'] || 'postgres',
        });

        isNew = !(
            await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE  table_schema = 'public'
                AND    table_name   = 'products'
            ) as exists;
        `)
        ).rows[0].exists;

        if (isNew) {
            await db.query(
                'create table products(rowid serial primary key, crawler text, category text, sub_category text, name text, info text, last_seen integer)'
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
