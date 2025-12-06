import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Helper to get auth from request
async function getAdminAuth(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  
  if (token) {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    const { isAdmin } = await import('@/lib/supabase/auth');
    const adminStatus = await isAdmin(user.email || '');
    if (!adminStatus) {
      return null;
    }
    
    return token;
  }
  
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const headerToken = authHeader.split('Bearer ')[1];
  return headerToken;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined;
  
  try {
    // Check authentication
    const auth = await getAdminAuth(request);
    if (!auth) {
      console.error('[mark-converted] Authentication failed: No valid admin token');
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          details: 'Authentication required. Please log in again.',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      );
    }

    const paramsData = await params;
    id = paramsData.id;
    
    if (!id || typeof id !== 'string' || id.trim() === '') {
      console.error('[mark-converted] Invalid order ID:', id);
      return NextResponse.json(
        { 
          error: 'Order ID is required',
          details: 'The order ID must be a valid string',
          code: 'INVALID_ORDER_ID'
        },
        { status: 400 }
      );
    }

    // First, verify the order exists
    const { data: existingOrder, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, is_converted')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('[mark-converted] Error fetching order:', {
        orderId: id,
        error: fetchError,
        code: fetchError.code,
        message: fetchError.message,
        details: fetchError.details,
        hint: fetchError.hint
      });
      
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { 
            error: 'Order not found',
            details: `No order found with ID: ${id}`,
            code: 'ORDER_NOT_FOUND'
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Database error',
          details: fetchError.message || 'Failed to fetch order',
          code: fetchError.code || 'DB_ERROR',
          hint: fetchError.hint
        },
        { status: 500 }
      );
    }

    if (!existingOrder) {
      console.error('[mark-converted] Order not found:', id);
      return NextResponse.json(
        { 
          error: 'Order not found',
          details: `No order found with ID: ${id}`,
          code: 'ORDER_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Update order to mark as converted
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({
        is_converted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[mark-converted] Error updating order:', {
        orderId: id,
        error: error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      return NextResponse.json(
        { 
          error: 'Failed to update order',
          details: error.message || 'Database update failed',
          code: error.code || 'UPDATE_ERROR',
          hint: error.hint || 'Check database connection and permissions'
        },
        { status: 500 }
      );
    }

    if (!data) {
      console.error('[mark-converted] Update succeeded but no data returned:', id);
      return NextResponse.json(
        { 
          error: 'Update failed',
          details: 'Order update completed but no data was returned',
          code: 'NO_DATA_RETURNED'
        },
        { status: 500 }
      );
    }

    console.log('[mark-converted] Successfully marked order as converted:', id);
    return NextResponse.json({
      success: true,
      order: data,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[mark-converted] Unexpected error:', {
      orderId: id || 'unknown',
      error: errorMessage,
      stack: errorStack,
      type: error?.constructor?.name
    });
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: errorMessage,
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

