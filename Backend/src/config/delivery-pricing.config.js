export const DELIVERY_ORIGIN_ADDRESS = "Paseo Miguel de Cervantes 2, 28922 Alcorcón, Madrid, España";
export const MAX_DELIVERY_DISTANCE_KM = 40;
export const DELIVERY_MINIMUM_ORDER = 15;

export const DELIVERY_DISTANCE_TIERS = Object.freeze([
  { zone: "0-2", maxKm: 2, baseFee: 2.99, discounts: [{ subtotal: 45, fee: 0 }] },
  { zone: "2-4", maxKm: 4, baseFee: 3.99, discounts: [{ subtotal: 50, fee: 0 }] },
  { zone: "4-6", maxKm: 6, baseFee: 4.99, discounts: [{ subtotal: 40, fee: 3.99 }, { subtotal: 60, fee: 0 }] },
  { zone: "6-8", maxKm: 8, baseFee: 5.99, discounts: [{ subtotal: 50, fee: 4.99 }, { subtotal: 70, fee: 0 }] },
  { zone: "8-10", maxKm: 10, baseFee: 6.99, discounts: [{ subtotal: 50, fee: 5.99 }, { subtotal: 65, fee: 4.99 }, { subtotal: 80, fee: 0 }] },
  { zone: "10-12", maxKm: 12, baseFee: 7.99, discounts: [{ subtotal: 55, fee: 6.99 }, { subtotal: 70, fee: 4.99 }, { subtotal: 90, fee: 0 }] },
  { zone: "12-15", maxKm: 15, baseFee: 9.99, discounts: [{ subtotal: 60, fee: 7.99 }, { subtotal: 85, fee: 5.99 }, { subtotal: 110, fee: 0 }] },
  { zone: "15-20", maxKm: 20, baseFee: 12.99, discounts: [{ subtotal: 70, fee: 9.99 }, { subtotal: 100, fee: 6.99 }, { subtotal: 130, fee: 0 }] },
  { zone: "20-25", maxKm: 25, baseFee: 15.99, discounts: [{ subtotal: 80, fee: 11.99 }, { subtotal: 110, fee: 7.99 }, { subtotal: 150, fee: 0 }] },
  { zone: "25-30", maxKm: 30, baseFee: 18.99, discounts: [{ subtotal: 80, fee: 13.99 }, { subtotal: 120, fee: 8.99 }, { subtotal: 180, fee: 0 }] },
  { zone: "30-35", maxKm: 35, baseFee: 22.99, discounts: [{ subtotal: 100, fee: 15.99 }, { subtotal: 150, fee: 9.99 }, { subtotal: 220, fee: 0 }] },
  { zone: "35-40", maxKm: 40, baseFee: 26.99, discounts: [{ subtotal: 120, fee: 17.99 }, { subtotal: 170, fee: 10.99 }, { subtotal: 250, fee: 0 }] }
]);
