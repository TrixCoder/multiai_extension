import { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Settings, Bot, User, Loader2, Moon, Sun, PlusCircle, Trash2, Plus, History, MessageSquare, X, Edit2, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { sendMessage } from './lib/ai';
import type { BrowserContext, MemoryItem } from './lib/ai';
import { TermsModal } from './components/TermsModal';
import { ThemeProvider, useTheme } from './components/ThemeProvider';
import { MarkdownMessage } from './components/MarkdownMessage';
import { AdBanner } from './components/AdBanner';
import { SettingsAd } from './components/SettingsAd';

// Utility for conditional tailwind classes
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: number;
  options?: { label: string; value: string }[];
  thought?: string;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
};

type Model = 'gemini' | 'openai' | 'perplexity' | 'claude' | 'custom';

const BATCH_SIZE = 20;

function MainApp() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<Model>('gemini');
  const [selectedModelId, setSelectedModelId] = useState<string>(''); // Specific model ID
  const [isLoading, setIsLoading] = useState(false);
  const [currentThought, setCurrentThought] = useState<string>('');

  // Settings
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [perplexityApiKey, setPerplexityApiKey] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [newMemoryKey, setNewMemoryKey] = useState('');
  const [newMemoryValue, setNewMemoryValue] = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);

  // Session Management
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Available Models Mapping
  const AVAILABLE_MODELS: Record<Model, { id: string; name: string }[]> = {
    gemini: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
    ],
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'o1-preview', name: 'o1 Preview' },
      { id: 'o1-mini', name: 'o1 Mini' }
    ],
    claude: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (New)' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' }
    ],
    perplexity: [
      { id: 'sonar-pro', name: 'Sonar Pro' },
      { id: 'sonar', name: 'Sonar' },
      { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro' },
      { id: 'sonar-reasoning', name: 'Sonar Reasoning' }
    ],
    custom: []
  };

  // Set default model ID when provider changes
  useEffect(() => {
    if (selectedModel !== 'custom' && AVAILABLE_MODELS[selectedModel].length > 0 && !AVAILABLE_MODELS[selectedModel].find(m => m.id === selectedModelId)) {
      setSelectedModelId(AVAILABLE_MODELS[selectedModel][0]?.id || '');
    }
  }, [selectedModel, selectedModelId]); // Added selectedModelId to dependencies to prevent infinite loop if it's already valid

  // Load saved state and handle migration
  useEffect(() => {
    chrome.storage.local.get(['hasConsented', 'chatSessions', 'currentSessionId', 'memory', 'chatMessages'], (result) => {
      setHasConsented(!!result.hasConsented);

      if (result.memory && Array.isArray(result.memory)) {
        setMemory(result.memory as MemoryItem[]);
      }

      let loadedSessions: ChatSession[] = [];
      if (result.chatSessions && Array.isArray(result.chatSessions)) {
        loadedSessions = result.chatSessions;
      } else if (result.chatMessages && Array.isArray(result.chatMessages) && result.chatMessages.length > 0) {
        const legacySession: ChatSession = {
          id: Date.now().toString(),
          title: 'Previous Chat',
          messages: result.chatMessages,
          timestamp: Date.now()
        };
        loadedSessions = [legacySession];
        chrome.storage.local.set({ chatSessions: loadedSessions });
      }

      setSessions(loadedSessions);

      if (result.currentSessionId && loadedSessions.find(s => s.id === result.currentSessionId)) {
        loadSessionInternal(result.currentSessionId as string, loadedSessions);
      } else if (loadedSessions.length > 0) {
        loadSessionInternal(loadedSessions[0].id, loadedSessions);
      } else {
        createNewSession();
      }
    });

    chrome.storage.sync.get(['geminiApiKey', 'openaiApiKey', 'claudeApiKey', 'perplexityApiKey', 'customBaseUrl', 'customApiKey', 'customModelName', 'selectedModel', 'selectedModelId'], (result) => {
      const data = result as any;
      if (data.geminiApiKey) setGeminiApiKey(data.geminiApiKey);
      if (data.openaiApiKey) setOpenaiApiKey(data.openaiApiKey);
      if (data.claudeApiKey) setClaudeApiKey(data.claudeApiKey);
      if (data.perplexityApiKey) setPerplexityApiKey(data.perplexityApiKey);
      if (data.customBaseUrl) setCustomBaseUrl(data.customBaseUrl);
      if (data.customApiKey) setCustomApiKey(data.customApiKey);
      if (data.customModelName) setCustomModelName(data.customModelName);
      if (data.selectedModel) setSelectedModel(data.selectedModel);
      if (data.selectedModelId) setSelectedModelId(data.selectedModelId);
    });
  }, []);

  // Persist Settings
  useEffect(() => {
    chrome.storage.sync.set({
      geminiApiKey,
      openaiApiKey,
      claudeApiKey,
      perplexityApiKey,
      customBaseUrl,
      customApiKey,
      customModelName,
      selectedModel,
      selectedModelId, // Persist selectedModelId
    });
  }, [geminiApiKey, openaiApiKey, claudeApiKey, perplexityApiKey, customBaseUrl, customApiKey, customModelName, selectedModel, selectedModelId]);

  // Persist Sessions
  useEffect(() => {
    if (!currentSessionId) return;
    setSessions(prev => {
      const updated = prev.map(s =>
        s.id === currentSessionId
          ? { ...s, messages: messages, title: s.title === 'New Chat' && messages.length > 0 ? messages[0].content.slice(0, 30) + '...' : s.title }
          : s
      );
      chrome.storage.local.set({ chatSessions: updated, currentSessionId });
      return updated;
    });
  }, [messages, currentSessionId]);

  // Pagination
  useEffect(() => {
    const sliced = messages.slice(-visibleCount);
    setVisibleMessages(sliced);
  }, [messages, visibleCount]);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop } = chatContainerRef.current;
      if (scrollTop === 0 && visibleCount < messages.length) {
        const scrollHeightBefore = chatContainerRef.current.scrollHeight;
        setVisibleCount(prev => Math.min(prev + BATCH_SIZE, messages.length));
        requestAnimationFrame(() => {
          if (chatContainerRef.current) {
            const scrollHeightAfter = chatContainerRef.current.scrollHeight;
            chatContainerRef.current.scrollTop = scrollHeightAfter - scrollHeightBefore;
          }
        });
      }
    }
  };

  useEffect(() => {
    if (visibleMessages.length > 0) scrollToBottom();
  }, [messages.length]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      timestamp: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages([]);
    setVisibleCount(BATCH_SIZE);
    setShowHistory(false);
  };

  const loadSessionInternal = (sessionId: string, currentSessions: ChatSession[]) => {
    const session = currentSessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(session.id);
      setMessages(session.messages);
      setVisibleCount(BATCH_SIZE);
    }
  };

  const loadSession = (sessionId: string) => {
    loadSessionInternal(sessionId, sessions);
    setShowHistory(false);
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);
    chrome.storage.local.set({ chatSessions: updatedSessions });
    if (currentSessionId === sessionId) {
      updatedSessions.length > 0 ? loadSessionInternal(updatedSessions[0].id, updatedSessions) : createNewSession();
    }
  };

  const startRenaming = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const saveRename = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const updatedSessions = sessions.map(s => s.id === sessionId ? { ...s, title: editTitle } : s);
    setSessions(updatedSessions);
    chrome.storage.local.set({ chatSessions: updatedSessions });
    setEditingSessionId(null);
  };

  const handleAcceptTerms = () => {
    chrome.storage.local.set({ hasConsented: true }, () => setHasConsented(true));
  };

  const handleNewChat = () => createNewSession();

  const addMemory = () => {
    if (!newMemoryKey.trim() || !newMemoryValue.trim()) return;
    const updatedMemory = [...memory, { key: newMemoryKey.trim(), value: newMemoryValue.trim() }];
    setMemory(updatedMemory);
    chrome.storage.local.set({ memory: updatedMemory });
    setNewMemoryKey('');
    setNewMemoryValue('');
  };

  const removeMemory = (index: number) => {
    const updatedMemory = memory.filter((_, i) => i !== index);
    setMemory(updatedMemory);
    chrome.storage.local.set({ memory: updatedMemory });
  };

  const executeAction = async (action: any) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return "Error: No active tab found.";

    if (action.action === 'navigate') {
      await chrome.tabs.update(tab.id, { url: action.url });
      return `✅ **Navigated** to [${action.url}](${action.url})`;
    }
    if (action.action === 'search') {
      const url = `https://www.google.com/search?q=${encodeURIComponent(action.query)}`;
      await chrome.tabs.update(tab.id, { url });
      return `🔍 **Searched** Google for: "${action.query}"`;
    }
    if (action.action === 'new_tab') {
      await chrome.tabs.create({ url: action.url || 'chrome://newtab' });
      return `✨ **Opened New Tab**${action.url ? ` to ${action.url}` : ''}`;
    }
    if (action.action === 'close_tab') {
      if (action.tabId) {
        await chrome.tabs.remove(action.tabId);
        return `🗑️ **Closed Tab** ${action.tabId}`;
      }
      return "❌ Error: No tabId provided for close_tab.";
    }
    if (action.action === 'switch_tab') {
      if (action.tabId) {
        try {
          const tabId = parseInt(action.tabId);
          const tab = await chrome.tabs.get(tabId);
          await chrome.tabs.update(tabId, { active: true });
          if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
          return `🔀 **Switched Tab** to "${tab.title}"`;
        } catch (e) {
          return `❌ **Failed to switch tab**: Tab ID ${action.tabId} not found.`;
        }
      }
      return `❌ **Tab Not Found**`;
    }
    if (action.action === 'get_tab_content') {
      if (action.tabId) {
        try {
          const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: action.tabId },
            func: () => document.body.innerText,
          });
          return `📄 **Read Content** of Tab ${action.tabId}:\n${result?.substring(0, 500)}...`;
        } catch (e) {
          return `❌ **Failed to read tab**: Tab ID ${action.tabId} not found or inaccessible.`;
        }
      }
      return "❌ Error: No tabId provided for get_tab_content.";
    }
    if (action.action === 'ask_selection') {
      return action.question;
    }

    // DOM Actions
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (act) => {
          if (act.action === 'scroll') {
            if (act.direction === 'top') window.scrollTo(0, 0);
            else if (act.direction === 'bottom') window.scrollTo(0, document.body.scrollHeight);
            else if (act.direction === 'up') window.scrollBy(0, -500);
            else window.scrollBy(0, 500);
            return `Scrolled ${act.direction}`;
          } else if (act.action === 'click') {
            const el = document.querySelector(act.selector) as HTMLElement;
            if (el) { el.click(); return `Clicked element (${act.selector})`; }
            else return `Element not found (${act.selector})`;
          } else if (act.action === 'type') {
            const el = document.querySelector(act.selector) as HTMLInputElement;
            if (el) { el.value = act.text; el.dispatchEvent(new Event('input', { bubbles: true })); return `Typed "${act.text}" into (${act.selector})`; }
            else return `Input field not found (${act.selector})`;
          }
          return 'Unknown action';
        },
        args: [action]
      });
      return `⚡ **Action:** ${results[0]?.result || 'Action executed'}`;
    } catch (e: any) {
      return `⚠️ **Action Failed:** ${e.message || "Cannot execute script on this page (likely restricted)."}`;
    }
  };

  // Core Agent Logic
  const processMessage = async (text: string, isUser: boolean = true) => {
    if (!text.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: isUser ? 'user' : 'assistant',
      content: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, newMessage]);
    if (isUser) setInput('');
    setIsLoading(true);
    setCurrentThought('');

    try {
      // Slice to keep only the last 10 messages for context window
      // Do NOT include newMessage here, as it is passed as a separate argument to sendMessage
      let currentHistory = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      let loopCount = 0;
      const MAX_LOOPS = 10;
      let finalResponse = "";

      while (loopCount < MAX_LOOPS) {
        // Capture current context
        let context: BrowserContext | undefined;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const allTabs = await chrome.tabs.query({});

        if (tab?.id) {
          try {
            const screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

            // Try to get page content, handle restricted pages
            let pageContent = "";
            try {
              const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.body.innerText,
              });
              pageContent = result || "";
            } catch (e) {
              pageContent = "Content inaccessible (Restricted Page e.g., New Tab, Chrome Web Store).";
            }

            context = {
              title: tab.title || 'Unknown Page',
              url: tab.url || 'Unknown URL',
              content: pageContent,
              screenshot: screenshotUrl,
              openTabs: allTabs.map(t => ({ id: t.id!, title: t.title || 'Untitled', url: t.url || '' }))
            };
          } catch (e) {
            console.error("Context capture failed:", e);
            // Proceed without full context if capture fails
            context = {
              title: tab.title || 'Unknown',
              url: tab.url || 'Unknown',
              content: "Failed to capture context.",
              openTabs: allTabs.map(t => ({ id: t.id!, title: t.title || 'Untitled', url: t.url || '' }))
            };
          }
        }

        // Resolve API Key
        let currentApiKey = '';
        if (selectedModel === 'gemini') currentApiKey = geminiApiKey;
        if (selectedModel === 'openai') currentApiKey = openaiApiKey;
        if (selectedModel === 'claude') currentApiKey = claudeApiKey;
        if (selectedModel === 'perplexity') currentApiKey = perplexityApiKey;
        if (selectedModel === 'custom') currentApiKey = customApiKey;

        // Send request to AI provider
        const responseText = await sendMessage(
          selectedModel,
          currentApiKey,
          currentHistory,
          loopCount === 0 ? text : "Proceed with the next step based on the previous action result.",
          context,
          { baseUrl: customBaseUrl, modelName: customModelName },
          memory,
          selectedModelId // Pass the specific model ID
        );

        console.debug("Raw Response:", responseText);

        // Parse JSON Response
        let thought = "";
        let action = null;
        let responseContent = responseText;

        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.debug("Parsed JSON:", parsed);
            thought = parsed.thought || "";
            // Fix: Check if parsed.action exists, then assign the WHOLE parsed object to action
            // The system prompt defines the structure as { "action": "navigate", "url": ... }
            if (parsed.action) {
              action = parsed;
            }

            if (parsed.response) {
              responseContent = parsed.response;
            } else if (parsed.thought) {
              responseContent = parsed.thought;
            }
            // If neither response nor thought is present, we might keep the original text, 
            // but usually the thought should be there if it's our JSON format.
          }
        } catch (e) {
          console.log("Failed to parse JSON, treating as raw text");
        }

        console.debug("Final Content:", responseContent);

        // Update UI with thought
        if (thought) setCurrentThought(thought);

        // Execute Action or Finish
        if (action) {
          const actionResult = await executeAction(action);

          // Add AI's thought/action to history so it remembers what it did
          currentHistory.push({ role: 'assistant', content: `Thought: ${thought}\nAction: ${JSON.stringify(action)}` });
          // Add result to history
          currentHistory.push({ role: 'user', content: `Action Result: ${actionResult}` });

          loopCount++;
          // Continue loop
        } else {
          // No action, this is the final response
          finalResponse = responseContent;
          break;
        }
      }

      if (loopCount >= MAX_LOOPS) {
        finalResponse = "I reached the maximum number of steps. Here is what I found so far.";
      }

      const responseMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: finalResponse,
        timestamp: Date.now(),
        thought: currentThought // Save the last thought
      };

      setMessages(prev => [...prev, responseMessage]);

    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error.message || "Failed to process request."}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
      setCurrentThought('');
    }
  };

  const handleSend = () => processMessage(input);

  const handleOptionSelect = (option: { label: string; value: string }) => {
    const selectionText = `Selected option: ${option.label} (ID: ${option.value})`;
    processMessage(selectionText);
  };

  const saveSettings = () => {
    chrome.storage.sync.set({
      geminiApiKey,
      openaiApiKey,
      claudeApiKey,
      perplexityApiKey,
      customBaseUrl,
      customApiKey,
      customModelName,
      selectedModel,
      selectedModelId
    });
    setShowSettings(false);
  };

  if (hasConsented === null) return <div className="h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300 overflow-hidden">
      {!hasConsented && <TermsModal onAccept={handleAcceptTerms} />}

      {/* History Sidebar */}
      <div className={cn("fixed inset-y-0 left-0 z-20 w-64 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out flex flex-col", showHistory ? "translate-x-0" : "-translate-x-full")}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Chat History</h2>
          <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-2">
          <button onClick={handleNewChat} className="w-full flex items-center gap-2 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"><PlusCircle className="w-4 h-4" /> New Chat</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(session => (
            <div key={session.id} onClick={() => loadSession(session.id)} className={cn("group flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm transition-colors", currentSessionId === session.id ? "bg-white dark:bg-gray-800 shadow-sm" : "hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400")}>
              <MessageSquare className="w-4 h-4 shrink-0" />
              {editingSessionId === session.id ? (
                <div className="flex-1 flex items-center gap-1">
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full p-1 text-xs rounded border border-blue-500 bg-white dark:bg-gray-700" autoFocus />
                  <button onClick={(e) => saveRename(e, session.id)} className="p-1 text-green-500 hover:bg-green-100 rounded"><Check className="w-3 h-3" /></button>
                </div>
              ) : (
                <div className="flex-1 truncate text-xs" title={session.title}>{session.title || 'Untitled Chat'}</div>
              )}
              {!editingSessionId && (
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => startRenaming(e, session)} className="p-1 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-500 rounded"><Edit2 className="w-3 h-3" /></button>
                  <button onClick={(e) => deleteSession(e, session.id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded"><Trash2 className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Ad Banner in Sidebar */}
        <AdBanner
          href="https://github.com/sponsors/yourusername"
          title="Sponsored"
          description="Support development & get Pro features!"
        />
      </div>

      {/* Main Content */}
      <div className={cn("flex-1 flex flex-col h-full transition-all duration-300", showHistory ? "ml-64" : "ml-0")}>
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistory(!showHistory)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"><History className="w-5 h-5 text-gray-600 dark:text-gray-400" /></button>
            <img src="logo.png" alt="Logo" className="w-8 h-8 rounded-lg shadow-lg" />
            <h1 className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hidden sm:block">AI Agent</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleNewChat} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors sm:hidden"><PlusCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" /></button>
            <button onClick={toggleTheme} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">{theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-600" />}</button>
            <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"><Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" /></button>
          </div>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute inset-0 z-50 bg-gray-100 dark:bg-gray-900 p-6 overflow-y-auto animate-in slide-in-from-bottom-5">
            <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"><X className="w-5 h-5" /></button>
              </div>

              {/* Sponsored Link in Settings */}
              <SettingsAd
                href="https://github.com/sponsors/yourusername"
                title="Support the Developer"
                description="Help us keep this extension free and open source!"
                cta="Sponsor"
              />

              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider">API Keys</h3>
                  <div>
                    <label className="block text-sm font-medium mb-1">Gemini API Key</label>
                    <input type="password" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} className="w-full p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600" placeholder="Enter Gemini API Key" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">OpenAI API Key</label>
                    <input type="password" value={openaiApiKey} onChange={(e) => setOpenaiApiKey(e.target.value)} className="w-full p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600" placeholder="Enter OpenAI API Key" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Claude API Key</label>
                    <input type="password" value={claudeApiKey} onChange={(e) => setClaudeApiKey(e.target.value)} className="w-full p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600" placeholder="Enter Claude API Key" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Perplexity API Key</label>
                    <input type="password" value={perplexityApiKey} onChange={(e) => setPerplexityApiKey(e.target.value)} className="w-full p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600" placeholder="Enter Perplexity API Key" />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider">Custom AI</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" value={customBaseUrl} onChange={(e) => setCustomBaseUrl(e.target.value)} className="w-full p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600" placeholder="Base URL" />
                    <input type="text" value={customModelName} onChange={(e) => setCustomModelName(e.target.value)} className="w-full p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600" placeholder="Model Name" />
                    <input type="password" value={customApiKey} onChange={(e) => setCustomApiKey(e.target.value)} className="w-full p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 md:col-span-2" placeholder="Custom API Key" />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider">Memory</h3>
                  <div className="space-y-2">
                    {memory.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        <div className="flex-1 overflow-hidden">
                          <div className="text-sm font-bold truncate">{item.key}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.value}</div>
                        </div>
                        <button onClick={() => removeMemory(idx)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input type="text" value={newMemoryKey} onChange={(e) => setNewMemoryKey(e.target.value)} className="flex-1 p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 min-w-0" placeholder="Key" />
                    <div className="flex gap-2 flex-1">
                      <input type="text" value={newMemoryValue} onChange={(e) => setNewMemoryValue(e.target.value)} className="flex-1 p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 min-w-0" placeholder="Value" />
                      <button onClick={addMemory} className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 shrink-0"><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>

                <button onClick={saveSettings} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors shadow-lg shadow-blue-600/20">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Model Selector */}
        <div className="flex flex-col bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2 p-2 overflow-x-auto scrollbar-hide">
            {(['gemini', 'openai', 'claude', 'perplexity', 'custom'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setSelectedModel(m); chrome.storage.sync.set({ selectedModel: m }); }}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-colors flex items-center gap-1",
                  selectedModel === m ? "bg-blue-600 text-white shadow-sm" : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          {selectedModel !== 'custom' && (
            <div className="px-2 pb-2">
              <select
                value={selectedModelId}
                onChange={(e) => { setSelectedModelId(e.target.value); chrome.storage.sync.set({ selectedModelId: e.target.value }); }}
                className="w-full p-1.5 text-xs rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {AVAILABLE_MODELS[selectedModel].map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
        >
          {visibleCount < messages.length && (
            <div className="flex justify-center py-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          )}

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 space-y-4 opacity-70">
              <Bot className="w-16 h-16" />
              <p className="text-center text-sm">Select a model and start chatting.<br />I can read your current tab!</p>
            </div>
          )}

          {visibleMessages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-3 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300", msg.role === 'user' ? "justify-end" : "justify-start")}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}

              <div className={cn("flex flex-col max-w-[85%]", msg.role === 'user' ? "items-end" : "items-start")}>
                {msg.thought && (
                  <div className="mb-2 text-xs text-gray-500 dark:text-gray-400 italic border-l-2 border-gray-300 dark:border-gray-600 pl-2">
                    <span className="font-semibold not-italic">Thought:</span> {msg.thought}
                  </div>
                )}
                <div className={cn("rounded-2xl p-4 shadow-sm", msg.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-tl-none")}>
                  {msg.image && (
                    <img src={msg.image} alt="Uploaded" className="max-w-full h-auto rounded-lg mb-2" />
                  )}
                  <MarkdownMessage content={msg.content} />
                </div>
                {msg.options && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.options.map((option, idx) => (
                      <button key={idx} onClick={() => handleOptionSelect(option)} className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-800">{option.label}</button>
                    ))}
                  </div>
                )}
                <span className="text-[10px] text-gray-400 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 max-w-3xl mx-auto">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col gap-2">
                {currentThought && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 italic border-l-2 border-gray-300 dark:border-gray-600 pl-2 animate-pulse">
                    <span className="font-semibold not-italic">Thinking:</span> {currentThought}
                  </div>
                )}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-none p-4 shadow-sm w-16 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          <div className="relative flex items-end gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-2xl border border-gray-200 dark:border-gray-700 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shadow-inner">
            <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"><ImageIcon className="w-5 h-5" /></button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything or paste a URL..."
              className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 py-2 text-sm"
              rows={1}
            />
            <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-600/20"><Send className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}

export default App;
