import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const format = searchParams.get('format') || 'jsonv2';

    let url = '';
    if (q) {
        url = `https://nominatim.openstreetmap.org/search?format=${format}&q=${encodeURIComponent(q)}&limit=1`;
    } else if (lat && lon) {
        url = `https://nominatim.openstreetmap.org/reverse?format=${format}&lat=${lat}&lon=${lon}`;
    } else {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'MMMSystem/1.0',
                'Accept-Language': 'es'
            }
        });
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Geocode API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch from Nominatim' }, { status: 502 });
    }
}
