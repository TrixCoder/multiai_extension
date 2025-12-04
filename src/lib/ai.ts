import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

export type ModelType = 'gemini' | 'openai' | 'perplexity' | 'claude' | 'custom';

export interface BrowserContext {
    title: string;
    url: string;
    content: string;
    screenshot?: string;
    openTabs?: { id: number; title: string; url: string }[];
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface MemoryItem {
    key: string;
    value: string;
}

export async function sendMessage(
    model: ModelType,
    apiKey: string,
    history: ChatMessage[],
    newMessage: string,
    context?: BrowserContext,
    customConfig?: { baseUrl: string; modelName: string },
    memory?: MemoryItem[],
    modelId?: string
): Promise<string> {
    if (!apiKey) {
        throw new Error("API Key is missing. Please set it in settings.");
    }

    // Inject memory into system prompt or context
    let memoryContext = "";
    if (memory && memory.length > 0) {
        memoryContext = `\n\n[User Memory]\nThe user has provided the following context/preferences to remember:\n${memory.map(m => `- ${m.key}: ${m.value}`).join('\n')}\n`;
    }

    try {
        if (model === 'gemini') {
            return await sendToGemini(apiKey, history, newMessage, context, memoryContext, modelId);
        } else if (model === 'openai') {
            return await sendToOpenAI(apiKey, history, newMessage, context, memoryContext, modelId);
        } else if (model === 'claude') {
            return await sendToClaude(apiKey, history, newMessage, context, memoryContext, modelId);
        } else if (model === 'perplexity') {
            return await sendToPerplexity(apiKey, history, newMessage, modelId);
        } else if (model === 'custom') {
            return await sendToCustom(apiKey, customConfig?.baseUrl || '', customConfig?.modelName || '', history, newMessage, context, memoryContext);
        }
        throw new Error('Unsupported model');
    } catch (error: any) {
        console.error("AI Error:", error);
        return `Error: ${error.message || "Something went wrong."}`;
    }
}

const SYSTEM_PROMPT = `
You are an advanced autonomous browser agent. Your goal is to help the user by browsing the web, researching, and performing actions.

**Core Instructions:**
1.  **Analyze Intent First:** Determine if the user wants to:
    *   **Interact with the current page** (e.g., "click login", "summarize this"). -> **PRIORITY: HIGH**. Use [Current Page Context].
    *   **Navigate/Search** (e.g., "open google", "search for X"). -> Perform the first navigation/search step.
    *   **Ask a General Question** (e.g., "explain AI"). -> Answer directly in the "thought" field.

2.  **Prioritize Context:** ALWAYS check the [Current Page Context] (URL, Title, Content) before deciding. If the user asks "what is this?", refer to the current page.

3.  **Chain of Thought (CoT):** Plan your actions step-by-step.
    *   If the user says "search how to code on google" and you are ALREADY on google.com, DO NOT navigate again. Just fill the search box.
    *   If you are NOT on google.com, first action is \`navigate\` to google.com.

**Output Format:**
You must output your response in a strict JSON format.
- \`thought\`: Your reasoning. Explain WHY you are taking this action or giving this answer.
- \`action\`: The action object (if performing an action).
- \`response\`: The answer text (if answering a question).

**Goal:**
- **Efficiency is Key.** Do not perform unnecessary navigations if the user is already on the correct page.
- If the user asks a compound request, perform the **first necessary action** only.

**Supported Actions (Output as JSON):**
- { "action": "click", "selector": "css_selector" }
- { "action": "type", "selector": "css_selector", "text": "text_to_type" }
- { "action": "scroll", "direction": "up" | "down" | "top" | "bottom" }
- { "action": "navigate", "url": "https://..." }
- { "action": "search", "query": "search_query" } (Use this for direct address bar search)
- { "action": "new_tab", "url": "https://..." }
- { "action": "switch_tab", "tabId": 123 }
- { "action": "ask_selection", "question": "Clarification question", "options": [{ "label": "Option A", "value": "id_a" }] }
- { "action": "close_tab", "tabId": 123 }
- { "action": "get_tab_content", "tabId": 123 }

**Important:**
- **ALWAYS** output a valid JSON object.
- **DO NOT** include any text outside the JSON object. No conversational filler.
- If you are answering a question, put the answer in the "thought" or "response" field of the JSON.
- **Check the URL** in [Current Page Context] before navigating.
`;

async function sendToGemini(apiKey: string, history: ChatMessage[], newMessage: string, context?: BrowserContext, memoryContext: string = "", modelId: string = "gemini-2.0-flash"): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: SYSTEM_PROMPT + memoryContext
    });

    // Filter and map history to ensure valid Content objects
    const validHistory = history.map(msg => {
        const parts: any[] = [];

        if (msg.content && msg.content.trim() !== '') {
            parts.push({ text: msg.content });
        }

        // Gemini does not support base64 images in history efficiently yet.
        // We filter out empty messages to prevent API errors.

        if (parts.length === 0) {
            return null; // Filter out empty messages
        }

        return {
            role: msg.role === 'user' ? 'user' : 'model',
            parts: parts,
        };
    }).filter(msg => msg !== null) as { role: string, parts: any[] }[];

    const chat = model.startChat({
        history: validHistory,
    });

    let promptParts: any[] = [];

    if (newMessage && newMessage.trim() !== '') {
        promptParts.push({ text: newMessage });
    }

    if (context) {
        let contextMsg = `\n\n[Current Page Context]\nTitle: ${context.title}\nURL: ${context.url}\nContent: ${context.content.substring(0, 20000)}...`; // Increased limit

        if (context.openTabs && context.openTabs.length > 0) {
            contextMsg += `\n\n[Open Tabs]\n${context.openTabs.map(t => `- ID: ${t.id}, Title: "${t.title}", URL: ${t.url}`).join('\n')}`;
        }

        promptParts.push({ text: contextMsg });

        if (context.screenshot) {
            try {
                const base64Data = context.screenshot.split(',')[1];
                if (base64Data) {
                    promptParts.push({
                        inlineData: {
                            mimeType: "image/png",
                            data: base64Data
                        }
                    });
                }
            } catch (e) {
                console.error("Error processing screenshot:", e);
            }
        }
    }

    // Ensure promptParts is not empty
    if (promptParts.length === 0) {
        promptParts.push({ text: "..." });
    }

    const result = await chat.sendMessage(promptParts);
    const response = await result.response;
    return response.text();
}

async function sendToOpenAI(apiKey: string, history: ChatMessage[], newMessage: string, context?: BrowserContext, memoryContext: string = "", modelId: string = "gpt-4o"): Promise<string> {
    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://api.openai.com/v1', // Explicitly set latest API URL
        dangerouslyAllowBrowser: true
    });

    const messages: any[] = [
        { role: "system", content: SYSTEM_PROMPT + memoryContext },
        ...history.map(msg => ({
            role: msg.role,
            content: msg.content
        }))
    ];

    let currentContent: any[] = [{ type: "text", text: newMessage }];

    if (context) {
        let contextText = `\n\n[Current Page Context]\nTitle: ${context.title}\nURL: ${context.url}\nContent: ${context.content.substring(0, 15000)}...`;

        if (context.openTabs && context.openTabs.length > 0) {
            contextText += `\n\n[Open Tabs]\n${context.openTabs.map(t => `- ID: ${t.id}, Title: "${t.title}", URL: ${t.url}`).join('\n')}`;
        }

        currentContent.push({ type: "text", text: contextText });

        if (context.screenshot) {
            currentContent.push({
                type: "image_url",
                image_url: {
                    url: context.screenshot
                }
            });
        }
    }

    messages.push({
        role: "user",
        content: currentContent
    });

    const completion = await openai.chat.completions.create({
        messages: messages,
        model: modelId,
        response_format: { type: "json_object" } // Force JSON for better agentic behavior
    });

    return completion.choices[0].message.content || "{}";
}

async function sendToClaude(apiKey: string, history: ChatMessage[], newMessage: string, context?: BrowserContext, memoryContext: string = "", modelId: string = "claude-3-5-sonnet-20240620"): Promise<string> {
    // Anthropic API Direct Call
    const messages = history.map(msg => ({
        role: msg.role,
        content: msg.content
    }));

    let currentContent: any[] = [{ type: "text", text: newMessage }];

    if (context) {
        let contextText = `\n\n[Current Page Context]\nTitle: ${context.title}\nURL: ${context.url}\nContent: ${context.content.substring(0, 20000)}...`;

        if (context.openTabs && context.openTabs.length > 0) {
            contextText += `\n\n[Open Tabs]\n${context.openTabs.map(t => `- ID: ${t.id}, Title: "${t.title}", URL: ${t.url}`).join('\n')}`;
        }

        currentContent.push({ type: "text", text: contextText });

        if (context.screenshot) {
            const base64Data = context.screenshot.split(',')[1];
            currentContent.push({
                type: "image",
                source: {
                    type: "base64",
                    media_type: "image/png",
                    data: base64Data
                }
            });
        }
    }

    messages.push({
        role: "user",
        content: currentContent as any
    });

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
                "anthropic-dangerously-allow-browser": "true"
            },
            body: JSON.stringify({
                model: modelId,
                max_tokens: 4096,
                system: SYSTEM_PROMPT + memoryContext,
                messages: messages
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || "Failed to fetch from Claude API");
        }

        const data = await response.json();
        return data.content[0].text;
    } catch (error: any) {
        console.error("Claude API Error:", error);
        throw error;
    }
}

async function sendToPerplexity(
    apiKey: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    message: string,
    modelId: string = 'sonar'
): Promise<string> {
    // Filter out empty messages first
    const cleanHistory = history.filter(msg => msg.content && msg.content.trim() !== '');

    // Ensure message alternation (User -> Assistant -> User)
    const alternatingHistory: { role: 'user' | 'assistant'; content: string }[] = [];

    if (cleanHistory.length > 0) {
        let lastRole: 'user' | 'assistant' = cleanHistory[0].role === 'user' ? 'user' : 'assistant';
        let currentContent = cleanHistory[0].content;

        for (let i = 1; i < cleanHistory.length; i++) {
            const msg = cleanHistory[i];
            const role: 'user' | 'assistant' = msg.role === 'user' ? 'user' : 'assistant';

            if (role === lastRole) {
                // Merge consecutive messages of the same role
                currentContent += "\n\n" + msg.content;
            } else {
                alternatingHistory.push({ role: lastRole, content: currentContent });
                lastRole = role;
                currentContent = msg.content;
            }
        }
        // Push the last accumulated message
        alternatingHistory.push({ role: lastRole, content: currentContent });
    }

    // Ensure the conversation history starts with a user message (after system)
    // Perplexity (and others) expect: System -> User -> Assistant -> User ...
    if (alternatingHistory.length > 0 && alternatingHistory[0].role === 'assistant') {
        alternatingHistory.shift();
    }

    let messages;
    // Check if the last message in history is from 'user'
    if (alternatingHistory.length > 0 && alternatingHistory[alternatingHistory.length - 1].role === 'user') {
        // Merge the new message into the last user message to avoid User -> User sequence
        const lastMsg = alternatingHistory.pop()!;
        messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...alternatingHistory,
            { role: 'user', content: lastMsg.content + "\n\n" + message }
        ];
    } else {
        messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...alternatingHistory,
            { role: 'user', content: message }
        ];
    }

    // Perplexity API request
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: modelId,
            messages: messages,
            // Removed extra parameters that might cause issues or empty responses
            // if not supported by specific models.
            // Keeping it simple is safer.
            stream: false
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Perplexity API Error:", response.status, errorData);
        throw new Error(`Perplexity API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.debug("Perplexity Response:", JSON.stringify(data, null, 2));

    // Check for empty content which can happen with Perplexity
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
        console.error("Perplexity API returned empty content:", data);
        throw new Error("Perplexity API returned an empty response. Please try again or check your API key.");
    }

    const content = data.choices[0].message.content;
    console.debug("Perplexity Content:", content);
    return content;
}

async function sendToCustom(apiKey: string, baseUrl: string, modelName: string, history: ChatMessage[], newMessage: string, context?: BrowserContext, memoryContext: string = ""): Promise<string> {
    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseUrl,
        dangerouslyAllowBrowser: true
    });

    const messages: any[] = [
        { role: "system", content: SYSTEM_PROMPT + memoryContext },
        ...history.map(msg => ({
            role: msg.role,
            content: msg.content
        }))
    ];

    let currentContent: any[] = [{ type: "text", text: newMessage }];

    if (context) {
        let contextText = `\n\n[Current Page Context]\nTitle: ${context.title}\nURL: ${context.url}\nContent: ${context.content.substring(0, 10000)}...`;

        if (context.openTabs && context.openTabs.length > 0) {
            contextText += `\n\n[Open Tabs]\n${context.openTabs.map(t => `- ID: ${t.id}, Title: "${t.title}", URL: ${t.url}`).join('\n')}`;
        }

        currentContent.push({ type: "text", text: contextText });

        if (context.screenshot) {
            currentContent.push({
                type: "image_url",
                image_url: {
                    url: context.screenshot
                }
            });
        }
    }

    messages.push({
        role: "user",
        content: currentContent
    });

    const completion = await openai.chat.completions.create({
        messages: messages,
        model: modelName || "gpt-3.5-turbo",
    });

    return completion.choices[0].message.content || "{}";
}

