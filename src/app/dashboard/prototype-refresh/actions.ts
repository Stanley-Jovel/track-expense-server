'use server';

// PROTOTYPE (dashboard refresh affordance) — shared backbone for the three
// `?variant=` UI variants in variants.tsx. This action is the real fix either
// way: it busts the unstable_cache tag AND the ISR page cache so the next
// render re-reads the sheet.

import { revalidatePath, revalidateTag } from 'next/cache';

export async function refreshDashboardData(): Promise<{ refreshedAt: number }> {
  revalidateTag('sheet-transactions');
  revalidatePath('/dashboard');
  return { refreshedAt: Date.now() };
}
