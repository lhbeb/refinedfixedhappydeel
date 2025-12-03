"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, Plus, X, Loader2 } from 'lucide-react';
import ImageUploader, { ImageUploaderRef, UploadStatus } from '@/components/admin/ImageUploader';
import AdminLayout from '@/components/AdminLayout';

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

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function NewProductPage() {
  const FEATURE_LIMIT = 6;
  const router = useRouter();
  const imageUploaderRef = useRef<ImageUploaderRef>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ uploading: false });
  const [slugDirty, setSlugDirty] = useState(false);
  const [featuredCount, setFeaturedCount] = useState(0);
  const [featuredLimitReached, setFeaturedLimitReached] = useState(false);
  const [formData, setFormData] = useState({
    slug: '',
    id: '',
    title: '',
    description: '',
    price: '',
    brand: '',
    category: '',
    condition: '',
    payeeEmail: '',
    checkoutLink: '',
    currency: 'USD',
    images: '',
    rating: '0',
    reviewCount: '0',
    inStock: true,
    isFeatured: false,
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
    images: [] as string[],
  });

  useEffect(() => {
    const loadFeaturedCount = async () => {
      try {
        const response = await fetch('/api/admin/products');
        if (!response.ok) return;
        const data = await response.json();
        const count = Array.isArray(data)
          ? data.filter((product: any) => product?.isFeatured || product?.is_featured).length
          : 0;
        setFeaturedCount(count);
        setFeaturedLimitReached(count >= FEATURE_LIMIT);
      } catch (loadError) {
        console.error('Failed to load featured count', loadError);
      }
    };

    loadFeaturedCount();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setUploadStatus((prev) => ({ ...prev, uploading: false, message: undefined }));

    try {
      const sanitizedSlug = slugify(formData.slug || formData.title);
      if (!sanitizedSlug) {
        setError('Slug is required. Please provide a slug or title to generate one.');
        setLoading(false);
        return;
      }

      if (sanitizedSlug !== formData.slug) {
        setFormData((prev) => ({
          ...prev,
          slug: sanitizedSlug,
        }));
      }

      // First, upload any pending images
      let finalImages: string[] = formData.images
        .split(',')
        .map((img) => img.trim())
        .filter((img) => img.length > 0);

      if (imageUploaderRef.current) {
        try {
          const { allImages } = await imageUploaderRef.current.uploadPendingImages();

          if (allImages.length > 0) {
            finalImages = allImages;
            setFormData((prev) => ({
              ...prev,
              images: allImages.join(', '),
            }));
          }
        } catch (uploadError: any) {
          setError(`Image upload failed: ${uploadError.message}`);
          setLoading(false);
          return;
        }
      }

      // Check if we have at least a thumbnail (first image)
      const hasThumbnail = finalImages.length > 0 || (imageUploaderRef.current?.getPendingCount() ?? 0) > 0;
      
      if (!hasThumbnail) {
        setError('At least a thumbnail image is required');
        setLoading(false);
        return;
      }

      const uniqueImages = Array.from(new Set(finalImages));

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
      const processedReviews = reviews.map((review) => {
        let imagesArray: string[] = [];
        const reviewImages: string[] | string | undefined = review.images;
        if (reviewImages) {
          if (typeof reviewImages === 'string') {
            imagesArray = reviewImages.split(',').map((img) => img.trim()).filter((img) => img.length > 0);
          } else if (Array.isArray(reviewImages)) {
            imagesArray = reviewImages;
          }
        }
        return {
          ...review,
          images: imagesArray,
        };
      });

      // Use slug as id if id is not provided
      const productId = formData.id || sanitizedSlug;

      const productData = {
        slug: sanitizedSlug,
        id: productId,
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        brand: formData.brand,
        category: formData.category,
        condition: formData.condition,
        payee_email: formData.payeeEmail.trim(),
        checkout_link: formData.checkoutLink,
        currency: formData.currency,
        images: uniqueImages,
        rating: parseFloat(formData.rating),
        review_count: parseInt(formData.reviewCount),
        reviewCount: parseInt(formData.reviewCount),
        in_stock: formData.inStock,
        inStock: formData.inStock,
        is_featured: formData.isFeatured,
        isFeatured: formData.isFeatured,
        reviews: processedReviews.length > 0 ? processedReviews : [],
        meta: Object.keys(meta).length > 0 ? meta : {},
      };

      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create product');
      }

      const product = await response.json();
      router.push(`/admin/products/${product.slug}/edit`);
    } catch (err: any) {
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
      setUploadStatus((prev) => ({ uploading: false, message: prev.message }));
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (name === 'slug') {
      const sanitized = slugify(value);
      setSlugDirty(true);
      setFormData((prev) => ({
        ...prev,
        slug: sanitized,
      }));
      return;
    }

    const processedValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    if (name === 'isFeatured' && typeof processedValue === 'boolean') {
      if (processedValue && featuredCount >= FEATURE_LIMIT) {
        setError(`You can feature up to ${FEATURE_LIMIT} products. Unfeature another product first.`);
        return;
      }

      setFeaturedCount((prev) => {
        const next = processedValue ? prev + 1 : Math.max(0, prev - 1);
        setFeaturedLimitReached(next >= FEATURE_LIMIT);
        return next;
      });
    }

    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: processedValue,
      };

      if (name === 'title' && !slugDirty) {
        next.slug = slugify(processedValue as string);
      }

      return next;
    });
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

  const regenerateSlug = () => {
    const generated = slugify(formData.title || '');
    setFormData((prev) => ({
      ...prev,
      slug: generated,
    }));
    setSlugDirty(false);
  };

  const handleResyncImages = async () => {
    if (!formData.slug) {
      setUploadStatus({ uploading: false, message: 'Enter a product slug before resyncing images.' });
      return;
    }

    try {
      setUploadStatus({ uploading: true, message: 'Resyncing images from storage...' });
      const response = await fetch(`/api/admin/products/${encodeURIComponent(formData.slug)}/images`);
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
          : 'No images found in storage for this slug.',
      });
    } catch (err: any) {
      setUploadStatus({
        uploading: false,
        message: err.message || 'Failed to resync images.',
      });
    }
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

    setReviews([...reviews, review]);
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

  const removeReview = (index: number) => {
    setReviews(reviews.filter((_, i) => i !== index));
  };

  return (
    <AdminLayout title="Add New Product" subtitle="Create a new product listing">
        <div className="max-w-4xl">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-lg">{error}</div>
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
                  Slug * (will also be used as ID)
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
                <p className="mt-1 text-xs text-gray-500">Used for URLs and storage folders. Only lowercase letters, numbers, and hyphens.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID (optional, defaults to slug)
                </label>
                <input
                  type="text"
                  name="id"
                  value={formData.id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                  placeholder="Leave empty to use slug"
                />
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
                  placeholder="Canon PowerShot G7 X Mark III 20.1MP Digital Point & Shoot Camera - Black"
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
                  Brand *
                </label>
                <input
                  type="text"
                  name="brand"
                  required
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                  placeholder="Canon"
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
                  placeholder="Digital Cameras"
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
                  placeholder="Used - Like New"
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
                  name="reviewCount"
                  value={formData.reviewCount}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                />
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
                placeholder="Detailed product description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Images *
              </label>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-2">
                <p className="text-xs text-gray-600">
                  Upload a thumbnail and optional gallery images. Files are saved to Supabase Storage.
                </p>
                <button
                  type="button"
                  onClick={handleResyncImages}
                  className="self-start md:self-auto inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={!formData.slug || uploadStatus.uploading}
                >
                  Resync from Storage
                </button>
              </div>
              
              {formData.slug ? (
                <>
                  {/* Image Uploader Component */}
                  <div className="mb-4">
                    <ImageUploader
                      ref={imageUploaderRef}
                      productSlug={formData.slug}
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

                  {/* Manual URL Input (Optional) */}
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
                </>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Please enter a product slug first to enable image upload.
                  </p>
                  <textarea
                    name="images"
                    required
                    rows={4}
                    value={formData.images}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be] font-mono text-sm mt-2"
                    placeholder="Comma-separated image URLs (temporary - will be replaced after slug is set)"
                  />
                </div>
              )}
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
                name="payeeEmail"
                value={formData.payeeEmail}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                placeholder="Optional: destination email for payouts"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank if this product should use your default payout email.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Checkout Link *
              </label>
              <input
                type="url"
                name="checkoutLink"
                required
                value={formData.checkoutLink}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be]"
                placeholder="https://buymeacoffee.com/annahoffman/extras/checkout/..."
              />
            </div>

            {/* Reviews Section */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Reviews</h2>
                <button
                  type="button"
                  onClick={() => setShowReviewForm(!showReviewForm)}
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
                        placeholder="New York, NY"
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
                        placeholder="December 2023"
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
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="verified"
                        checked={currentReview.verified !== false}
                        onChange={handleReviewChange}
                        className="h-4 w-4 text-[#0046be] border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-900">Verified Purchase</label>
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
                    <textarea
                      name="images"
                      rows={2}
                      value={typeof currentReview.images === 'string' ? currentReview.images : (currentReview.images || []).join(', ')}
                      onChange={handleReviewChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addReview}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      Add Review
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReviewForm(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {reviews.length > 0 && (
                <div className="space-y-2">
                  {reviews.map((review, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium">{review.author} - {review.title}</div>
                        <div className="text-sm text-gray-600">Rating: {review.rating}/5 | {review.date}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeReview(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Meta Information */}
            <div className="border-t pt-4">
              <h2 className="text-lg font-semibold mb-4">SEO Meta Information (Optional)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Title
                </label>
                <input
                  type="text"
                  name="metaTitle"
                  value={formData.metaTitle}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be] text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Keywords
                </label>
                <input
                  type="text"
                  name="metaKeywords"
                  value={formData.metaKeywords}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be] text-sm"
                  placeholder="keyword1, keyword2, keyword3"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meta Description
              </label>
              <textarea
                name="metaDescription"
                rows={2}
                value={formData.metaDescription}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be] text-sm"
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="text-md font-semibold mb-3">Open Graph Meta</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OG Title
                  </label>
                  <input
                    type="text"
                    name="metaOgTitle"
                    value={formData.metaOgTitle}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OG Image
                  </label>
                  <input
                    type="url"
                    name="metaOgImage"
                    value={formData.metaOgImage}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be] text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OG Description
                  </label>
                  <textarea
                    name="metaOgDescription"
                    rows={2}
                    value={formData.metaOgDescription}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be] text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-md font-semibold mb-3">Twitter Card Meta</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Twitter Title
                  </label>
                  <input
                    type="text"
                    name="metaTwitterTitle"
                    value={formData.metaTwitterTitle}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Twitter Image
                  </label>
                  <input
                    type="url"
                    name="metaTwitterImage"
                    value={formData.metaTwitterImage}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be] text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Twitter Description
                  </label>
                  <textarea
                    name="metaTwitterDescription"
                    rows={2}
                    value={formData.metaTwitterDescription}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0046be] focus:border-[#0046be] text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  name="inStock"
                  checked={formData.inStock}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-[#0046be] focus:ring-[#0046be]"
                />
                In stock
              </label>
              <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  name="isFeatured"
                  checked={formData.isFeatured}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-[#0046be] focus:ring-[#0046be]"
                  disabled={featuredLimitReached && !formData.isFeatured}
                />
                Mark as featured product
              </label>
              {featuredLimitReached && !formData.isFeatured && (
                <p className="text-xs text-[#7a6b0d]">
                  Maximum of {FEATURE_LIMIT} featured products reached. Unfeature another product first.
                </p>
              )}
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-[#0046be] text-white rounded-lg hover:bg-[#003494] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-5 w-5" />
                {loading ? 'Creating...' : 'Create Product'}
              </button>
              <Link
                href="/admin/products"
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
    </AdminLayout>
  );
}
