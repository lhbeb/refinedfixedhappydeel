import { NextRequest, NextResponse } from 'next/server';
import {
  getProductBySlug,
  updateProduct,
  deleteProduct,
  updateCheckoutLink,
} from '@/lib/supabase/products';
import { supabaseAdmin } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const FEATURE_LIMIT = 6;

async function assertFeaturedLimit(canFeature: boolean) {
  if (!canFeature) return;

  const { count, error } = await supabaseAdmin
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('is_featured', true);

  if (error) {
    console.error('Failed to check featured product count:', error);
    throw new Error('Unable to verify featured product limit. Please try again.');
  }

  if ((count ?? 0) >= FEATURE_LIMIT) {
    const limitError = new Error(`Maximum of ${FEATURE_LIMIT} featured products reached. Unfeature another product first.`);
    (limitError as any).statusCode = 400;
    throw limitError;
  }
}

function revalidateProductPaths(slug: string) {
  revalidatePath('/');
  revalidatePath('/products');
  revalidatePath(`/products/${slug}`);
}

// Helper to get auth from request
async function getAdminAuth(request: NextRequest) {
  // Check for admin_token cookie first
  const token = request.cookies.get('admin_token')?.value;
  
  if (token) {
    // Verify the token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    // Check if user is admin
    const { isAdmin } = await import('@/lib/supabase/auth');
    const adminStatus = await isAdmin(user.email || '');
    if (!adminStatus) {
      return null;
    }
    
    return token;
  }
  
  // Fallback to Authorization header (for backward compatibility)
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const headerToken = authHeader.split('Bearer ')[1];
  return headerToken;
}

// GET - Get single product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const product = await getProductBySlug(slug);

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve product' },
      { status: 500 }
    );
  }
}

// PATCH - Update product
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  let slug: string | undefined;
  
  try {
    // Check authentication
    const auth = await getAdminAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paramsData = await params;
    slug = paramsData.slug;
    const existing = await getProductBySlug(slug);

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const updates = await request.json();

    const wantsFeatured = updates.is_featured ?? updates.isFeatured;
    if (wantsFeatured === true && !(existing.isFeatured ?? false)) {
      try {
        await assertFeaturedLimit(true);
      } catch (limitError: any) {
        const status = limitError.statusCode || 500;
        return NextResponse.json({ error: limitError.message }, { status });
      }
    }

    // Validate required fields
    if (updates.title !== undefined && (!updates.title || updates.title.trim() === '')) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: 'Product title cannot be empty',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    if (updates.price !== undefined && (isNaN(updates.price) || updates.price < 0)) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: 'Product price must be a valid positive number',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    const product = await updateProduct(slug, updates);

    if (!product) {
      console.error('[PATCH /products] Update returned null:', {
        slug,
        updates: Object.keys(updates),
        existing: !!existing
      });
      return NextResponse.json(
        { 
          error: 'Update failed',
          details: 'Product update operation returned no data. The product may not exist or the update may have failed.',
          code: 'UPDATE_FAILED'
        },
        { status: 404 }
      );
    }

    revalidateProductPaths(product.slug);

    return NextResponse.json(product);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[PATCH /products] Error updating product:', {
      slug: slug || 'unknown',
      error: errorMessage,
      stack: errorStack,
      type: error?.constructor?.name
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to update product',
        details: errorMessage,
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Check authentication
    const auth = await getAdminAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const success = await deleteProduct(slug);

    if (!success) {
      return NextResponse.json(
        { error: 'Product not found or delete failed' },
        { status: 404 }
      );
    }

    revalidateProductPaths(slug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}

