import { NextResponse } from 'next/server';
import { LLMServiceFactory } from '@/app/services/llm/factory';
import { SpreadsheetServiceFactory } from '@/app/services/spreadsheet/factory';
import { InvalidInputError } from '@/app/services/llm/types';
import { SpreadsheetWriteError } from '@/app/services/spreadsheet/types';

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
      const parsedData = await llmService.parseExpense(transaction);
      await spreadsheetService.writeExpense(parsedData);

      return NextResponse.json(
        { 
          message: `${parsedData.type} logged successfully`,
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