"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, Edit, Trash2, ExternalLink, Search, X, ArrowUpDown, ChevronLeft, ChevronRight, Star, DownloadCloud, PackageX, Heart } from 'lucide-react';
import type { Product } from '@/types/product';
import AdminLayout from '@/components/AdminLayout';
import AdminLoading from '@/components/AdminLoading';

export default function AdminProductsPage() {
  const FEATURE_LIMIT = 6;
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [paginatedProducts, setPaginatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [priceSort, setPriceSort] = useState<'none' | 'high-to-low' | 'low-to-high'>('none');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const lastFetchTimeRef = useRef<number>(0);
  const featuredCount = products.reduce(
    (count, product) => count + ((product.isFeatured ?? false) ? 1 : 0),
    0
  );
  const featureLimitReached = featuredCount >= FEATURE_LIMIT;
  const [updatingFeaturedSlug, setUpdatingFeaturedSlug] = useState<string | null>(null);
  const [updatingSoldOutSlug, setUpdatingSoldOutSlug] = useState<string | null>(null);
  const [downloadingSlug, setDownloadingSlug] = useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
    lastFetchTimeRef.current = Date.now();
  }, []);

  // Only refresh products when page becomes visible if it's been a very long time (5 minutes)
  // This prevents loss of unsaved changes from aggressive refreshes
  useEffect(() => {
    const MIN_REFRESH_INTERVAL = 5 * 60 * 1000; // Only refresh if it's been at least 5 minutes since last fetch

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastFetchTimeRef.current >= MIN_REFRESH_INTERVAL) {
          lastFetchTimeRef.current = now;
          // Silent refresh without showing loading state
          fetchProductsSilently();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/products');
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      setProducts(data);
      setFilteredProducts(data);
    } catch (err) {
      setError('Failed to load products');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Silent fetch that doesn't show loading state (for background refreshes)
  const fetchProductsSilently = async () => {
    try {
      const response = await fetch('/api/admin/products');
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      setProducts(data);
      setFilteredProducts(data);
      lastFetchTimeRef.current = Date.now();
    } catch (err) {
      // Fail silently for background refreshes
      console.error('Silent refresh failed:', err);
    }
  };

  useEffect(() => {
    let filtered = [...products];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((product) => {
        const title = product.title?.toLowerCase() || '';
        const brand = product.brand?.toLowerCase() || '';
        const category = product.category?.toLowerCase() || '';
        const slug = product.slug?.toLowerCase() || '';
        const description = product.description?.toLowerCase() || '';
        
        return (
          title.includes(query) ||
          brand.includes(query) ||
          category.includes(query) ||
          slug.includes(query) ||
          description.includes(query)
        );
      });
    }

    // Apply price filters
    if (minPrice.trim()) {
      const min = parseFloat(minPrice);
      if (!isNaN(min)) {
        filtered = filtered.filter((product) => product.price >= min);
      }
    }

    if (maxPrice.trim()) {
      const max = parseFloat(maxPrice);
      if (!isNaN(max)) {
        filtered = filtered.filter((product) => product.price <= max);
      }
    }

    // Apply price sorting
    if (priceSort === 'high-to-low') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (priceSort === 'low-to-high') {
      filtered.sort((a, b) => a.price - b.price);
    }

    setFilteredProducts(filtered);
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [searchQuery, minPrice, maxPrice, priceSort, products]);

  // Pagination effect
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filteredProducts.slice(startIndex, endIndex);
    setPaginatedProducts(paginated);
  }, [filteredProducts, currentPage]);

  // Calculate total pages
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const handleDelete = async (slug: string) => {
    // Find the product to show its title in the confirmation
    const product = products.find(p => p.slug === slug);
    const productName = product?.title || slug;
    
    if (!confirm(`⚠️ Delete Product?\n\nAre you sure you want to permanently delete "${productName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    setDeletingSlug(slug);
    setError('');

    try {
      const response = await fetch(`/api/admin/products/${slug}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete product');
      }

      // Update local state instead of refetching everything
      setProducts((prev) => prev.filter((item) => item.slug !== slug));
      setFilteredProducts((prev) => prev.filter((item) => item.slug !== slug));
      
      // Show success message
      alert(`✅ Product "${productName}" has been successfully deleted.`);
      
      // Reset to page 1 if current page becomes empty
      if (paginatedProducts.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete product';
      setError(errorMessage);
      alert(`❌ Error: ${errorMessage}`);
      console.error('Delete error:', err);
    } finally {
      setDeletingSlug(null);
    }
  };

  const toggleFeatured = async (product: Product) => {
    if (!product.isFeatured && featuredCount >= FEATURE_LIMIT) {
      setError(`Maximum of ${FEATURE_LIMIT} featured products reached. Unfeature another product first.`);
      return;
    }

    const nextValue = !product.isFeatured;
    setUpdatingFeaturedSlug(product.slug);
    setError('');

    try {
      const response = await fetch(`/api/admin/products/${product.slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_featured: nextValue, isFeatured: nextValue }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update featured status');
      }

      const updatedProduct: Product = await response.json();
      setProducts((prev) => prev.map((item) => (item.slug === updatedProduct.slug ? updatedProduct : item)));
      // filteredProducts will recompute via useEffect on products
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to update featured status');
    } finally {
      setUpdatingFeaturedSlug(null);
    }
  };

  const toggleSoldOut = async (product: Product) => {
    const nextValue = product.inStock === false ? true : false;
    setUpdatingSoldOutSlug(product.slug);
    setError('');

    try {
      const response = await fetch(`/api/admin/products/${product.slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ in_stock: nextValue, inStock: nextValue }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update sold out status');
      }

      const updatedProduct: Product = await response.json();
      setProducts((prev) => prev.map((item) => (item.slug === updatedProduct.slug ? updatedProduct : item)));
      // filteredProducts will recompute via useEffect on products
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to update sold out status');
    } finally {
      setUpdatingSoldOutSlug(null);
    }
  };

  const handleDownload = async (product: Product) => {
    setError('');
    setDownloadingSlug(product.slug);
    try {
      const response = await fetch(`/api/admin/products/${product.slug}/download`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to download product data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${product.slug}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to download product data');
    } finally {
      setDownloadingSlug(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/admin/login');
  };

  if (loading) {
    return <AdminLoading message="Loading products..." />;
  }

  return (
    <AdminLayout 
      title="Products" 
      subtitle={`${products.length} products • ${featuredCount} featured`}
    >
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-lg">{error}</div>
        )}

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products by title, brand, category, slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0046be] focus:border-[#0046be] outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Clear search"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Smart Price Filter & Manual Price Range */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <ArrowUpDown className="h-4 w-4 inline mr-1" />
                  Sort by Price
                </label>
                <select
                  value={priceSort}
                  onChange={(e) => setPriceSort(e.target.value as 'none' | 'high-to-low' | 'low-to-high')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0046be] focus:border-[#0046be] outline-none bg-white"
                >
                  <option value="none">No sorting</option>
                  <option value="high-to-low">Price: High to Low</option>
                  <option value="low-to-high">Price: Low to High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0046be] focus:border-[#0046be] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="No limit"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0046be] focus:border-[#0046be] outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setMinPrice('');
                    setMaxPrice('');
                    setSearchQuery('');
                    setPriceSort('none');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors w-full"
                  title="Clear all filters"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Filter Status */}
            {(searchQuery || minPrice || maxPrice || priceSort !== 'none') && (
              <div className="pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> product{products.length !== 1 ? 's' : ''}
                    {priceSort !== 'none' && (
                      <span className="ml-2 text-gray-500">
                        • Sorted: {priceSort === 'high-to-low' ? 'High to Low' : 'Low to High'}
                      </span>
                    )}
                    {(minPrice || maxPrice) && (
                      <span className="ml-2 text-gray-500">
                        {minPrice && `• Min: $${parseFloat(minPrice).toFixed(2)}`}
                        {maxPrice && ` Max: $${parseFloat(maxPrice).toFixed(2)}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {featureLimitReached && (
          <div className="mb-4 rounded-lg border border-[#f4de40]/30 bg-[#fef9e6] px-4 py-3 text-sm text-[#7a6b0d]">
            Maximum of {FEATURE_LIMIT} featured products reached. Unfeature an existing product before adding another.
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
            {(paginatedProducts.length > 0 && !searchQuery && !minPrice && !maxPrice && priceSort === 'none') && (
              <div className="px-6 py-3 bg-gray-50 border-b">
                <div className="text-sm text-gray-600">
                  Showing <strong>{products.length}</strong> product{products.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
            {filteredProducts.length === 0 && !loading && (
              <div className="px-6 py-3 bg-gray-50 border-b">
                <div className="text-sm text-gray-600">
                  {searchQuery ? (
                    <>No products found matching &quot;<strong>{searchQuery}</strong>&quot;</>
                  ) : (
                    <>No products found matching your filters</>
                  )}
                </div>
              </div>
            )}
            <table className="w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '25%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '35%' }} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preview Checkout
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 z-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedProducts.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      {searchQuery ? (
                        <>
                          No products found matching &quot;<strong>{searchQuery}</strong>&quot;. 
                          <button
                            onClick={() => setSearchQuery('')}
                            className="ml-2 text-[#0046be] hover:underline"
                          >
                            Clear search
                          </button>
                        </>
                      ) : (
                        'No products found. Create your first product!'
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <div className="flex items-center gap-3" style={{ overflow: 'hidden' }}>
                          <div className="flex-shrink-0 h-14 w-14 relative">
                            <Image
                              src={product.images[0] || '/placeholder.png'}
                              alt={product.title}
                              fill
                              className="object-cover rounded"
                            />
                          </div>
                          <div className="flex-1 min-w-0" style={{ overflow: 'hidden' }}>
                            <div className="text-sm font-medium text-gray-900 truncate" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {product.title}
                            </div>
                            <div className="text-xs text-gray-500 truncate" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.brand}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {product.isFeatured ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#fef9e6] px-2 py-0.5 text-[11px] font-semibold text-[#7a6b0d]">
                                  <Star className="h-3 w-3 text-[#f4de40] fill-[#f4de40] fill-current" />
                                  Featured
                                </span>
                              ) : null}
                              {product.inStock === false ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                  <PackageX className="h-3 w-3 text-red-500" />
                                  Sold Out
                                </span>
                              ) : null}
                            </div>
                            {/* Mobile edit buttons - visible on small screens */}
                            <div className="flex gap-2 mt-3 md:hidden">
                              <Link
                                href={`/admin/products/${product.slug}/edit`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-[#0046be] text-white rounded-lg hover:bg-[#003494] shadow-md"
                              >
                                <Edit className="h-4 w-4" />
                                Edit
                              </Link>
                              <button
                                onClick={() => handleDelete(product.slug)}
                                disabled={deletingSlug === product.slug}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md ${deletingSlug === product.slug ? 'opacity-60 cursor-wait' : ''}`}
                              >
                                <Trash2 className="h-4 w-4" />
                                {deletingSlug === product.slug ? 'Deleting...' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-gray-900" style={{ overflow: 'hidden' }}>
                        ${product.price.toFixed(2)}
                      </td>
                      <td className="px-3 py-4 text-xs text-gray-600" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {product.category}
                      </td>
                      <td className="px-3 py-4" style={{ overflow: 'hidden' }}>
                        <a
                          href={product.checkoutLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-[#0046be] hover:text-[#003494] hover:underline font-medium"
                          style={{ overflow: 'visible' }}
                          title={`Preview checkout link: ${product.checkoutLink}`}
                        >
                          <span>Preview</span>
                          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="text-[10px] text-gray-500 ml-0.5">
                            (buymeacoffee)
                          </span>
                        </a>
                      </td>
                      <td className="px-4 py-4 text-right sticky right-0 bg-white z-20 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{ overflow: 'visible' }}>
                        <div className="flex justify-end gap-2 flex-nowrap">
                          <button
                            onClick={() => toggleSoldOut(product)}
                            disabled={updatingSoldOutSlug === product.slug}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-xs font-bold shadow-md hover:shadow-lg whitespace-nowrap flex-shrink-0 border ${
                              product.inStock === false
                                ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            } ${updatingSoldOutSlug === product.slug ? 'opacity-60 cursor-wait' : ''}`}
                            title={product.inStock === false ? 'Mark as in stock' : 'Mark as sold out'}
                          >
                            <PackageX className={`h-4 w-4 ${product.inStock === false ? 'text-red-500' : 'text-gray-500'}`} />
                            {product.inStock === false ? 'In Stock' : 'Sold Out'}
                          </button>
                          <button
                            onClick={() => toggleFeatured(product)}
                            disabled={
                              updatingFeaturedSlug === product.slug ||
                              (!product.isFeatured && featureLimitReached)
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-xs font-bold shadow-md hover:shadow-lg whitespace-nowrap flex-shrink-0 border ${
                              product.isFeatured
                                ? 'bg-[#fef9e6] text-[#7a6b0d] border-[#f4de40]/30 hover:bg-[#fef5cc]'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            } ${updatingFeaturedSlug === product.slug ? 'opacity-60 cursor-wait' : ''}`}
                            title={product.isFeatured ? 'Remove from featured list' : 'Mark as featured'}
                          >
                            <Star className={`h-4 w-4 ${product.isFeatured ? 'text-[#f4de40] fill-[#f4de40] fill-current' : 'text-gray-500'}`} />
                            {product.isFeatured ? 'Unfeature' : 'Feature'}
                          </button>
                          <button
                            onClick={() => handleDownload(product)}
                            disabled={downloadingSlug === product.slug}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-xs font-bold shadow-md hover:shadow-lg whitespace-nowrap flex-shrink-0 ${downloadingSlug === product.slug ? 'opacity-60 cursor-wait' : ''}`}
                            title="Download product JSON & images"
                          >
                            <DownloadCloud className="h-4 w-4" />
                            {downloadingSlug === product.slug ? 'Preparing…' : 'Download'}
                          </button>
                          <Link
                            href={`/admin/products/${product.slug}/edit`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#0046be] text-white rounded-lg hover:bg-[#003494] transition-all text-xs font-bold shadow-md hover:shadow-lg whitespace-nowrap flex-shrink-0"
                            title="Edit Product"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(product.slug)}
                            disabled={deletingSlug === product.slug}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-xs font-bold shadow-md hover:shadow-lg whitespace-nowrap flex-shrink-0 ${deletingSlug === product.slug ? 'opacity-60 cursor-wait' : ''}`}
                            title={deletingSlug === product.slug ? 'Deleting product...' : 'Delete Product'}
                          >
                            <Trash2 className="h-4 w-4" />
                            {deletingSlug === product.slug ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredProducts.length > itemsPerPage && (
            <div className="bg-white px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> to{' '}
                  <strong>{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</strong> of{' '}
                  <strong>{filteredProducts.length}</strong> products
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => setCurrentPage(pageNumber)}
                          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                            currentPage === pageNumber
                              ? 'bg-[#0046be] text-white'
                              : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Footer */}
      <footer className="mt-12 pb-8 text-center">
        <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
          Made with <Heart className="h-4 w-4 text-red-500 fill-red-500" /> by Mehdi (l3alawi)
        </p>
      </footer>
    </AdminLayout>
  );
}

