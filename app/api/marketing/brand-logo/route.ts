import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sucursal_id = body.sucursal_id || body.sucursalId;
    const rawImage = body.image_data || body.imagen_base64 || body.imageData || body.image;
    const fileNameParam = body.file_name || body.nombre || body.fileName;

    if (!sucursal_id || !rawImage) {
      return NextResponse.json(
        { success: false, error: 'sucursal_id e image_data (o imagen_base64) son requeridos' },
        { status: 400 }
      );
    }

    // Strip prefix if exists (data:image/...;base64,)
    const base64Data = rawImage.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const cleanFileName = fileNameParam ? fileNameParam.replace(/[^a-zA-Z0-9._-]/g, '_') : `logo_${timestamp}_${random}.png`;
    const storagePath = `brand/${sucursal_id}/${timestamp}_${cleanFileName}`;

    const { data, error } = await supabaseAdmin
      .storage
      .from('images')
      .upload(storagePath, buffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) {
      console.error('Error subiendo logo a storage:', error);
      throw error;
    }

    const { data: publicUrlData } = supabaseAdmin
      .storage
      .from('images')
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData.publicUrl;
    const logoName = (fileNameParam || 'Logo').replace(/\.[^/.]+$/, "");

    return NextResponse.json({
      success: true,
      url: publicUrl,
      logo: {
        url: publicUrl,
        nombre: logoName
      }
    });
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
