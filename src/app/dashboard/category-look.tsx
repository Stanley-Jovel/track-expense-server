import {
  ArrowLeftRight, Banknote, Bus, Clapperboard, Coffee, Dumbbell, Gift,
  GraduationCap, HeartHandshake, House, Landmark, PiggyBank, Pill, Plane,
  Receipt, Repeat, Shield, Shirt, ShoppingBag, ShoppingCart, Sofa, Sparkles,
  Tag, UtensilsCrossed, Wifi, Zap, type LucideIcon,
} from "lucide-react";

// SF Symbol stand-ins: an icon and an iOS system colour per built-in
// Category. Categories added by approval fall back to a grey tag.
const LOOKS: Record<string, [LucideIcon, string]> = {
  "Rent / Mortgage": [House, "#5856D6"],
  Utilities: [Zap, "#FFCC00"],
  "Internet & Phone": [Wifi, "#32ADE6"],
  "Home Maintenance & Furnishings": [Sofa, "#A2845E"],
  Groceries: [ShoppingCart, "#34C759"],
  "Dining Out": [UtensilsCrossed, "#FF9500"],
  "Coffee & Quick Bites": [Coffee, "#AC7F5E"],
  "Local Transportation": [Bus, "#007AFF"],
  Travel: [Plane, "#5AC8FA"],
  "Medical & Pharmacy": [Pill, "#FF3B30"],
  "Fitness & Wellness": [Dumbbell, "#30B0C7"],
  "Personal Care": [Sparkles, "#FF2D55"],
  "Shopping — General": [ShoppingBag, "#AF52DE"],
  Clothing: [Shirt, "#BF5AF2"],
  Entertainment: [Clapperboard, "#FF6482"],
  Subscriptions: [Repeat, "#5E5CE6"],
  Insurance: [Shield, "#64D2FF"],
  Taxes: [Landmark, "#8E8E93"],
  Education: [GraduationCap, "#0A84FF"],
  Gifts: [Gift, "#FF375F"],
  "Donations / Charity": [HeartHandshake, "#FF453A"],
  "Investments & Savings": [PiggyBank, "#30D158"],
  Transfers: [ArrowLeftRight, "#636366"],
  "Bank & FX Fees": [Receipt, "#98989D"],
  Income: [Banknote, "#34C759"],
};

export function categoryColor(category: string): string {
  return (LOOKS[category] ?? [Tag, "#8E8E93"])[1];
}

/** The rounded-square icon iOS Settings puts at the start of a row. */
export function CategoryIcon({ category, size = 29 }: { category: string; size?: number }) {
  const [Icon, color] = LOOKS[category] ?? [Tag, "#8E8E93"];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.24, background: color }}
    >
      <Icon size={size * 0.58} color="#fff" strokeWidth={2.2} />
    </span>
  );
}
