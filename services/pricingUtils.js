export function aplicarPricing(basePrice, urgencia=false, descontoVolume=0) {
    let price = basePrice;
    if (urgencia) price *= 1.5;
    if (descontoVolume && descontoVolume > 0) {
      price *= (1 - Math.min(descontoVolume, 0.3)); // até 30%
    }
    return Math.max(1.0, Number(price.toFixed(2)));
  }
  