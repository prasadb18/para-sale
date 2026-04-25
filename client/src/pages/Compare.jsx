import { useNavigate } from 'react-router-dom'
import useCompareStore from '../store/compareStore'
import useCartStore from '../store/cartStore'
import { formatCurrency, getDiscountPercent } from '../lib/storefront'
import { imgUrl } from '../lib/imgUrl'

const ROWS = [
  { label: 'Price',        key: 'price' },
  { label: 'MRP',          key: 'mrp' },
  { label: 'Discount',     key: 'discount' },
  { label: 'Brand',        key: 'brand' },
  { label: 'Category',     key: 'category_name' },
  { label: 'Availability', key: 'stock_status' },
]

function cellValue(product, key) {
  switch (key) {
    case 'price':       return formatCurrency(product.price)
    case 'mrp':         return formatCurrency(product.mrp)
    case 'discount': {
      const d = getDiscountPercent(product.price, product.mrp)
      return d > 0 ? `${d}% off` : '—'
    }
    case 'brand':        return product.brand || '—'
    case 'category_name':return product.categories?.name || product.category_name || '—'
    case 'stock_status': return Number(product.stock) > 0 ? 'In Stock' : 'Out of Stock'
    default:             return '—'
  }
}

function isBestPrice(products, product) {
  return Number(product.price) === Math.min(...products.map(p => Number(p.price)))
}

function isBestDiscount(products, product) {
  const d = getDiscountPercent(product.price, product.mrp)
  return d > 0 && d === Math.max(...products.map(p => getDiscountPercent(p.price, p.mrp)))
}

export default function Compare() {
  const navigate  = useNavigate()
  const items     = useCompareStore(s => s.items)
  const remove    = useCompareStore(s => s.remove)
  const clear     = useCompareStore(s => s.clear)
  const addToCart = useCartStore(s => s.addItem)

  if (items.length === 0) {
    return (
      <div className="storefront-page shell">
        <div className="empty-state">
          <p className="empty-state__icon">⚖️</p>
          <h2 className="empty-state__title">Nothing to compare</h2>
          <p style={{ color: 'var(--text-soft)', marginBottom: 20 }}>
            Click "Compare" on any product page to add it here.
          </p>
          <button className="button button--primary" onClick={() => navigate('/products')}>
            Browse Products
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="storefront-page shell">
      <div className="compare-header">
        <h1 className="page-header__title">Compare Products</h1>
        <button className="button button--secondary button--sm" onClick={clear}>
          Clear All
        </button>
      </div>

      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="compare-table__label-col" />
              {items.map(p => (
                <th key={p.id} className="compare-table__product-col">
                  <div className="compare-product-head">
                    <button className="compare-product-head__remove" onClick={() => remove(p.id)}>✕</button>
                    {p.image_url
                      ? <img src={imgUrl(p.image_url, { width: 200 })} alt={p.name} className="compare-product-head__img" />
                      : <div className="compare-product-head__placeholder">📦</div>}
                    <p className="compare-product-head__name">{p.name}</p>
                    <p className="compare-product-head__price">{formatCurrency(p.price)}</p>
                    <button
                      className={`button button--sm ${Number(p.stock) > 0 ? 'button--primary' : 'button--secondary'}`}
                      style={{ width: '100%' }}
                      disabled={Number(p.stock) === 0}
                      onClick={() => { addToCart(p); navigate('/cart') }}
                    >
                      {Number(p.stock) > 0 ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, ri) => (
              <tr key={row.key} className={ri % 2 === 0 ? 'compare-table__row-alt' : ''}>
                <td className="compare-table__label">{row.label}</td>
                {items.map(p => {
                  const val   = cellValue(p, row.key)
                  const best  = (row.key === 'price' && isBestPrice(items, p)) ||
                                (row.key === 'discount' && isBestDiscount(items, p))
                  const isOos = row.key === 'stock_status' && Number(p.stock) === 0
                  const isIn  = row.key === 'stock_status' && Number(p.stock) > 0
                  return (
                    <td
                      key={p.id}
                      className={`compare-table__cell ${best ? 'compare-table__cell--best' : ''} ${isOos ? 'compare-table__cell--oos' : ''} ${isIn ? 'compare-table__cell--instock' : ''}`}
                    >
                      {val}
                      {best && <span className="compare-best-badge">Best</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
            {items.some(p => p.description) && (
              <tr>
                <td className="compare-table__label">Description</td>
                {items.map(p => (
                  <td key={p.id} className="compare-table__cell compare-table__cell--desc">
                    {p.description || '—'}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
