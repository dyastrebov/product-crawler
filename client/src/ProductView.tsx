import { useEffect, useState } from 'react';
import { ProdDesc } from './Products';
import yaml from 'js-yaml';

export type ProdViewProps = {
    item: ProdDesc;
    onClose: () => void;
};

function ProductView(props: ProdViewProps) {
    let [info, setInfo] = useState<any>(null);

    let [imgIndex, setImgIndex] = useState(0);

    useEffect(() => {
        fetch(`products/${props.item.rowid}`)
            .then((res) => res.json())
            .then((res) => {
                setInfo(res);
            });
    }, [props.item]);

    return (
        <div>
            <button className='right' onClick={props.onClose}>
                Close
            </button>
            {info ? (
                <div className='row'>
                    <div className='preview'>
                        {info?.images?.length ? (
                            <img
                                className='preview'
                                src={info.images[imgIndex]}
                            />
                        ) : null}
                        <br />
                        {info?.images?.map((img, index) => (
                            <button
                                key={index}
                                onClick={() => setImgIndex(index)}
                            >
                                {index}
                            </button>
                        ))}
                    </div>
                    <pre className='specs'>
                        {info?.info ? yaml.dump(info.info) : ''}
                    </pre>
                </div>
            ) : (
                <b>Loading...</b>
            )}
        </div>
    );
}

export default ProductView;
