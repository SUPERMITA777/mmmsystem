/**
 * Selecciona un elemento al azar basado en su peso (probabilidad).
 * 
 * @param items Lista de objetos que contienen un campo 'peso' o 'probabilidad'
 * @param weightKey El nombre de la propiedad que indica el peso (default: 'probabilidad')
 * @returns El objeto seleccionado
 */
export function getWeightedRandom<T>(items: T[], weightKey: keyof T = 'probabilidad' as keyof T): T {
  // 1. Sumar todos los pesos de los elementos
  const totalWeight = items.reduce((sum, item) => sum + (Number(item[weightKey]) || 0), 0);
  
  // 2. Generar un número aleatorio entre 0 y el total
  let random = Math.random() * totalWeight;
  
  // 3. Recorrer los segmentos restando su peso al número aleatorio hasta que sea <= 0
  for (const item of items) {
    const weight = Number(item[weightKey]) || 0;
    if (random <= weight) {
      return item;
    }
    random -= weight;
  }
  
  // Fallback al último elemento si algo sale mal con los flotantes
  return items[items.length - 1];
}
