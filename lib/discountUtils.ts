export interface Descuento {
    id: string;
    tipo: string;
    valor: number;
    activo: boolean;
    aplicar_a: string;
    producto_id?: string | null;
    categoria_id?: string | null;
    productos_ids?: string[] | null;
    categorias_ids?: string[] | null;
    no_acumulable?: boolean;
    fecha_desde?: string | null;
    fecha_hasta?: string | null;
    hora_desde?: string | null;
    hora_hasta?: string | null;
}

export function isValidDiscountTime(d: Descuento): boolean {
    if (!d.activo) return false;

    const now = new Date();

    // Check Date Range if set
    if (d.fecha_desde) {
        const from = new Date(d.fecha_desde + "T00:00:00");
        if (now < from) return false;
    }
    if (d.fecha_hasta) {
        const to = new Date(d.fecha_hasta + "T23:59:59");
        if (now > to) return false;
    }

    // Check Time Range if set
    if (d.hora_desde || d.hora_hasta) {
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTime = currentHours * 60 + currentMinutes;

        const parseTime = (timeStr: string) => {
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };

        if (d.hora_desde) {
            const fromTime = parseTime(d.hora_desde);
            if (currentTime < fromTime) return false;
        }

        if (d.hora_hasta) {
            const toTime = parseTime(d.hora_hasta);
            if (currentTime > toTime) return false;
        }
    }

    return true;
}

export function getProductDiscount(productId: string, categoryId: string, descuentos: Descuento[] = []): {
    id: string;
    porcentaje: number;
    precioFinal: (precio: number) => number;
    no_acumulable: boolean;
    nombre?: string;
} | null {
    if (!descuentos || descuentos.length === 0) return null;

    // Filter valid discounts by time/date/active
    const validDescs = descuentos.filter(isValidDiscountTime);

    // Priority: product-specific > category > general
    const prodDisc = validDescs.find(d =>
        d.aplicar_a === "producto" &&
        (d.producto_id === productId || (d.productos_ids && d.productos_ids.includes(productId)))
    );

    const catDisc = validDescs.find(d =>
        d.aplicar_a === "categoria" &&
        (d.categoria_id === categoryId || (d.categorias_ids && d.categorias_ids.includes(categoryId)))
    );

    const genDisc = validDescs.find(d => d.aplicar_a === "general");

    const disc = prodDisc || catDisc || genDisc;
    if (!disc) return null;

    if (disc.tipo === "porcentaje") {
        return {
            id: disc.id,
            porcentaje: disc.valor,
            precioFinal: (precio: number) => Math.round(precio * (1 - disc.valor / 100)),
            no_acumulable: !!disc.no_acumulable,
            nombre: (disc as any).nombre
        };
    }
    // fijo
    return {
        id: disc.id,
        porcentaje: 0,
        precioFinal: (precio: number) => Math.max(0, precio - disc.valor),
        no_acumulable: !!disc.no_acumulable,
        nombre: (disc as any).nombre
    };
}
