const openpgp = require('openpgp');
const fs = require('fs');

async function generateKeys() {
    console.log('Generando par de llaves PGP (esto puede tardar unos segundos)...');

    const { privateKey, publicKey } = await openpgp.generateKey({
        type: 'rsa',
        rsaBits: 4096,
        userIDs: [{ name: 'MMM SYSTEM', email: 'admin@mmm-system.com' }],
    });

    fs.writeFileSync('pedidosya_private.key', privateKey);
    fs.writeFileSync('pedidosya_public.key', publicKey);

    console.log('✅ Llaves generadas con éxito:');
    console.log('- pedidosya_private.key (Mantenla SEGURÍSIMA)');
    console.log('- pedidosya_public.key (Esta es la que debes subir a PedidosYa)');
}

generateKeys().catch(console.error);
