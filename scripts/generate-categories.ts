import 'dotenv/config';
import OpenAI from 'openai';
import { GoogleSheetsService } from '../src/app/services/spreadsheet/google-sheets-service';

/**
 * Category generation script.
 *
 * Reads all transactions from Google Sheets, builds a frequency map of existing
 * categories, extracts sample motive descriptions, then calls an LLM to suggest
 * exactly 12 expense categories that cover the observed spending patterns.
 *
 * Usage:
 *   npm run generate-categories
 *
 * Required env vars (in .env):
 *   GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID
 *   ZAI_API_KEY  (primary) OR  GROQ_API_KEY  (fallback via Groq)
 */

async function main() {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Load transactions from Google Sheets
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[generate-categories] Connecting to Google Sheets...');
  const sheetsService = new GoogleSheetsService();
  const transactions = await sheetsService.getAllTransactions();
  console.log(`[generate-categories] Loaded ${transactions.length} transactions`);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Build frequency map of existing categories
  // ──────────────────────────────────────────────────────────────────────────
  const categoryFreq: Record<string, number> = {};
  for (const tx of transactions) {
    const cat = tx.category.trim();
    if (cat) {
      categoryFreq[cat] = (categoryFreq[cat] || 0) + 1;
    }
  }

  const sortedCategories = Object.entries(categoryFreq).sort((a, b) => b[1] - a[1]);

  console.log('\n[generate-categories] Existing category frequency:');
  if (sortedCategories.length === 0) {
    console.log('  (no categories found — all transactions may be uncategorized)');
  } else {
    for (const [cat, count] of sortedCategories) {
      console.log(`  ${cat}: ${count}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Extract up to 50 sample motive descriptions for the LLM prompt
  // ──────────────────────────────────────────────────────────────────────────
  const seenMotives = new Set<string>();
  const sampleMotives: string[] = [];
  for (const tx of transactions) {
    const m = tx.motive.trim();
    if (m && !seenMotives.has(m)) {
      seenMotives.add(m);
      sampleMotives.push(m);
      if (sampleMotives.length >= 50) break;
    }
  }
  console.log(`\n[generate-categories] Sample motives (${sampleMotives.length}):`);
  console.log(sampleMotives.map(m => `  - ${m}`).join('\n'));

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Instantiate LLM client (Z.ai primary, Groq fallback)
  // ──────────────────────────────────────────────────────────────────────────
  let llmClient: OpenAI;
  let model: string;

  if (process.env.ZAI_API_KEY) {
    console.log('\n[generate-categories] Using Z.ai (primary LLM)');
    llmClient = new OpenAI({
      apiKey: process.env.ZAI_API_KEY,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    });
    model = 'GLM-4-Flash';
  } else if (process.env.GROQ_API_KEY) {
    console.log('\n[generate-categories] Using Groq (fallback LLM — ZAI_API_KEY not set)');
    llmClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1/',
    });
    model = 'llama-3.3-70b-versatile';
  } else {
    throw new Error(
      'No LLM API key found. Set ZAI_API_KEY (primary) or GROQ_API_KEY (fallback) in .env'
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Call LLM to suggest 12 categories
  // ──────────────────────────────────────────────────────────────────────────
  const systemPrompt = `You are a personal finance assistant. Your task is to suggest expense category names.`;

  const userContent =
    `Given these transaction descriptions from a personal expense tracker, suggest a final list of ` +
    `exactly 12 expense category names (in English, title case, single words or short phrases). ` +
    `The categories must collectively cover all spending patterns visible in the data. ` +
    `Include 'Uncategorized' as the last entry. ` +
    `Respond ONLY with JSON: { "categories": ["...", ...] }\n\n` +
    `Transaction descriptions:\n${sampleMotives.join('\n')}`;

  console.log('\n[generate-categories] Calling LLM for category suggestions...');

  let rawContent: string;
  try {
    const completion = await llmClient.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });
    rawContent = completion.choices[0].message.content || '{}';
  } catch (err) {
    console.error('[generate-categories] LLM call failed:', err instanceof Error ? err.message : String(err));
    throw err;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Parse and validate LLM response
  // ──────────────────────────────────────────────────────────────────────────
  let categories: string[];
  try {
    // Strip markdown code blocks if present
    let jsonStr = rawContent;
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr);
    if (!parsed.categories || !Array.isArray(parsed.categories)) {
      throw new Error('Response missing "categories" array');
    }
    categories = parsed.categories as string[];
  } catch (err) {
    console.error('[generate-categories] Failed to parse LLM response:', rawContent);
    throw new Error(`LLM response parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Ensure exactly 12 entries with 'Uncategorized' last
  // ──────────────────────────────────────────────────────────────────────────
  // Remove 'Uncategorized' from wherever the LLM placed it, then re-add at end
  categories = categories.filter(c => c !== 'Uncategorized');

  if (categories.length > 11) {
    categories = categories.slice(0, 11);
  } else while (categories.length < 11) {
    categories.push(`Category${categories.length + 1}`);
  }

  categories.push('Uncategorized');
  // categories is now exactly 12 entries with 'Uncategorized' last

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Print final list and ready-to-copy TypeScript block
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[generate-categories] Suggested categories:');
  categories.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));

  const arrayLiteral = categories.map(c => `'${c}'`).join(', ');

  console.log('\n[SCRIPT] Copy this block into src/app/services/llm/constants.ts:\n');
  console.log(`export const EXPENSE_CATEGORIES = [`);
  console.log(`  ${arrayLiteral}`);
  console.log(`] as const;`);
  console.log(`\nexport type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];`);
}

main().catch(err => {
  console.error('[generate-categories] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
