async function test() {
    const q1 = encodeURIComponent("MONTEVIDEO Y VILLEGAS, FLORENCIO VARELA");
    const q2 = encodeURIComponent("MONTEVIDEO, FLORENCIO VARELA");

    console.log("Fetching Nominatim...");

    try {
        const r1 = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${q1}&limit=1`);
        const d1 = await r1.json();
        console.log("Result for 'MONTEVIDEO Y VILLEGAS, FLORENCIO VARELA':", d1.length > 0 ? d1[0] : "Not found");

        const r2 = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${q2}&limit=1`);
        const d2 = await r2.json();
        console.log("\nResult for 'MONTEVIDEO, FLORENCIO VARELA':", d2.length > 0 ? d2[0] : "Not found");
    } catch (e) {
        console.error(e);
    }
}
test();
