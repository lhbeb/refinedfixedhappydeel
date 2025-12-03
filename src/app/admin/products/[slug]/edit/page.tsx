"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Plus, X, Loader2, Edit } from 'lucide-react';
import type { Product } from '@/types/product';
import ImageUploader, { ImageUploaderRef, UploadStatus } from '@/components/admin/ImageUploader';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

interface Review {
  id: string;
  author: string;
  avatar?: string;
  rating: number;
  date: string;
  title: string;
  content: string;
  helpful?: number;
  verified?: boolean;
  location?: string;
  purchaseDate?: string;
  images?: string[] | string;
}

export default function EditProductPage() {
  const FEATURE_LIMIT = 6;
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const imageUploaderRef = useRef<ImageUploaderRef>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ uploading: false });
  const [slugDirty, setSlugDirty] = useState(false);
  const [formData, setFormData] = useState({
    slug: '',
    title: '',
    description: '',
    price: '',
    brand: '',
    category: '',
    condition: '',
    payee_email: '',
    checkout_link: '',
    currency: 'USD',
    images: '',
    rating: '0',
    review_count: '0',
    in_stock: true,
    is_featured: false,
    // Meta fields
    metaTitle: '',
    metaDescription: '',
    metaKeywords: '',
    metaOgTitle: '',
    metaOgDescription: '',
    metaOgImage: '',
    metaTwitterTitle: '',
    metaTwitterDescription: '',
    metaTwitterImage: '',
  });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [editingReviewIndex, setEditingReviewIndex] = useState<number | null>(null);
  const [currentReview, setCurrentReview] = useState<Partial<Review>>({
    id: '',
    author: '',
    avatar: '',
    rating: 5,
    date: new Date().toISOString().split('T')[0],
    title: '',
    content: '',
    helpful: 0,
    verified: true,
    location: '',
    purchaseDate: '',
    images: '',
  });
  const [featuredCount, setFeaturedCount] = useState(0);
  const [featuredLimitReached, setFeaturedLimitReached] = useState(false);

  const loadFeaturedCount = useRef<(() => Promise<void>) | null>(null);

  loadFeaturedCount.current = async () => {
    try {
      const response = await fetch('/api/admin/products');
      if (!response.ok) return;
      const data = await response.json();
      const count = Array.isArray(data)
        ? data.filter((item: any) => item?.isFeatured || item?.is_featured).length
        : 0;
      setFeaturedCount(count);
      setFeaturedLimitReached(count >= FEATURE_LIMIT);
    } catch (countError) {
      console.error('Failed to load featured count', countError);
    }
  };

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/products/${slug}`);
      if (!response.ok) {
        throw new Error('Failed to fetch product');
      }
      const data = await response.json();
      setProduct(data);
      
      // Populate form data
      setFormData({
        slug: data.slug || '',
        title: data.title,
        description: data.description,
        price: data.price.toString(),
        brand: data.brand,
        category: data.category,
        condition: data.condition,
        payee_email: data.payeeEmail || data.payee_email || '',
        checkout_link: data.checkoutLink || data.checkout_link || '',
        currency: data.currency || 'USD',
        images: Array.isArray(data.images) ? data.images.join(', ') : data.images || '',
        rating: data.rating?.toString() || '0',
        review_count: data.reviewCount?.toString() || data.review_count?.toString() || '0',
        in_stock: data.inStock !== undefined ? data.inStock : (data.in_stock !== undefined ? data.in_stock : true),
        is_featured: data.isFeatured !== undefined ? data.isFeatured : (data.is_featured !== undefined ? data.is_featured : false),
        // Meta fields
        metaTitle: data.meta?.title || '',
        metaDescription: data.meta?.description || '',
        metaKeywords: data.meta?.keywords || '',
        metaOgTitle: data.meta?.ogTitle || '',
        metaOgDescription: data.meta?.ogDescription || '',
        metaOgImage: data.meta?.ogImage || '',
        metaTwitterTitle: data.meta?.twitterTitle || '',
        metaTwitterDescription: data.meta?.twitterDescription || '',
        metaTwitterImage: data.meta?.twitterImage || '',
      });

      // Load reviews
      if (data.reviews && Array.isArray(data.reviews)) {
        setReviews(data.reviews.map((review: any) => ({
          ...review,
          images: Array.isArray(review.images) ? review.images.join(', ') : review.images || '',
        })));
      }

      await loadFeaturedCount.current?.();
    } catch (err) {
      setError('Failed to load product');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (!product) {
      loadFeaturedCount.current?.();
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    setUploadStatus((prev) => ({ ...prev, message: undefined }));

    try {
      // First, upload any pending images
      let uploadedImageUrls: string[] = [];
      let finalImages: string[] = formData.images
        .split(',')
        .map((img) => img.trim())
        .filter((img) => img.length > 0);

      if (imageUploaderRef.current) {
        try {
          const { uploadedUrls, allImages } = await imageUploaderRef.current.uploadPendingImages();
          uploadedImageUrls = uploadedUrls;

          if (allImages.length > 0) {
            finalImages = allImages;
            setFormData((prev) => ({
              ...prev,
              images: allImages.join(', '),
            }));
          }
        } catch (uploadError: any) {
          setError(`Image upload failed: ${uploadError.message}`);
          setSaving(false);
          return;
        }
      }

      const uniqueImages = Array.from(new Set(finalImages));

      // Check if we have at least a thumbnail (first image) or pending thumbnail
      const hasThumbnail = uniqueImages.length > 0 || (imageUploaderRef.current?.getPendingCount() ?? 0) > 0;
      
      if (!hasThumbnail) {
        setError('At least a thumbnail image is required');
        setSaving(false);
        return;
      }

      // Build meta object
      const meta: any = {};
      if (formData.metaTitle) meta.title = formData.metaTitle;
      if (formData.metaDescription) meta.description = formData.metaDescription;
      if (formData.metaKeywords) meta.keywords = formData.metaKeywords;
      if (formData.metaOgTitle) meta.ogTitle = formData.metaOgTitle;
      if (formData.metaOgDescription) meta.ogDescription = formData.metaOgDescription;
      if (formData.metaOgImage) meta.ogImage = formData.metaOgImage;
      if (formData.metaTwitterTitle) meta.twitterTitle = formData.metaTwitterTitle;
      if (formData.metaTwitterDescription) meta.twitterDescription = formData.metaTwitterDescription;
      if (formData.metaTwitterImage) meta.twitterImage = formData.metaTwitterImage;

      // Process reviews - parse images from comma-separated string
      const processedReviews = reviews.map((review) => ({
        ...review,
        images: review.images
          ? (typeof review.images === 'string'
              ? review.images.split(',').map((img) => img.trim()).filter((img) => img.length > 0)
              : review.images)
          : [],
      }));

      // Sanitize slug
      const sanitizedSlug = slugify(formData.slug || formData.title);
      if (!sanitizedSlug) {
        setError('Slug is required. Please provide a slug or title to generate one.');
        setSaving(false);
        return;
      }

      const updates = {
        slug: sanitizedSlug,
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        brand: formData.brand,
        category: formData.category,
        condition: formData.condition,
        payee_email: formData.payee_email.trim(),
        checkout_link: formData.checkout_link,
        currency: formData.currency,
        images: uniqueImages,
        rating: parseFloat(formData.rating),
        review_count: parseInt(formData.review_count),
        reviewCount: parseInt(formData.review_count),
        in_stock: formData.in_stock,
        inStock: formData.in_stock,
        is_featured: formData.is_featured,
        isFeatured: formData.is_featured,
        reviews: processedReviews.length > 0 ? processedReviews : [],
        meta: Object.keys(meta).length > 0 ? meta : {},
      };

      const response = await fetch(`/api/admin/products/${slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update product');
      }

      const updatedProduct = await response.json();
      setSuccess('Product updated successfully in database!');
      setProduct(updatedProduct); // Update product state with server response
      
      // If slug changed, redirect to new slug URL
      if (sanitizedSlug !== slug) {
        setTimeout(() => {
          router.push(`/admin/products/${sanitizedSlug}/edit`);
        }, 1000);
      } else {
        fetchProduct(); // Refresh to ensure we have latest data
      }
      setTimeout(() => setSuccess(''), 5000);
      
      // Optionally redirect back to products list after a delay
      // setTimeout(() => router.push('/admin/products'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update product');
    } finally {
      setSaving(false);
      setUploadStatus((prev) => ({ uploading: false, message: prev.message }));
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const processedValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    if (name === 'slug') {
      const sanitized = slugify(value);
      setSlugDirty(true);
      setFormData((prev) => ({
        ...prev,
        slug: sanitized,
      }));
      return;
    }

    if (name === 'is_featured' && typeof processedValue === 'boolean') {
      const currentlyFeatured = formData.is_featured;
      if (!currentlyFeatured && processedValue && featuredCount >= FEATURE_LIMIT) {
        setError(`You can feature up to ${FEATURE_LIMIT} products. Unfeature another product first.`);
        return;
      }

      setFeaturedCount((prev) => {
        let next = prev;
        if (!currentlyFeatured && processedValue) {
          next = prev + 1;
        } else if (currentlyFeatured && !processedValue) {
          next = Math.max(0, prev - 1);
        }
        setFeaturedLimitReached(next >= FEATURE_LIMIT);
        return next;
      });
    }

    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
      };

      if (name === 'title' && !slugDirty) {
        next.slug = slugify(processedValue as string);
      }

      return next;
    });
  };

  const regenerateSlug = () => {
    const generated = slugify(formData.title || '');
    setFormData((prev) => ({
      ...prev,
      slug: generated,
    }));
    setSlugDirty(false);
  };

  const handleReviewChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setCurrentReview((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : type === 'number' ? parseFloat(value) : value,
    }));
  };

  const addReview = () => {
    if (!currentReview.author || !currentReview.title || !currentReview.content) {
      alert('Please fill in author, title, and content for the review');
      return;
    }

    const review: Review = {
      id: currentReview.id || `review-${Date.now()}`,
      author: currentReview.author || '',
      avatar: currentReview.avatar || undefined,
      rating: currentReview.rating || 5,
      date: currentReview.date || new Date().toISOString().split('T')[0],
      title: currentReview.title || '',
      content: currentReview.content || '',
      helpful: currentReview.helpful || 0,
      verified: currentReview.verified !== undefined ? currentReview.verified : true,
      location: currentReview.location || undefined,
      purchaseDate: currentReview.purchaseDate || undefined,
      images: currentReview.images
        ? (typeof currentReview.images === 'string'
            ? currentReview.images.split(',').map((img) => img.trim()).filter((img) => img.length > 0)
            : currentReview.images)
        : undefined,
    };

    if (editingReviewIndex !== null) {
      // Update existing review
      const updatedReviews = [...reviews];
      updatedReviews[editingReviewIndex] = review;
      setReviews(updatedReviews);
      setEditingReviewIndex(null);
    } else {
      // Add new review
      setReviews([...reviews, review]);
    }

    setCurrentReview({
      id: '',
      author: '',
      avatar: '',
      rating: 5,
      date: new Date().toISOString().split('T')[0],
      title: '',
      content: '',
      helpful: 0,
      verified: true,
      location: '',
      purchaseDate: '',
      images: '',
    });
    setShowReviewForm(false);
  };

  const editReview = (index: number) => {
    const review = reviews[index];
    setCurrentReview({
      id: review.id || '',
      author: review.author || '',
      avatar: review.avatar || '',
      rating: review.rating || 5,
      date: review.date || new Date().toISOString().split('T')[0],
      title: review.title || '',
      content: review.content || '',
      helpful: review.helpful || 0,
      verified: review.verified !== undefined ? review.verified : true,
      location: review.location || '',
      purchaseDate: review.purchaseDate || '',
      images: Array.isArray(review.images) ? review.images.join(', ') : (review.images || ''),
    });
    setEditingReviewIndex(index);
    setShowReviewForm(true);
  };

  const removeReview = (index: number) => {
    setReviews(reviews.filter((_, i) => i !== index));
    if (editingReviewIndex === index) {
      setEditingReviewIndex(null);
      setShowReviewForm(false);
    } else if (editingReviewIndex !== null && editingReviewIndex > index) {
      setEditingReviewIndex(editingReviewIndex - 1);
    }
  };

  const handleResyncImages = async () => {
    const currentSlug = formData.slug || slug;
    if (!currentSlug) {
      setUploadStatus({ uploading: false, message: 'Product slug is required to resync images.' });
      return;
    }

    try {
      setUploadStatus({ uploading: true, message: 'Resyncing images from storage...' });
      const response = await fetch(`/api/admin/products/${encodeURIComponent(currentSlug)}/images`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to resync images.');
      }

      const data = await response.json();
      const images: string[] = Array.isArray(data.images) ? Array.from(new Set(data.images)) : [];

      setFormData((prev) => ({
        ...prev,
        images: images.join(', '),
      }));

      setUploadStatus({
        uploading: false,
        message: images.length
          ? `Synced ${images.length} image${images.length > 1 ? 's' : ''} from storage.`
          : 'No images found in storage for this product.',
      });
    } catch (err: any) {
      setUploadStatus({
        uploading: false,
        message: err.message || 'Failed to resync images.',
      });
    }
  };

  const handleUpdateCheckoutLink = async () => {
    if (!confirm('Update checkout link only?')) return;

    try {
      const response = await fetch(`/api/admin/products/${slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ checkout_link: formData.checkout_link }),
      });

      if (!response.ok) {
        throw new Error('Failed to update checkout link');
      }

      alert('Checkout link updated successfully!');
      fetchProduct();
    } catch (err: any) {
      alert(err.message || 'Failed to update checkout link');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">Product not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/products"
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Edit Product: {product.title}</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-lg border border-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-4 bg-green-50 text-green-800 rounded-lg border border-green-200">
              {success}
            </div>
          )}

          {uploadStatus.uploading && (
            <div className="mb-4 flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{uploadStatus.message || 'Uploading images, please keep this tab open...'}</span>
            </div>
          )}
          {!uploadStatus.uploading && uploadStatus.message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg">
              {uploadStatus.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
            {/* Basic Information */}
            <div className="border-b pb-4">
              <h2 className="text-lg font-semibold">Basic Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slug * (used for URLs)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="slug"
                    required
                    value={formData.slug}
                    onChange={handleChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be] font-mono text-sm"
                    placeholder="canon-camera-g7x-mark-iii"
                  />
                  <button
                    type="button"
                    onClick={regenerateSlug}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    title="Regenerate from title"
                  >
                    Regenerate
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Used for URLs. Only lowercase letters, numbers, and hyphens.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price *
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="price"
                  required
                  value={formData.price}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rating
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  name="rating"
                  value={formData.rating}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Count
                </label>
                <input
                  type="number"
                  min="0"
                  name="review_count"
                  value={formData.review_count}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand *
                </label>
                <input
                  type="text"
                  name="brand"
                  required
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <input
                  type="text"
                  name="category"
                  required
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Condition *
                </label>
                <input
                  type="text"
                  name="condition"
                  required
                  value={formData.condition}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    name="in_stock"
                    checked={formData.in_stock}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-[#0046be] focus:ring-[#0046be]"
                  />
                  In stock
                </label>
                <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    name="is_featured"
                    checked={formData.is_featured}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-[#0046be] focus:ring-[#0046be]"
                    disabled={featuredLimitReached && !formData.is_featured}
                  />
                  Featured on storefront
                </label>
                {featuredLimitReached && !formData.is_featured && (
                  <p className="text-xs text-[#7a6b0d]">
                    Maximum of {FEATURE_LIMIT} featured products reached. Unfeature another product first.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                name="description"
                required
                rows={6}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Images *
              </label>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-2">
                <p className="text-xs text-gray-600">
                  Manage the thumbnail and gallery images stored in Supabase.
                </p>
                <button
                  type="button"
                  onClick={handleResyncImages}
                  className="self-start md:self-auto inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={uploadStatus.uploading}
                >
                  Resync from Storage
                </button>
              </div>
              
              {/* Image Uploader Component */}
              <div className="mb-4">
                <ImageUploader
                  ref={imageUploaderRef}
                  productSlug={formData.slug || slug}
                  currentImages={formData.images ? formData.images.split(',').map(img => img.trim()).filter(img => img) : []}
                  onImagesUpdate={(urls) => {
                    setFormData((prev) => ({
                      ...prev,
                      images: urls.join(', '),
                    }));
                }}
                onUploadStatusChange={setUploadStatus}
                />
              </div>

              {/* Manual URL Input (Optional - for advanced users) */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 mb-2">
                  Advanced: Manually edit image URLs
                </summary>
                <textarea
                  name="images"
                  rows={3}
                  value={formData.images}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be] font-mono text-sm mt-2"
                  placeholder="Comma-separated image URLs"
                />
              </details>
            </div>

            {/* Payment & Checkout */}
            <div className="border-t pt-4">
              <h2 className="text-lg font-semibold mb-4">Payment & Checkout</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payee Email <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="email"
                name="payee_email"
                value={formData.payee_email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                placeholder="Optional: destination email for payouts"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to keep using your default payout email.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Checkout Link *
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  name="checkout_link"
                  required
                  value={formData.checkout_link}
                  onChange={handleChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
                <button
                  type="button"
                  onClick={handleUpdateCheckoutLink}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Update Link Only
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                You can update just the checkout link without saving all other fields
              </p>
            </div>

            {/* Reviews Section */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Reviews ({reviews.length})</h2>
                <button
                  type="button"
                  onClick={() => {
                    if (!showReviewForm) {
                      setEditingReviewIndex(null);
                      setCurrentReview({
                        id: '',
                        author: '',
                        avatar: '',
                        rating: 5,
                        date: new Date().toISOString().split('T')[0],
                        title: '',
                        content: '',
                        helpful: 0,
                        verified: true,
                        location: '',
                        purchaseDate: '',
                        images: '',
                      });
                    }
                    setShowReviewForm(!showReviewForm);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0046be] text-white rounded-lg hover:bg-[#003494] text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Review
                </button>
              </div>

              {showReviewForm && (
                <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-gray-50 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Review ID
                      </label>
                      <input
                        type="text"
                        name="id"
                        value={currentReview.id || ''}
                        onChange={handleReviewChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="review-1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Author *
                      </label>
                      <input
                        type="text"
                        name="author"
                        required
                        value={currentReview.author || ''}
                        onChange={handleReviewChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Avatar URL
                      </label>
                      <input
                        type="url"
                        name="avatar"
                        value={currentReview.avatar || ''}
                        onChange={handleReviewChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rating *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        name="rating"
                        value={currentReview.rating || 5}
                        onChange={handleReviewChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date *
                      </label>
                      <input
                        type="date"
                        name="date"
                        value={currentReview.date || ''}
                        onChange={handleReviewChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        name="location"
                        value={currentReview.location || ''}
                        onChange={handleReviewChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Purchase Date
                      </label>
                      <input
                        type="text"
                        name="purchaseDate"
                        value={currentReview.purchaseDate || ''}
                        onChange={handleReviewChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="January 2025"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Helpful Count
                      </label>
                      <input
                        type="number"
                        min="0"
                        name="helpful"
                        value={currentReview.helpful || 0}
                        onChange={handleReviewChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Review Title *
                    </label>
                    <input
                      type="text"
                      name="title"
                      required
                      value={currentReview.title || ''}
                      onChange={handleReviewChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Review Content *
                    </label>
                    <textarea
                      name="content"
                      required
                      rows={3}
                      value={currentReview.content || ''}
                      onChange={handleReviewChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Review Images (comma-separated URLs)
                    </label>
                    <input
                      type="text"
                      name="images"
                      value={typeof currentReview.images === 'string' ? currentReview.images : (currentReview.images?.join(', ') || '')}
                      onChange={handleReviewChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="https://example.com/img1.jpg, https://example.com/img2.jpg"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="verified"
                      checked={currentReview.verified !== undefined ? currentReview.verified : true}
                      onChange={handleReviewChange}
                      className="h-4 w-4 text-[#0046be] focus:ring-[#0046be] border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">Verified Purchase</label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addReview}
                      className="px-4 py-2 bg-[#0046be] text-white rounded-lg hover:bg-[#003494] text-sm"
                    >
                      {editingReviewIndex !== null ? 'Update Review' : 'Add Review'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowReviewForm(false);
                        setEditingReviewIndex(null);
                        setCurrentReview({
                          id: '',
                          author: '',
                          avatar: '',
                          rating: 5,
                          date: new Date().toISOString().split('T')[0],
                          title: '',
                          content: '',
                          helpful: 0,
                          verified: true,
                          location: '',
                          purchaseDate: '',
                          images: '',
                        });
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {reviews.length > 0 && (
                <div className="space-y-3">
                  {reviews.map((review, index) => (
                    <div key={review.id || index} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium">{review.author}</div>
                          <div className="text-sm text-gray-500">
                            {review.date} {review.location && `• ${review.location}`}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            <strong>{review.title}</strong> - {review.content.substring(0, 100)}...
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => editReview(index)}
                            className="text-[#0046be] hover:text-[#003494] p-1"
                            title="Edit review"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeReview(index)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Delete review"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SEO Meta Section */}
            <div className="border-t pt-4">
              <h2 className="text-lg font-semibold mb-4">SEO & Meta Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Title
                </label>
                <input
                  type="text"
                  name="metaTitle"
                  value={formData.metaTitle}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Description
                </label>
                <textarea
                  name="metaDescription"
                  rows={2}
                  value={formData.metaDescription}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Keywords
                </label>
                <input
                  type="text"
                  name="metaKeywords"
                  value={formData.metaKeywords}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                  placeholder="keyword1, keyword2, keyword3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OG Title
                </label>
                <input
                  type="text"
                  name="metaOgTitle"
                  value={formData.metaOgTitle}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OG Image URL
                </label>
                <input
                  type="url"
                  name="metaOgImage"
                  value={formData.metaOgImage}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OG Description
                </label>
                <textarea
                  name="metaOgDescription"
                  rows={2}
                  value={formData.metaOgDescription}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Twitter Title
                </label>
                <input
                  type="text"
                  name="metaTwitterTitle"
                  value={formData.metaTwitterTitle}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Twitter Image URL
                </label>
                <input
                  type="url"
                  name="metaTwitterImage"
                  value={formData.metaTwitterImage}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Twitter Description
                </label>
                <textarea
                  name="metaTwitterDescription"
                  rows={2}
                  value={formData.metaTwitterDescription}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="border-t pt-6 flex gap-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-[#0046be] text-white rounded-lg hover:bg-[#003494] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-5 w-5" />
                {saving ? 'Saving...' : 'Save All Changes'}
              </button>
              <Link
                href="/admin/products"
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
