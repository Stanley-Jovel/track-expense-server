import { NextResponse } from 'next/server';
import { LLMServiceFactory, InvalidInputError } from '@/app/services/llm';
import { SpreadsheetServiceFactory, SpreadsheetWriteError } from '@/app/services/spreadsheet';

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

    const llmService = LLMServiceFactory.create(
      process.env.NODE_ENV === 'test' ? 'mock' : 'production'
    );
    const spreadsheetService = SpreadsheetServiceFactory.create(
        process.env.NODE_ENV === 'test' ? 'mock' : 'production'
    );

    try {
      const parsedData = await llmService.parseTransaction(transaction);
      await spreadsheetService.appendTransaction(parsedData);

      const summary = parsedData
        .map(t => `${t.type === 'Expense' ? 'Spent' : 'Received'} ${t.amount} for ${t.motive}`)
        .join('\n');

      return NextResponse.json(
        { 
          message: summary,
          data: parsedData
        },
        { status: 200 }
      );
    } catch (error) {
      if (error instanceof InvalidInputError) {
        return NextResponse.json(
          { message: error.message },
          { status: 400 }
        );
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