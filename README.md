# Expense Tracker with Siri Integration

A cost-effective expense tracking system that integrates with Siri Shortcuts for natural language expense logging. The system processes voice inputs through Siri and stores transactions in Google Sheets, making expense tracking as simple as talking to your phone.

## Features

- 🗣️ **Natural Language Processing**: Input expenses using plain English through Siri
- 📱 **Siri Shortcuts Integration**: Quick and easy expense logging on iOS devices
- 📊 **Google Sheets Storage**: Free and accessible data storage
- 🤖 **AI-Powered**: Uses OpenAI to understand and categorize your expenses
- 🔄 **Multi-Transaction Support**: Log multiple expenses in a single voice command
- 💰 **Cost Effective**: Uses free tiers of all services

## Architecture

The system consists of three main components:

1. **API Endpoint** (`/api/track-expense`):
   - Receives natural language input from Siri Shortcuts
   - Processes and validates the input
   - Returns structured transaction data

2. **LLM Service**:
   - Parses natural language into structured data
   - Extracts transaction details (motive, amount, type, category)
   - Supports multiple transactions in a single input

3. **Spreadsheet Service**:
   - Handles data persistence in Google Sheets
   - Maintains transaction history
   - Manages categories and metadata

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/track-expense-server.git
   cd track-expense-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```env
   # OpenAI
   OPENAI_API_KEY=your_openai_api_key

   # Google Sheets
   GOOGLE_SHEETS_CLIENT_EMAIL=your_service_account_email
   GOOGLE_SHEETS_PRIVATE_KEY=your_private_key
   GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Siri Shortcut Setup

1. Create a new Shortcut in the Shortcuts app
2. Add "Ask for Input" action for voice input
3. Add "Get Contents of URL" action:
   - URL: Your deployed API endpoint
   - Method: POST
   - Request Body: Input from previous step

## API Usage

```bash
# Log a single expense
curl -X POST http://your-api/api/track-expense \
  -d "Spent $45 at Trader Joe's for groceries"

# Log multiple expenses
curl -X POST http://your-api/api/track-expense \
  -d "Spent $45 at Trader Joe's and paid $60 for gas at Shell"
```

## Development

The project uses a modular architecture with clear interfaces, making it easy to:
- Mock services for testing
- Swap out LLM providers
- Change storage solutions
- Add new features

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
