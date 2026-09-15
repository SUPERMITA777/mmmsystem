import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sucursal_id, image_data, file_name } = body;

    if (!sucursal_id || !image_data) {
      return NextResponse.json({ success: false, error: 'sucursal_id and image_data are required' }, { status: 400 });
    }

    // Strip prefix if exists
    const base64Data = image_data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const fileName = file_name || `logo_${timestamp}_${random}.png`;
    const storagePath = `brand/${sucursal_id}/${fileName}`;

    const { data, error } = await supabaseAdmin
      .storage
      .from('images')
      .upload(storagePath, buffer, {
        contentType: 'image/png',
        upsert: false
      });

    if (error) {
      throw error;
    }

    const { data: publicUrlData } = supabaseAdmin
      .storage
      .from('images')
      .getPublicUrl(storagePath);

    return NextResponse.json({ success: true, url: publicUrlData.publicUrl });
  } catch (error: any) {
    console.error('Error uploading logo:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: 'url is required' }, { status: 400 });
    }

    // Extract path after /images/
    const urlParts = url.split('/images/');
    if (urlParts.length < 2) {
      return NextResponse.json({ success: false, error: 'Invalid URL format' }, { status: 400 });
    }
    
    const storagePath = urlParts[1];

    const { error } = await supabaseAdmin
      .storage
      .from('images')
      .remove([storagePath]);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting logo:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
