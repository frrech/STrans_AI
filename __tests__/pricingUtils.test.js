import { aplicarPricing } from "../services/pricingUtils.js";

describe("pricingUtils.aplicarPricing", () => {
  test("retorna o mesmo preço sem urgência e sem desconto", () => {
    expect(aplicarPricing(100, false, 0)).toBe(100);
  });

  test("aplica urgência corretamente (+50%)", () => {
    expect(aplicarPricing(100, true, 0)).toBe(150);
  });

  test("aplica desconto corretamente (máx 30%)", () => {
    expect(aplicarPricing(100, false, 0.2)).toBe(80);
    expect(aplicarPricing(100, false, 0.5)).toBe(70); // limitado a 30%
  });

  test("garante valor mínimo de 1.0", () => {
    expect(aplicarPricing(0.3)).toBe(1);
  });
});
