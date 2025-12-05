import OpenAI from "openai";

export type ModelType = 'gemini' | 'openai' | 'perplexity' | 'claude' | 'openrouter' | 'custom';

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
    modelId?: string,
    images?: string[] // Base64 encoded images
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
            return await sendToGemini(apiKey, history, newMessage, context, memoryContext, modelId, images);
        } else if (model === 'openai') {
            return await sendToOpenAI(apiKey, history, newMessage, context, memoryContext, modelId, images);
        } else if (model === 'claude') {
            return await sendToClaude(apiKey, history, newMessage, context, memoryContext, modelId, images);
        } else if (model === 'perplexity') {
            return await sendToPerplexity(apiKey, history, newMessage, context, memoryContext, modelId);
        } else if (model === 'openrouter') {
            return await sendToOpenRouter(apiKey, history, newMessage, context, memoryContext, modelId, images);
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
You are an advanced, autonomous browser agent and a helpful AI assistant.
Your goal is to understand the user's intent and fulfill it efficiently using the available browser actions.

**Core Instructions:**

1.  **Understand Intent:**
    *   **Casual Chat:** For greetings or questions, use \`response\` field. No browser action needed.
    *   **Browser Tasks:** For "search", "click", "go to", "fill", etc., use an \`action\`.

2.  **Read the Page Context:**
    You receive [Current Page Context] with:
    - **URL:** Where you are now.
    - **Interactive Elements:** A list of buttons, inputs, links on the page WITH their selectors.
    
    **USE THIS LIST** to find the right element to interact with. Don't guess selectors - look at what's available!

3.  **Action Result Feedback:**
    *   **✅ SUCCESS:** Proceed to next step.
    *   **❌/⚠️ FAILURE:** Your action failed. Look at the Interactive Elements list again and try a different selector.

4.  **Smart Search Strategies:**
    *   **For Google/Bing:** Use \`{ "action": "search", "query": "..." }\` - it's the most reliable.
    *   **For other sites:** 
        1. Find the search input in Interactive Elements
        2. Use \`type\` to enter text
        3. Look for a submit button (labels like "Search", "Go", "Submit", "Find", "🔍", etc.) and \`click\` it
        4. OR use \`press_key\` with "enter" if no button is visible

5.  **Finding Elements:**
    Look at the Interactive Elements list. Examples:
    - \`[button] Selector: #search-btn | Label: "Search"\` → Click with \`{ "action": "click", "selector": "#search-btn" }\`
    - \`[input type="text"] Selector: input[name="q"] | Label: "Search..."\` → Type with \`{ "action": "type", "selector": "input[name='q']", "text": "query" }\`
    - \`[a] Selector: .nav-link | Label: "Home"\` → Click to navigate

6.  **Output Format (JSON only):**
    *   \`thought\`: Your reasoning
    *   \`action\`: Browser action object (optional)
    *   \`response\`: Text reply to user (optional)

**Supported Actions:**
- \`{ "action": "search", "query": "..." }\` - Direct Google search (most reliable for search engines)
- \`{ "action": "navigate", "url": "..." }\` - Go to URL
- \`{ "action": "click", "selector": "..." }\` - Click element
- \`{ "action": "type", "selector": "...", "text": "..." }\` - Type in input
- \`{ "action": "press_key", "key": "enter|tab|escape" }\` - Press keyboard key
- \`{ "action": "type_and_submit", "selector": "...", "text": "..." }\` - Type and press Enter
- \`{ "action": "set_reminder", "seconds": N, "message": "..." }\` - Set a timer
- \`{ "action": "scroll", "direction": "up|down|top|bottom" }\`
- \`{ "action": "new_tab", "url": "..." }\`
- \`{ "action": "switch_tab", "tabId": N }\`
- \`{ "action": "close_tab", "tabId": N }\`

**Examples:**

User: "Remind me to take a break in 2 minutes"
Response:
{ "thought": "Setting a reminder for 2 minutes (120 seconds).", "action": { "action": "set_reminder", "seconds": 120, "message": "Take a break" } }

`;

async function sendToGemini(apiKey: string, history: ChatMessage[], newMessage: string, context?: BrowserContext, memoryContext: string = "", modelId: string = "gemini-2.0-flash", images?: string[]): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    // Prepare contents
    const contents: any[] = [];

    // 1. Add History
    // Gemini expects: { role: "user" | "model", parts: [{ text: "..." }] }
    // We need to merge consecutive messages of the same role if necessary, but simple mapping usually works if roles alternate.
    // However, the system prompt is passed separately in 'systemInstruction'.
    for (const msg of history) {
        contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        });
    }

    // 2. Add the new user message with context
    let contextString = "";
    if (context) {
        contextString = `\n\n[Current Page Context]\nTitle: ${context.title}\nURL: ${context.url}\nContent: ${context.content.substring(0, 15000)}...`;
        if (context.openTabs && context.openTabs.length > 0) {
            contextString += `\n\n[Open Tabs]\n${context.openTabs.map(t => `- ID: ${t.id}, Title: "${t.title}", URL: ${t.url}`).join('\n')}`;
        }
    }
    const finalUserMessage = newMessage + contextString;

    // Check if last message in history was 'user' to avoid consecutive user messages (shouldn't happen if history is correct, but just in case)
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents.push({
            role: 'user',
            parts: [{ text: finalUserMessage }]
        });
    } else {
        contents.push({
            role: 'user',
            parts: [{ text: finalUserMessage }]
        });
    }

    // Handle User-uploaded Images
    if (images && images.length > 0) {
        const lastMsg = contents[contents.length - 1];
        for (const img of images) {
            try {
                const base64Data = img.split(',')[1];
                const mimeType = img.split(';')[0].split(':')[1] || 'image/jpeg';
                if (base64Data) {
                    lastMsg.parts.push({
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data
                        }
                    });
                }
            } catch (e) {
                console.error("Error processing uploaded image for Gemini:", e);
            }
        }
    }

    // Handle Screenshot (Multimodal)
    if (context?.screenshot) {
        // Attach to the last user message (which is the one we just added)
        const lastMsg = contents[contents.length - 1];
        try {
            const base64Data = context.screenshot.split(',')[1];
            if (base64Data) {
                lastMsg.parts.push({
                    inline_data: {
                        mime_type: "image/png",
                        data: base64Data
                    }
                });
            }
        } catch (e) {
            console.error("Error processing screenshot for Gemini:", e);
        }
    }

    const payload = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT + memoryContext }]
        },
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: "application/json" // Force JSON output
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gemini API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();

        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else {
            return "{}"; // Empty JSON if no response
        }

    } catch (error: any) {
        console.error("Gemini Fetch Error:", error);
        throw error;
    }
}

async function sendToOpenAI(apiKey: string, history: ChatMessage[], newMessage: string, context?: BrowserContext, memoryContext: string = "", modelId: string = "gpt-4o", images?: string[]): Promise<string> {
    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://api.openai.com/v1',
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

    // Add user-uploaded images
    if (images && images.length > 0) {
        for (const img of images) {
            currentContent.push({
                type: "image_url",
                image_url: {
                    url: img
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
        response_format: { type: "json_object" }
    });

    return completion.choices[0].message.content || "{}";
}

async function sendToClaude(apiKey: string, history: ChatMessage[], newMessage: string, context?: BrowserContext, memoryContext: string = "", modelId: string = "claude-3-5-sonnet-20240620", images?: string[]): Promise<string> {
    const alternatingHistory: { role: 'user' | 'assistant'; content: string }[] = [];
    const cleanHistory = history.filter(msg => msg.content && msg.content.trim() !== '');

    if (cleanHistory.length > 0) {
        let lastRole: 'user' | 'assistant' = cleanHistory[0].role === 'user' ? 'user' : 'assistant';
        let currentContent = cleanHistory[0].content;

        for (let i = 1; i < cleanHistory.length; i++) {
            const msg = cleanHistory[i];
            const role: 'user' | 'assistant' = msg.role === 'user' ? 'user' : 'assistant';

            if (role === lastRole) {
                currentContent += "\n\n" + msg.content;
            } else {
                alternatingHistory.push({ role: lastRole, content: currentContent });
                lastRole = role;
                currentContent = msg.content;
            }
        }
        alternatingHistory.push({ role: lastRole, content: currentContent });
    }

    const messages = alternatingHistory.map(msg => ({
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

    // Add user-uploaded images
    if (images && images.length > 0) {
        for (const img of images) {
            try {
                const base64Data = img.split(',')[1];
                const mimeType = img.split(';')[0].split(':')[1] || 'image/jpeg';
                currentContent.push({
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: mimeType,
                        data: base64Data
                    }
                });
            } catch (e) {
                console.error("Error processing image for Claude:", e);
            }
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
    context?: BrowserContext,
    memoryContext: string = "",
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

    // Prepare Context String
    let contextText = "";
    if (context) {
        contextText = `\n\n[Current Page Context]\nTitle: ${context.title}\nURL: ${context.url}\nContent: ${context.content.substring(0, 15000)}...`;
        if (context.openTabs && context.openTabs.length > 0) {
            contextText += `\n\n[Open Tabs]\n${context.openTabs.map(t => `- ID: ${t.id}, Title: "${t.title}", URL: ${t.url}`).join('\n')}`;
        }
    }

    let messages;
    // Check if the last message in history is from 'user'
    if (alternatingHistory.length > 0 && alternatingHistory[alternatingHistory.length - 1].role === 'user') {
        // Merge the new message AND context into the last user message
        const lastMsg = alternatingHistory.pop()!;
        messages = [
            { role: 'system', content: SYSTEM_PROMPT + memoryContext },
            ...alternatingHistory,
            { role: 'user', content: lastMsg.content + "\n\n" + message + contextText }
        ];
    } else {
        messages = [
            { role: 'system', content: SYSTEM_PROMPT + memoryContext },
            ...alternatingHistory,
            { role: 'user', content: message + contextText }
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



// OpenRouter API (Unified access to many models)
async function sendToOpenRouter(apiKey: string, history: ChatMessage[], newMessage: string, context?: BrowserContext, memoryContext: string = "", modelId: string = "openai/gpt-4o", images?: string[]): Promise<string> {
    let contextString = "";
    if (context) {
        contextString = `

[Current Page Context]
Title: ${context.title}
URL: ${context.url}
Content: ${context.content.substring(0, 15000)}...`;
        if (context.openTabs && context.openTabs.length > 0) {
            contextString += `

[Open Tabs]
${context.openTabs.map(t => `- ID: ${t.id}, Title: "${t.title}", URL: ${t.url}`).join("\n")}`;
        }
    }

    // Build user message content (text + images if any)
    let userContent: any = newMessage + contextString;

    if (images && images.length > 0) {
        userContent = [
            { type: "text", text: newMessage + contextString },
            ...images.map(img => ({
                type: "image_url",
                image_url: { url: img }
            }))
        ];
    }

    const messages = [
        { role: "system", content: SYSTEM_PROMPT + memoryContext },
        ...history.map(msg => ({ role: msg.role, content: msg.content })),
        { role: "user", content: userContent }
    ];

    console.log("OpenRouter Request:", { model: modelId, messagesCount: messages.length });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/TrixCoder/multiai_extension",
            "X-Title": "MultiModal Browser Agent"
        },
        body: JSON.stringify({
            model: modelId,
            messages: messages
        })
    });

    if (!response.ok) {
        const errorData = await response.text();
        console.error("OpenRouter Error:", response.status, errorData);
        throw new Error(`OpenRouter API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log("OpenRouter Response:", data);

    return data.choices?.[0]?.message?.content || "{}";
}

