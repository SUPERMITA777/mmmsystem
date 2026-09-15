export interface PromoProduct {
    id?: string;
    nombre?: string;
    precio: number;
    precio_promocional?: number | null;
    promo_activo?: boolean | null;
    promo_desde?: string | null;       // YYYY-MM-DD
    promo_hasta?: string | null;       // YYYY-MM-DD
    promo_hora_desde?: string | null;  // HH:mm or HH:mm:ss
    promo_hora_hasta?: string | null;  // HH:mm or HH:mm:ss
    promo_dias?: number[] | null;      // [0, 1, 2, 3, 4, 5, 6] (0 = Domingo, 1 = Lunes, ...)
}

export interface PromoInfo {
    isPromo: boolean;
    precioRegular: number;
    precioFinal: number;
    descuentoMonto: number;
    descuentoPorcentaje: number;
    motivoInactivo?: string;
}

/**
 * Parsea un string de hora HH:mm a minutos desde las 00:00
 */
function parseTimeToMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

/**
 * Formatea una fecha local a YYYY-MM-DD
 */
function getLocalDateString(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Determina si el precio promocional de un producto está activo en un momento dado.
 */
export function isProductPromoActive(prod?: PromoProduct | null, now: Date = new Date()): boolean {
    if (!prod) return false;
    if (!prod.promo_activo) return false;
    if (prod.precio_promocional == null || prod.precio_promocional <= 0) return false;
    if (prod.precio_promocional >= prod.precio) return false;

    const todayStr = getLocalDateString(now);

    // 1. Rango de fechas
    if (prod.promo_desde) {
        if (todayStr < prod.promo_desde) return false;
    }
    if (prod.promo_hasta) {
        if (todayStr > prod.promo_hasta) return false;
    }

    // 2. Días de la semana (0 = Domingo, 1 = Lunes, ..., 6 = Sábado)
    if (Array.isArray(prod.promo_dias) && prod.promo_dias.length > 0) {
        const currentDay = now.getDay();
        if (!prod.promo_dias.includes(currentDay)) return false;
    }

    // 3. Rango de horas
    if (prod.promo_hora_desde || prod.promo_hora_hasta) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const fromMin = prod.promo_hora_desde ? parseTimeToMinutes(prod.promo_hora_desde) : 0;
        const toMin = prod.promo_hora_hasta ? parseTimeToMinutes(prod.promo_hora_hasta) : 1439;

        if (fromMin <= toMin) {
            // Rango diurno normal (ej: 20:00 a 23:59)
            if (currentMinutes < fromMin || currentMinutes > toMin) return false;
        } else {
            // Rango nocturno que cruza la medianoche (ej: 20:00 a 02:00)
            if (currentMinutes < fromMin && currentMinutes > toMin) return false;
        }
    }

    return true;
}

/**
 * Obtiene la información completa del precio promocional del producto
 */
export function getProductPromoInfo(prod?: PromoProduct | null, now: Date = new Date()): PromoInfo {
    if (!prod) {
        return {
            isPromo: false,
            precioRegular: 0,
            precioFinal: 0,
            descuentoMonto: 0,
            descuentoPorcentaje: 0,
            motivoInactivo: 'Sin producto'
        };
    }

    const regular = Number(prod.precio) || 0;
    const promo = Number(prod.precio_promocional) || 0;

    if (!prod.promo_activo) {
        return {
            isPromo: false,
            precioRegular: regular,
            precioFinal: regular,
            descuentoMonto: 0,
            descuentoPorcentaje: 0,
            motivoInactivo: 'Promoción desactivada'
        };
    }

    if (promo <= 0 || promo >= regular) {
        return {
            isPromo: false,
            precioRegular: regular,
            precioFinal: regular,
            descuentoMonto: 0,
            descuentoPorcentaje: 0,
            motivoInactivo: 'Precio promocional inválido o mayor al regular'
        };
    }

    const isActive = isProductPromoActive(prod, now);

    if (!isActive) {
        return {
            isPromo: false,
            precioRegular: regular,
            precioFinal: regular,
            descuentoMonto: 0,
            descuentoPorcentaje: 0,
            motivoInactivo: 'Fuera de rango de fechas u horario permitido'
        };
    }

    const ahorro = regular - promo;
    const porcentaje = Math.round((ahorro / regular) * 100);

    return {
        isPromo: true,
        precioRegular: regular,
        precioFinal: promo,
        descuentoMonto: ahorro,
        descuentoPorcentaje: porcentaje
    };
}

export const DIAS_SEMANA = [
    { dia: 1, label: "Lun", nombre: "Lunes" },
    { dia: 2, label: "Mar", nombre: "Martes" },
    { dia: 3, label: "Mié", nombre: "Miércoles" },
    { dia: 4, label: "Jue", nombre: "Jueves" },
    { dia: 5, label: "Vie", nombre: "Viernes" },
    { dia: 6, label: "Sáb", nombre: "Sábado" },
    { dia: 0, label: "Dom", nombre: "Domingo" },
];
