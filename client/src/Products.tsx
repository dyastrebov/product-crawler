import { useEffect, useState } from 'react';
import { DebounceInput } from 'react-debounce-input';

export type ProdDesc = {
    rowid: string;
    crawler: string;
    category: string;
    sub_category: string;
    name: string;
};

export type ProdProps = {
    onShowDetails: (row: ProdDesc) => void;
};

const pageSize = 15;

function Products(props: ProdProps) {
    let [prods, setProds] = useState<Array<ProdDesc>>([]);

    let [pageIdx, setPageIdx] = useState<number>(0);

    let [filter, setFilter] = useState({});

    function getProds(filter: any, pageIdx: number) {
        fetch(
            `products?cols=rowid,crawler,category,sub_category,name&start=${
                pageIdx * pageSize
            }&limit=${pageSize}&filter=${encodeURIComponent(
                JSON.stringify(filter)
            )}`
        )
            .then((res) => res.json())
            .then((res) => setProds(res));
    }

    useEffect(() => getProds(filter, pageIdx), [filter, pageIdx]);

    function input(fieldName: string) {
        return (
            <DebounceInput
                debounceTimeout={300}
                onChange={(event) => {
                    setFilter({
                        ...filter,
                        [fieldName]: event.target.value + '%',
                    });
                    setPageIdx(0);
                }}
            />
        );
    }

    return (
        <div>
            <table>
                <thead>
                    <tr>
                        <th>
                            Manufacturer Site
                            <br />
                            {input('crawler')}
                        </th>
                        <th>
                            Category
                            <br />
                            {input('category')}
                        </th>
                        <th>
                            Sub-Category (Product)
                            <br />
                            {input('sub_category')}
                        </th>
                        <th>
                            Model Name
                            <br />
                            {input('name')}
                        </th>
                        <th>Info</th>
                    </tr>
                </thead>
                <tbody>
                    {prods &&
                        prods.map((prod) => (
                            <tr key={prod.rowid}>
                                <td>{prod.crawler}</td>
                                <td>{prod.category}</td>
                                <td>{prod.sub_category}</td>
                                <td>{prod.name}</td>
                                <td>
                                    <a
                                        href=''
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            event.preventDefault();
                                            props.onShowDetails(prod);
                                        }}
                                    >
                                        Info
                                    </a>
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>
            <button onClick={() => setPageIdx(Math.max(0, pageIdx - 1))}>
                &lt;- prev
            </button>
            <button onClick={() => setPageIdx(pageIdx + 1)}>next -&gt;</button>
        </div>
    );
}

export default Products;
