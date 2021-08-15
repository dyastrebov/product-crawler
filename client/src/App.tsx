import { monitorEventLoopDelay } from 'perf_hooks';
import { useState } from 'react';
import Jobs from './Jobs';
import Products, { ProdDesc } from './Products';
import ProductView from './ProductView';

export const App = () => {
    let [curTab, setCurTab] = useState<string>('jobs');

    let [viewProduct, setViewProduct] = useState<ProdDesc | null>(null);

    let modal = viewProduct ? (
        <div className='modal'>
            <ProductView
                item={viewProduct}
                onClose={() => setViewProduct(null)}
            />
        </div>
    ) : null;

    return (
        <div>
            <div className='tabs'>
                <span
                    onClick={() => setCurTab('jobs')}
                    className={curTab == 'jobs' ? 'selected' : ''}
                >
                    Manufacturers
                </span>
                <span
                    onClick={() => setCurTab('products')}
                    className={curTab == 'products' ? 'selected' : ''}
                >
                    Products
                </span>
            </div>
            {curTab == 'jobs' ? (
                <Jobs />
            ) : (
                <Products onShowDetails={setViewProduct} />
            )}
            {modal}
        </div>
    );
};
