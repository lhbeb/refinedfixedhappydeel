"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Mail, MailCheck, MailX, Calendar, DollarSign, User, MapPin, Phone, Search, X, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import AdminLoading from '@/components/AdminLoading';

interface Order {
  id: string;
  product_slug: string;
  product_title: string;
  product_price: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip: string;
  email_sent: boolean;
  email_error: string | null;
  email_retry_count?: number;
  next_retry_at?: string | null;
  is_converted?: boolean;
  created_at: string;
  updated_at: string;
  order_data: any;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [paginatedOrders, setPaginatedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [emailFilter, setEmailFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [conversionFilter, setConversionFilter] = useState<'all' | 'converted' | 'not_converted'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [markingConverted, setMarkingConverted] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/orders');
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      const data = await response.json();
      setOrders(data);
      setFilteredOrders(data);
    } catch (err) {
      setError('Failed to load orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...orders];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((order) => {
        const customerName = order.customer_name?.toLowerCase() || '';
        const customerEmail = order.customer_email?.toLowerCase() || '';
        const productTitle = order.product_title?.toLowerCase() || '';
        const productSlug = order.product_slug?.toLowerCase() || '';
        const address = `${order.shipping_address} ${order.shipping_city} ${order.shipping_state}`.toLowerCase();
        
        return (
          customerName.includes(query) ||
          customerEmail.includes(query) ||
          productTitle.includes(query) ||
          productSlug.includes(query) ||
          address.includes(query)
        );
      });
    }

    // Apply email status filter
    if (emailFilter === 'sent') {
      filtered = filtered.filter(order => order.email_sent === true);
    } else if (emailFilter === 'failed') {
      filtered = filtered.filter(order => order.email_sent === false);
    }

    // Apply conversion status filter
    if (conversionFilter === 'converted') {
      filtered = filtered.filter(order => order.is_converted === true);
    } else if (conversionFilter === 'not_converted') {
      filtered = filtered.filter(order => !order.is_converted);
    }

    setFilteredOrders(filtered);
    setCurrentPage(1); // Reset to page 1 when filters change
  }, [searchQuery, emailFilter, conversionFilter, orders]);

  // Pagination effect
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filteredOrders.slice(startIndex, endIndex);
    setPaginatedOrders(paginated);
  }, [filteredOrders, currentPage]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/admin/login');
  };

  const handleRetryEmail = async (orderId: string) => {
    setRetryingOrderId(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/retry-email`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to retry email');
      }

      // Refresh orders to show updated status
      await fetchOrders();
      setError('');
    } catch (err) {
      setError('Failed to retry email');
      console.error(err);
    } finally {
      setRetryingOrderId(null);
    }
  };

  const handleRetryAllFailed = async () => {
    setRetryingAll(true);
    try {
      const response = await fetch('/api/admin/orders/retry-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxOrders: 50 }),
      });

      if (!response.ok) {
        throw new Error('Failed to retry emails');
      }

      const result = await response.json();
      alert(`Retry completed: ${result.sent} sent, ${result.failed} failed`);
      
      // Refresh orders
      await fetchOrders();
      setError('');
    } catch (err) {
      setError('Failed to retry emails');
      console.error(err);
    } finally {
      setRetryingAll(false);
    }
  };

  const handleMarkAsConverted = async (orderId: string) => {
    setMarkingConverted(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/mark-converted`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to mark order as converted');
      }

      // Refresh orders to show updated status
      await fetchOrders();
      setError('');
    } catch (err) {
      setError('Failed to mark order as converted');
      console.error(err);
    } finally {
      setMarkingConverted(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete this order?\n\n` +
      `Customer: ${order.customer_name}\n` +
      `Product: ${order.product_title}\n` +
      `Price: $${order.product_price.toFixed(2)}\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingOrderId(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete order');
      }

      // Refresh orders to remove deleted order
      await fetchOrders();
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete order');
      console.error(err);
    } finally {
      setDeletingOrderId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEmailStatusBadge = (order: Order) => {
    if (order.email_sent) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
          <MailCheck className="h-3 w-3" />
          Sent
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
          <MailX className="h-3 w-3" />
          Failed
        </span>
      );
    }
  };

  if (loading) {
    return <AdminLoading message="Loading orders..." />;
  }

  const totalRevenue = orders.reduce((sum, o) => sum + (o.product_price || 0), 0);
  const emailsSent = orders.filter(o => o.email_sent).length;
  const emailsFailed = orders.filter(o => !o.email_sent).length;
  const convertedOrders = orders.filter(o => o.is_converted).length;
  const convertedRevenue = orders.filter(o => o.is_converted).reduce((sum, o) => sum + (o.product_price || 0), 0);

  return (
    <AdminLayout 
      title="Orders" 
      subtitle={`${orders.length} total orders • $${totalRevenue.toFixed(2)} revenue`}
    >
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-lg">{error}</div>
        )}

        {/* Export Orders Button */}
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => {
              fetch('/api/admin/orders/export')
                .then(res => res.blob())
                .then(blob => {
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'orders.csv';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
            Export Orders (CSV)
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Total Orders</div>
            <div className="text-2xl font-bold text-gray-900">{orders.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-2 border-green-500">
            <div className="text-sm text-gray-600 mb-1">Converted Orders</div>
            <div className="text-2xl font-bold text-green-600">
              {convertedOrders}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Emails Sent</div>
            <div className="text-2xl font-bold text-green-600">
              {emailsSent}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Emails Failed</div>
            <div className="text-2xl font-bold text-red-600">
              {emailsFailed}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-2 border-green-500">
            <div className="text-sm text-gray-600 mb-1">Converted Revenue</div>
            <div className="text-2xl font-bold text-green-600">
              ${convertedRevenue.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Retry Failed Emails Button */}
        {orders.filter(o => !o.email_sent).length > 0 && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <div className="font-semibold text-yellow-900">
                    {orders.filter(o => !o.email_sent).length} order(s) with failed emails
                  </div>
                  <div className="text-sm text-yellow-700">
                    These emails will retry automatically, or you can retry them manually now
                  </div>
                </div>
              </div>
              <button
                onClick={handleRetryAllFailed}
                disabled={retryingAll}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${retryingAll ? 'animate-spin' : ''}`} />
                {retryingAll ? 'Retrying...' : 'Retry All Failed Emails'}
              </button>
            </div>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer name, email, product, or address..."
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

            {/* Filters */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Email Status:</label>
                <select
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value as 'all' | 'sent' | 'failed')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0046be] focus:border-[#0046be] outline-none bg-white"
                >
                  <option value="all">All Orders</option>
                  <option value="sent">Email Sent ✅</option>
                  <option value="failed">Email Failed ❌</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Conversion:</label>
                <select
                  value={conversionFilter}
                  onChange={(e) => setConversionFilter(e.target.value as 'all' | 'converted' | 'not_converted')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0046be] focus:border-[#0046be] outline-none bg-white"
                >
                  <option value="all">All Orders</option>
                  <option value="converted">Converted ✅</option>
                  <option value="not_converted">Not Converted</option>
                </select>
              </div>
            </div>

            {/* Filter Status */}
            {(searchQuery || emailFilter !== 'all' || conversionFilter !== 'all') && (
              <div className="pt-2 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing <strong>{filteredOrders.length}</strong> of <strong>{orders.length}</strong> order{orders.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredOrders.length === 0 && !loading ? (
            <div className="px-6 py-12 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No orders found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Shipping Address
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Conversion Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedOrders.map((order) => (
                      <tr 
                        key={order.id} 
                        className={`${order.is_converted ? 'bg-green-100 border-l-4 border-green-600 hover:bg-green-200' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-gray-900">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {formatDate(order.created_at)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900 flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              {order.customer_name}
                            </div>
                            <div className="text-gray-500 flex items-center gap-2 mt-1">
                              <Mail className="h-3 w-3" />
                              {order.customer_email}
                            </div>
                            {order.customer_phone && (
                              <div className="text-gray-500 flex items-center gap-2 mt-1">
                                <Phone className="h-3 w-3" />
                                {order.customer_phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{order.product_title}</div>
                            <div className="text-gray-500 text-xs mt-1">
                              <Link 
                                href={`/products/${order.product_slug}`}
                                target="_blank"
                                className="text-[#0046be] hover:underline"
                              >
                                View Product
                              </Link>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900 flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <div>{order.shipping_address}</div>
                              <div className="text-gray-500">
                                {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            {order.product_price.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              {getEmailStatusBadge(order)}
                              {!order.email_sent && (
                                <button
                                  onClick={() => handleRetryEmail(order.id)}
                                  disabled={retryingOrderId === order.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Retry sending email"
                                >
                                  <RefreshCw className={`h-3 w-3 ${retryingOrderId === order.id ? 'animate-spin' : ''}`} />
                                  Retry
                                </button>
                              )}
                            </div>
                            {order.email_error && (
                              <div className="text-xs text-red-600 max-w-xs" title={order.email_error}>
                                {order.email_error}
                              </div>
                            )}
                            {order.email_retry_count !== undefined && order.email_retry_count > 0 && (
                              <div className="text-xs text-gray-500">
                                Retry attempts: {order.email_retry_count}/5
                              </div>
                            )}
                            {order.next_retry_at && !order.email_sent && (
                              <div className="text-xs text-gray-500">
                                Next retry: {formatDate(order.next_retry_at)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {order.is_converted ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 border border-green-300">
                              <CheckCircle2 className="h-4 w-4" />
                              Converted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                              Lead
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {!order.is_converted && (
                              <button
                                onClick={() => handleMarkAsConverted(order.id)}
                                disabled={markingConverted === order.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                title="Mark as converted"
                              >
                                {markingConverted === order.id ? (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    <span>Marking...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>Mark as Converted</span>
                                  </>
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              disabled={deletingOrderId === order.id}
                              className="inline-flex items-center justify-center p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete order"
                            >
                              {deletingOrderId === order.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredOrders.length > itemsPerPage && (
                <div className="bg-white px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> to{' '}
                      <strong>{Math.min(currentPage * itemsPerPage, filteredOrders.length)}</strong> of{' '}
                      <strong>{filteredOrders.length}</strong> orders
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
            </>
          )}
        </div>
    </AdminLayout>
  );
}

