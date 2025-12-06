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

export interface Attachment {
    type: 'image' | 'text' | 'file';
    content: string; // Base64 for images, text content for files
    name: string;
    mimeType?: string;
}

export async function sendMessage(
    model: ModelType,
    apiKey: string,
    history: ChatMessage[],
    newMessage: string,
    context?: BrowserContext,
    customConfig?: { baseUrl: string; modelName: string; temperature?: number; systemPrompt?: string },
    memory?: MemoryItem[],
    modelId?: string,
    attachments?: Attachment[]
): Promise<string> {
    if (!apiKey) {
        throw new Error("API Key is missing. Please set it in settings.");
    }

    // Intent Detection for Image Generation
    const imageGenerationRegex = /^\/image\s+(.*)$/i;
    const imageMatch = newMessage.match(imageGenerationRegex);

    // Also check for natural language intent if model supports it (optional, but slash command is safer for now)
    // For now, we'll stick to the slash command or explicit keywords if we want to expand later.

    if (imageMatch) {
        const imagePrompt = imageMatch[1];
        if (!imagePrompt) {
            return "Please provide a prompt for the image. Usage: `/image <description>`";
        }
        return await generateImage(apiKey, imagePrompt, model);
    }

    // Inject memory into system prompt or context
    let memoryContext = "";
    if (memory && memory.length > 0) {
        memoryContext = `\n\n[User Memory]\nThe user has provided the following context/preferences to remember:\n${memory.map(m => `- ${m.key}: ${m.value}`).join('\n')}\n`;
    }

    try {
        if (model === 'gemini') {
            return await sendToGemini(apiKey, history, newMessage, context, memoryContext, modelId, attachments);
        } else if (model === 'openai') {
            return await sendToOpenAI(apiKey, history, newMessage, context, memoryContext, modelId, attachments);
        } else if (model === 'claude') {
            return await sendToClaude(apiKey, history, newMessage, context, memoryContext, modelId, attachments);
        } else if (model === 'perplexity') {
            return await sendToPerplexity(apiKey, history, newMessage, context, memoryContext, modelId, attachments);
        } else if (model === 'openrouter') {
            return await sendToOpenRouter(apiKey, history, newMessage, context, memoryContext, modelId, attachments);
        } else if (model === 'custom') {
            return await sendToCustom(apiKey, customConfig?.baseUrl || '', customConfig?.modelName || '', history, newMessage, context, memoryContext, attachments, customConfig?.temperature, customConfig?.systemPrompt);
        }
        throw new Error('Unsupported model');
    } catch (error: any) {
        console.error("AI Error:", error);
        return `Error: ${error.message || "Something went wrong."}`;
    }
}

async function generateImage(apiKey: string, prompt: string, model: ModelType): Promise<string> {
    // Currently only supporting OpenAI DALL-E 3 for image generation
    if (model === 'openai' || model === 'openrouter') { // OpenRouter might support it too, but let's default to OpenAI direct for now or handle specific OpenRouter models if needed.
        // For OpenRouter, we might need a specific model ID. For now, let's assume OpenAI key is used for DALL-E 3.
        // If the user is using OpenRouter, they might not have a direct OpenAI key. 
        // Let's try to use the provided key with OpenAI endpoint if model is 'openai'.

        if (model === 'openai') {
            return await generateImageOpenAI(apiKey, prompt);
        }
    }

    return "Image generation is currently only supported for OpenAI (DALL-E 3). Please switch to OpenAI model to use this feature.";
}

async function generateImageOpenAI(apiKey: string, prompt: string): Promise<string> {
    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://api.openai.com/v1',
        dangerouslyAllowBrowser: true
    });

    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            response_format: "url" // or "b64_json"
        });

        if (!response.data || response.data.length === 0 || !response.data[0].url) {
            throw new Error("No image URL returned from OpenAI.");
        }

        const imageUrl = response.data[0].url;
        return `![Generated Image](${imageUrl})`;
    } catch (error: any) {
        console.error("Image Generation Error:", error);
        return `Failed to generate image: ${error.message}`;
    }
}

const SYSTEM_PROMPT = `
You are an autonomous browser agent. You MUST respond ONLY in valid JSON format.

**🚨 MESSAGE PRIORITY RULES:**
Focus on the user's LATEST message. Use conversation history ONLY when:
- User says "do that again", "continue", "same thing", "like before", etc.
- User references something by "it", "that", "the same" without specifying what
- Current action is a follow-up step to a multi-step task in progress

Otherwise, treat each new message as a FRESH, independent request. Don't mix topics.

**CRITICAL ANTI-HALLUCINATION RULES:**
1. NEVER claim you did something unless you see "Action Result: ✅ SUCCESS" in history.
2. NEVER invent page content. ONLY use the [Current Page Context] provided.
3. NEVER respond about topics the user didn't ask about in their CURRENT message.
4. If context capture failed, tell the user - don't guess what's on the page.
5. Don't bring up unrelated previous topics unless user explicitly references them.

**UNDERSTANDING USER INTENT (for CURRENT message only):**
- "Open X and do Y" = First navigate to X, THEN do Y after seeing the new page
- "Search for X" = Use the search ACTION (browser), don't answer from memory
- "Open a new tab and..." = Use new_tab action first
- Multi-step requests: do ONE step at a time, wait for page context

**JSON OUTPUT FORMAT (ALWAYS):**
{
  "thought": "Brief reasoning about the CURRENT user request only",
  "action": { ... } OR null,
  "response": "Text based ONLY on actual page content, not training data" OR null
}

**STRICT RULES:**
1. ALWAYS output valid JSON. No markdown, no plain text outside.
2. Browser commands (open, search, navigate, click) = use ACTIONS.
3. NEVER answer news/current events from memory. Use browser to search.
4. After "Action Result: ✅", describe what you ACTUALLY see in context.
5. If the user's new message is unrelated to history, treat it as a fresh start.

**Available Actions:**
- { "action": "search", "query": "..." } - Google search
- { "action": "navigate", "url": "..." } - Go to URL
- { "action": "new_tab", "url": "..." } - Open new tab
- { "action": "click", "selector": "..." } - Click element
- { "action": "type", "selector": "...", "text": "..." } - Type in input
- { "action": "type_and_submit", "selector": "...", "text": "..." } - Type + Enter
- { "action": "scroll", "direction": "up|down|top|bottom" }
- { "action": "switch_tab", "tabId": N } / { "action": "close_tab", "tabId": N }
- { "action": "press_key", "key": "enter|tab|escape" }
- { "action": "set_reminder", "seconds": N, "message": "..." }

**Reading Page Context:**
You receive [Current Page Context] with URL, title, content, and interactive elements.
USE ONLY THIS for your response. Don't invent elements not listed.

REMEMBER: Process ONLY the current message. Output ONLY valid JSON.
`;

async function sendToGemini(apiKey: string, history: ChatMessage[], newMessage: string, context?: BrowserContext, memoryContext: string = "", modelId: string = "gemini-2.0-flash", attachments?: Attachment[]): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    // Prepare contents
    const contents: any[] = [];

    // 1. Add History
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

    // Process text attachments
    let attachmentText = "";
    if (attachments && attachments.length > 0) {
        const textAttachments = attachments.filter(a => a.type === 'text' || a.type === 'file');
        if (textAttachments.length > 0) {
            attachmentText = "\n\n[Attached Files]\n" + textAttachments.map(a => `--- File: ${a.name} ---\n${a.content}\n--- End File ---`).join('\n\n');
        }
    }

    const finalUserMessage = newMessage + contextString + attachmentText;

    // Check if last message in history was 'user' to avoid consecutive user messages
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

    // Handle Image Attachments
    if (attachments && attachments.length > 0) {
        const imageAttachments = attachments.filter(a => a.type === 'image');
        if (imageAttachments.length > 0) {
            const lastMsg = contents[contents.length - 1];
            for (const img of imageAttachments) {
                try {
                    const base64Data = img.content.split(',')[1];
                    const mimeType = img.content.split(';')[0].split(':')[1] || 'image/jpeg';
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
    }

    // Handle Screenshot (Multimodal)
    if (context?.screenshot) {
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

async function sendToOpenAI(apiKey: string, history: ChatMessage[], newMessage: string, context?: BrowserContext, memoryContext: string = "", modelId: string = "gpt-4o", attachments?: Attachment[]): Promise<string> {
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

        // Process text attachments
        if (attachments && attachments.length > 0) {
            const textAttachments = attachments.filter(a => a.type === 'text' || a.type === 'file');
            if (textAttachments.length > 0) {
                contextText += "\n\n[Attached Files]\n" + textAttachments.map(a => `--- File: ${a.name} ---\n${a.content}\n--- End File ---`).join('\n\n');
            }
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
    } else if (attachments && attachments.length > 0) {
        // Handle text attachments even if no context
        const textAttachments = attachments.filter(a => a.type === 'text' || a.type === 'file');
        if (textAttachments.length > 0) {
            const attachmentText = "\n\n[Attached Files]\n" + textAttachments.map(a => `--- File: ${a.name} ---\n${a.content}\n--- End File ---`).join('\n\n');
            currentContent.push({ type: "text", text: attachmentText });
        }
    }

    // Add user-uploaded images
    if (attachments && attachments.length > 0) {
        const imageAttachments = attachments.filter(a => a.type === 'image');
        for (const img of imageAttachments) {
            currentContent.push({
                type: "image_url",
                image_url: {
                    url: img.content
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

async function sendToClaude(apiKey: string, history: ChatMessage[], newMessage: string, context?: BrowserContext, memoryContext: string = "", modelId: string = "claude-3-5-sonnet-20240620", attachments?: Attachment[]): Promise<string> {
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

        // Process text attachments
        if (attachments && attachments.length > 0) {
            const textAttachments = attachments.filter(a => a.type === 'text' || a.type === 'file');
            if (textAttachments.length > 0) {
                contextText += "\n\n[Attached Files]\n" + textAttachments.map(a => `--- File: ${a.name} ---\n${a.content}\n--- End File ---`).join('\n\n');
            }
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
    } else if (attachments && attachments.length > 0) {
        // Handle text attachments even if no context
        const textAttachments = attachments.filter(a => a.type === 'text' || a.type === 'file');
        if (textAttachments.length > 0) {
            const attachmentText = "\n\n[Attached Files]\n" + textAttachments.map(a => `--- File: ${a.name} ---\n${a.content}\n--- End File ---`).join('\n\n');
            currentContent.push({ type: "text", text: attachmentText });
        }
    }

    // Add user-uploaded images
    if (attachments && attachments.length > 0) {
        const imageAttachments = attachments.filter(a => a.type === 'image');
        for (const img of imageAttachments) {
            try {
                const base64Data = img.content.split(',')[1];
                const mimeType = img.content.split(';')[0].split(':')[1] || 'image/jpeg';
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
    modelId: string = 'sonar',
    attachments?: Attachment[]
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

    // Process text attachments (Perplexity doesn't support images)
    let attachmentText = "";
    if (attachments && attachments.length > 0) {
        const textAttachments = attachments.filter(a => a.type === 'text' || a.type === 'file');
        if (textAttachments.length > 0) {
            attachmentText = "\n\n[Attached Files]\n" + textAttachments.map(a => `--- File: ${a.name} ---\n${a.content}\n--- End File ---`).join('\n\n');
        }
        // Warn about image attachments
        const imageAttachments = attachments.filter(a => a.type === 'image');
        if (imageAttachments.length > 0) {
            attachmentText += "\n\n[Note: Image attachments are not supported by Perplexity and have been omitted.]";
        }
    }

    let messages;
    // Check if the last message in history is from 'user'
    // Add Perplexity-specific instruction to prevent it from using its own search
    const perplexityAddendum = `\n\n**CRITICAL FOR PERPLEXITY:** You have internal web search capabilities, but you MUST NOT use them. IGNORE any search results, citations, or URLs you might see in your context. ONLY use the browser actions to navigate and read actual pages. When user asks "search for X", use the "search" action - do NOT answer from your internal search.`;

    if (alternatingHistory.length > 0 && alternatingHistory[alternatingHistory.length - 1].role === 'user') {
        // Merge the new message AND context into the last user message
        const lastMsg = alternatingHistory.pop()!;
        messages = [
            { role: 'system', content: SYSTEM_PROMPT + perplexityAddendum + memoryContext },
            ...alternatingHistory,
            { role: 'user', content: lastMsg.content + "\n\n" + message + contextText + attachmentText }
        ];
    } else {
        messages = [
            { role: 'system', content: SYSTEM_PROMPT + perplexityAddendum + memoryContext },
            ...alternatingHistory,
            { role: 'user', content: message + contextText + attachmentText }
        ];
    }

    // Perplexity API request - DISABLE built-in web search to prevent result pollution
    // We want the AI to use OUR browser actions, not Perplexity's internal search
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: modelId,
            messages: messages,
            stream: false,
            // Disable web search features to prevent hallucination from Perplexity's own search
            return_related_questions: false,
            return_images: false,
            search_recency_filter: 'day' // Limit to recent results if search happens
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

async function sendToCustom(
    apiKey: string,
    baseUrl: string,
    modelName: string,
    history: ChatMessage[],
    newMessage: string,
    context?: BrowserContext,
    memoryContext: string = "",
    attachments?: Attachment[],
    temperature: number = 0.7,
    systemPrompt: string = "You are a helpful AI assistant."
): Promise<string> {
    // Build messages array
    const messages: any[] = [
        { role: "system", content: systemPrompt + memoryContext },
        ...history.map(msg => ({
            role: msg.role,
            content: msg.content
        }))
    ];

    // Build user message content
    let userContent = newMessage;

    if (context) {
        userContent += `\n\n[Current Page Context]\nTitle: ${context.title}\nURL: ${context.url}\nContent: ${context.content.substring(0, 10000)}...`;

        if (context.openTabs && context.openTabs.length > 0) {
            userContent += `\n\n[Open Tabs]\n${context.openTabs.map(t => `- ID: ${t.id}, Title: "${t.title}", URL: ${t.url}`).join('\n')}`;
        }
    }

    // Process text attachments
    if (attachments && attachments.length > 0) {
        const textAttachments = attachments.filter(a => a.type === 'text' || a.type === 'file');
        if (textAttachments.length > 0) {
            userContent += "\n\n[Attached Files]\n" + textAttachments.map(a => `--- File: ${a.name} ---\n${a.content}\n--- End File ---`).join('\n\n');
        }
    }

    messages.push({
        role: "user",
        content: userContent
    });

    // Construct the API URL - append model name if the URL doesn't already contain it
    let apiUrl = baseUrl;
    if (modelName && !baseUrl.includes(modelName)) {
        // For Bytez-style APIs: base_url/model_name
        apiUrl = baseUrl.endsWith('/') ? `${baseUrl}${modelName}` : `${baseUrl}/${modelName}`;
    }

    // Make the API request using fetch for maximum compatibility
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: messages,
            model: modelName || undefined,
            stream: false,
            params: {
                temperature: temperature,
                max_length: 4096
            },
            // Also include top-level params for OpenAI-compatible APIs
            temperature: temperature,
            max_tokens: 4096
        })
    });

    if (!response.ok) {
        const errorData = await response.text();
        console.error("Custom API Error:", response.status, errorData);
        throw new Error(`Custom API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log("Custom API Response:", data);

    // Handle different response formats
    if (data.choices && data.choices[0]?.message?.content) {
        // OpenAI-style response
        return data.choices[0].message.content;
    } else if (data.response) {
        // Some custom APIs return { response: "..." }
        return data.response;
    } else if (data.content) {
        // Some APIs return { content: "..." }
        return data.content;
    } else if (typeof data === 'string') {
        return data;
    }

    return JSON.stringify(data);
}



// OpenRouter API (Unified access to many models)
async function sendToOpenRouter(apiKey: string, history: ChatMessage[], newMessage: string, context?: BrowserContext, memoryContext: string = "", modelId: string = "openai/gpt-4o", attachments?: Attachment[]): Promise<string> {
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

    // Process text attachments
    let attachmentText = "";
    if (attachments && attachments.length > 0) {
        const textAttachments = attachments.filter(a => a.type === 'text' || a.type === 'file');
        if (textAttachments.length > 0) {
            attachmentText = "\n\n[Attached Files]\n" + textAttachments.map(a => `--- File: ${a.name} ---\n${a.content}\n--- End File ---`).join('\n\n');
        }
    }

    // Build user message content (text + images if any)
    let userContent: any = newMessage + contextString + attachmentText;

    if (attachments && attachments.length > 0) {
        const imageAttachments = attachments.filter(a => a.type === 'image');
        if (imageAttachments.length > 0) {
            userContent = [
                { type: "text", text: newMessage + contextString + attachmentText },
                ...imageAttachments.map(img => ({
                    type: "image_url",
                    image_url: { url: img.content }
                }))
            ];
        }
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
