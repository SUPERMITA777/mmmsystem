async function test(query) {
    let q = query.replace(/\s+Y\s+/gi, ' and ').replace(/\s+E\s+/gi, ' and '); // Nominatim sometimes understands "and" or just space for intersections. Or maybe "&"
    const encodedQ = encodeURIComponent(q);

    console.log(`\nFetching: ${query} -> ${q}`);
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodedQ}&countrycodes=ar&limit=1`;
    try {
        const r = await fetch(url);
        const d = await r.json();
        if (d.length > 0) {
            console.log(`FOUND: ${d[0].lat}, ${d[0].lon} - ${d[0].display_name}`);
        } else {
            console.log("NOT FOUND");
        }
    } catch (e) {
        console.error(e);
    }
}

async function run() {
    await test("MONTEVIDEO Y VILLEGAS, FLORENCIO VARELA");
    await test("MONTEVIDEO AND VILLEGAS, FLORENCIO VARELA");
    await test("MONTEVIDEO Y CONRADO VILLEGAS, FLORENCIO VARELA");
    await test("MONTEVIDEO, FLORENCIO VARELA");
}

run();
