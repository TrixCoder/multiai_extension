# MultiModal Browser Agent

An advanced autonomous browser agent extension built with React, TypeScript, and Vite. This extension leverages powerful AI models (Gemini, OpenAI, Claude, Perplexity) to help users browse the web, research topics, and perform actions directly within the browser.

## Features

-   **Multi-Model Support:** Choose from Gemini, OpenAI (GPT-4o), Claude 3.5 Sonnet, and Perplexity.
-   **Context Awareness:** The AI can read the current tab's content, URL, and title to provide context-aware assistance.
-   **Browser Automation:** Capable of navigating, searching, clicking, and typing to automate web tasks.
-   **Memory:** Remembers user preferences and key details across sessions.
-   **Chat Interface:** A clean, modern chat interface with history support.
-   **Secure:** API keys are stored locally in your browser.

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/multimodal-browser.git
    cd multimodal-browser
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Build the extension:
    ```bash
    npm run build
    ```

4.  Load into Chrome:
    -   Open `chrome://extensions/`
    -   Enable "Developer mode" (top right).
    -   Click "Load unpacked".
    -   Select the `dist` folder in this project.

## API Key Setup

To use the extension, you'll need API keys for the AI models you want to use. Here is a guide on how to get them:

### 1. Google Gemini (Free Tier Available)
Gemini offers a generous free tier for their API.
1.  Go to [Google AI Studio](https://aistudio.google.com/).
2.  Sign in with your Google account.
3.  Click on the **"Get API key"** button in the top left.
4.  Click **"Create API key in new project"**.
5.  Copy the generated key.

### 2. Perplexity AI (Paid / Pro Credit)
Perplexity API is generally a paid service (pay-as-you-go), but Pro subscribers get monthly credits.
1.  Go to the [Perplexity API Settings](https://www.perplexity.ai/settings/api).
2.  You will need to add a payment method to your account to enable API access.
3.  Once a payment method is added (or if you have Pro credits), click **"Generate"** to create a new API key.
4.  *Note: Perplexity Pro users currently receive $5/month in API credits.*

### 3. OpenAI (Paid)
OpenAI requires a paid account with credits.
1.  Go to the [OpenAI Platform](https://platform.openai.com/api-keys).
2.  Sign up or log in.
3.  Go to **Settings > Billing** and add credits to your account.
4.  Go to **API Keys** and click **"Create new secret key"**.
5.  Copy the key immediately (you won't be able to see it again).

### 4. Anthropic Claude (Paid)
Anthropic also operates on a pre-paid credit system.
1.  Go to the [Anthropic Console](https://console.anthropic.com/).
2.  Sign up or log in.
3.  Go to **Settings > Plans & Billing** to add funds.
4.  Go to **"Get API Keys"** and click **"Create Key"**.

## Usage

1.  Click the extension icon in your browser toolbar.
2.  Open the **Settings** (gear icon) and enter your API keys for the models you wish to use.
3.  Start chatting! You can ask general questions or give commands like "open google and search for AI news".

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
