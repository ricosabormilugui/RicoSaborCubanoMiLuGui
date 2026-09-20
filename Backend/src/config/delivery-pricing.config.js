export const DELIVERY_ORIGIN_ADDRESS = "Paseo Miguel de Cervantes 2, 28922 Alcorcón, Madrid, España";
export const MAX_DELIVERY_DISTANCE_KM = 40;

export const DELIVERY_DISTANCE_TIERS = Object.freeze([
  { zone: "0-2", maxKm: 2, deliveryFee: 2.99, minimumOrder: 15 },
  { zone: "2-4", maxKm: 4, deliveryFee: 3.99, minimumOrder: 15 },
  { zone: "4-6", maxKm: 6, deliveryFee: 4.99, minimumOrder: 20 },
  { zone: "6-8", maxKm: 8, deliveryFee: 5.99, minimumOrder: 25 },
  { zone: "8-10", maxKm: 10, deliveryFee: 6.99, minimumOrder: 30 },
  { zone: "10-12", maxKm: 12, deliveryFee: 7.99, minimumOrder: 35 },
  { zone: "12-15", maxKm: 15, deliveryFee: 8.99, minimumOrder: 40 },
  { zone: "15-20", maxKm: 20, deliveryFee: 10.99, minimumOrder: 50 },
  { zone: "20-25", maxKm: 25, deliveryFee: 11.99, minimumOrder: 65, feeBreaks: [{ minSubtotal: 150, fee: 5.99 }, { minSubtotal: 100, fee: 8.99 }] },
  { zone: "25-30", maxKm: 30, deliveryFee: 13.99, minimumOrder: 80, feeBreaks: [{ minSubtotal: 150, fee: 5.99 }, { minSubtotal: 120, fee: 9.99 }] },
  { zone: "30-35", maxKm: 35, deliveryFee: 15.99, minimumOrder: 100, feeBreaks: [{ minSubtotal: 200, fee: 6.99 }, { minSubtotal: 150, fee: 10.99 }] },
  { zone: "35-40", maxKm: 40, deliveryFee: 17.99, minimumOrder: 120, feeBreaks: [{ minSubtotal: 200, fee: 7.99 }, { minSubtotal: 150, fee: 12.99 }] }
]);
