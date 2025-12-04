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

## Usage

1.  Click the extension icon in your browser toolbar.
2.  Open the **Settings** (gear icon) and enter your API keys for the models you wish to use.
3.  Start chatting! You can ask general questions or give commands like "open google and search for AI news".

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
