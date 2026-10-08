import { GoogleSheetsService } from '@/app/services/spreadsheet/google-sheets-service';

const SHEETS_ENV = [
  'GOOGLE_SHEETS_CLIENT_EMAIL',
  'GOOGLE_SHEETS_PRIVATE_KEY',
  'GOOGLE_SHEETS_SPREADSHEET_ID',
];
const sheetsConfigured = SHEETS_ENV.every((k) => !!process.env[k]);
const maybeDescribe = sheetsConfigured ? describe : describe.skip;

maybeDescribe('GoogleSheetsService.readTransactions — real sheet', () => {
  it('round-trips an appended transaction through the read path', async () => {
    // jest.setup points the service at the Test tab, so this is safe to write.
    const service = new GoogleSheetsService();
    const motive = `read-path integration ${Date.now()}`;

    await service.appendTransaction([
      { motive, amount: 12.34, type: 'Expense', category: 'Groceries' },
    ]);

    const transactions = await service.readTransactions();
    const found = transactions.find((t) => t.motive === motive);

    expect(found).toBeDefined();
    expect(found!.amount).toBe(12.34);
    expect(found!.type).toBe('Expense');
    expect(found!.category).toBe('Groceries');
    expect(found!.date).toBeInstanceOf(Date);
    // Appended just now with the sheet's wall-clock timestamp; the parsed
    // date should land within a day of now regardless of timezone offset.
    expect(Math.abs(found!.date.getTime() - Date.now())).toBeLessThan(
      86_400_000
    );
  });
});
