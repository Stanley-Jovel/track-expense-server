import { NextResponse } from 'next/server';
import { LLMServiceFactory, InvalidInputError } from '@/app/services/llm';
import { SpreadsheetServiceFactory, SpreadsheetWriteError, DuplicateRequestError } from '@/app/services/spreadsheet';
import { EXPENSE_CATEGORIES } from '@/app/services/llm/constants';

export async function POST(request: Request) {
  try {
    const body: { transaction: string } = await request.json();
    const transaction = body.transaction;

    if (!transaction) {
      return NextResponse.json(
        { message: 'No input provided' },
        { status: 400 }
      );
    }

    const requestId = request.headers.get('X-Request-ID') ?? crypto.randomUUID();

    const llmService = process.env.NODE_ENV === 'test'
      ? LLMServiceFactory.create('mock')
      : LLMServiceFactory.createWithFallbacks();
    const spreadsheetService = SpreadsheetServiceFactory.create(
        process.env.NODE_ENV === 'test' ? 'mock' : 'production'
    );

    try {
      const parsedData = await llmService.parseTransaction(transaction);

      const validatedData = parsedData.map(tx => {
        if (!EXPENSE_CATEGORIES.includes(tx.category as typeof EXPENSE_CATEGORIES[number])) {
          console.warn(`[API] Unknown category "${tx.category}" for transaction "${tx.motive}". Falling back to Uncategorized.`);
          return { ...tx, category: 'Uncategorized' };
        }
        return tx;
      });

      await spreadsheetService.appendTransaction(validatedData, requestId);

      const summary = validatedData
        .map(t => `${t.type === 'Expense' ? 'Spent' : 'Received'} ${t.amount} for ${t.motive}`)
        .join('\n');

      return NextResponse.json(
        {
          message: summary,
          data: validatedData
        },
        { status: 200 }
      );
    } catch (error) {
      if (error instanceof DuplicateRequestError) {
        return NextResponse.json(
          { message: 'Duplicate request: expense already logged' },
          { status: 409 }
        );
      }
      if (error instanceof InvalidInputError) {
        console.warn(`[API] Failed to parse transaction: "${transaction.slice(0, 100)}". Logging as Uncategorized.`);
        const fallbackTx = {
          motive: transaction.slice(0, 500),
          amount: 0,
          type: 'Expense' as const,
          category: 'Uncategorized',
        };
        try {
          await spreadsheetService.appendTransaction([fallbackTx], requestId);
          return NextResponse.json(
            { message: 'Could not parse expense details. Logged as Uncategorized for manual review.' },
            { status: 200 }
          );
        } catch (sheetError) {
          console.error('[API] Failed to log Uncategorized fallback:', sheetError);
          return NextResponse.json(
            { message: 'Failed to log expense' },
            { status: 500 }
          );
        }
      }
      if (error instanceof SpreadsheetWriteError) {
        return NextResponse.json(
          { message: 'Failed to log expense' },
          { status: 500 }
        );
      }
      throw error; // Re-throw unexpected errors
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
