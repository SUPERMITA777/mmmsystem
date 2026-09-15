import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sucursal_id = searchParams.get('sucursal_id');

    if (!sucursal_id) {
      return NextResponse.json({ success: false, error: 'sucursal_id is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('marketing_brand_config')
      .select('*')
      .eq('sucursal_id', sucursal_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No config found, return null data
        return NextResponse.json({ success: true, data: null });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching brand config:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { sucursal_id, logos, estilo_default, colores_marca, tono_comunicacion, instrucciones_permanentes, slogan } = body;

    if (!sucursal_id) {
      return NextResponse.json({ success: false, error: 'sucursal_id is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('marketing_brand_config')
      .upsert(
        {
          sucursal_id,
          logos,
          estilo_default,
          colores_marca,
          tono_comunicacion,
          instrucciones_permanentes,
          slogan,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'sucursal_id' }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error upserting brand config:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
