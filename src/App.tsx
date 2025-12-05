import { useState, useEffect, useRef } from 'react';
import { Send, Settings, Bot, User, Loader2, PlusCircle, Trash2, Plus, MessageSquare, X, Edit2, Check, Menu, Copy, Bell, Clock, CheckCircle, Paperclip, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { sendMessage } from './lib/ai';
import type { BrowserContext, MemoryItem, Attachment } from './lib/ai';
import { TermsModal } from './components/TermsModal';
import { MarkdownMessage } from './components/MarkdownMessage';
import { AdBanner } from './components/AdBanner';

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
  attachments?: Attachment[];
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
};

type Model = 'gemini' | 'openai' | 'perplexity' | 'claude' | 'openrouter' | 'custom';

type Reminder = {
  id: string;
  message: string;
  triggerAt: number; // timestamp
  createdAt: number;
  status: 'pending' | 'completed' | 'dismissed';
};

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
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  const [memory, setMemory] = useState<MemoryItem[]>([]);

  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reminderFilter, setReminderFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);

  // Session Management
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]); // Generic attachments
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Available Models Mapping
  const AVAILABLE_MODELS: Record<Model, { id: string; name: string }[]> = {
    gemini: [
      { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro (Latest)' },
      { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
      { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B' }
    ],
    openai: [
      { id: 'gpt-5.1', name: 'GPT-5.1 (Latest)' },
      { id: 'gpt-5', name: 'GPT-5' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'o3', name: 'o3' },
      { id: 'o3-mini', name: 'o3 Mini' },
      { id: 'o1', name: 'o1' },
      { id: 'o1-mini', name: 'o1 Mini' },
      { id: 'o1-pro', name: 'o1 Pro' }
    ],
    claude: [
      { id: 'claude-opus-4.5', name: 'Claude Opus 4.5' },
      { id: 'claude-sonnet-4.5-thinking', name: 'Claude Sonnet 4.5 (Thinking)' },
      { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
      { id: 'claude-opus-4', name: 'Claude Opus 4' },
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet' },
      { id: 'claude-3-5-sonnet-v2', name: 'Claude 3.5 Sonnet v2' },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus', name: 'Claude 3 Opus' }
    ],
    perplexity: [
      { id: 'sonar-pro', name: 'Sonar Pro' },
      { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro' },
      { id: 'sonar-reasoning', name: 'Sonar Reasoning' },
      { id: 'sonar', name: 'Sonar' },
      { id: 'sonar-deep-research', name: 'Sonar Deep Research' }
    ],
    openrouter: [
      { id: 'openai/gpt-5.1', name: 'GPT-5.1' },
      { id: 'openai/gpt-5', name: 'GPT-5' },
      { id: 'openai/gpt-4.1', name: 'GPT-4.1' },
      { id: 'openai/o1-pro', name: 'o1 Pro' },
      { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5' },
      { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
      { id: 'anthropic/claude-sonnet-4.5-thinking', name: 'Claude Sonnet 4.5 (Thinking)' },
      { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet' },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick' },
      { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
      { id: 'deepseek/deepseek-v3', name: 'DeepSeek V3' },
      { id: 'qwen/qwen-3-235b', name: 'Qwen 3 235B' },
      { id: 'mistralai/mistral-large-2411', name: 'Mistral Large' },
      { id: 'mistralai/codestral-2501', name: 'Codestral' },
      { id: 'cohere/command-r-plus-08-2024', name: 'Command R+' }
    ],
    custom: []
  };

  // Set default model ID when provider changes
  useEffect(() => {
    if (selectedModel !== 'custom' && AVAILABLE_MODELS[selectedModel].length > 0 && !AVAILABLE_MODELS[selectedModel].find(m => m.id === selectedModelId)) {
      setSelectedModelId(AVAILABLE_MODELS[selectedModel][0]?.id || '');
    }
  }, [selectedModel, selectedModelId]);

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

    chrome.storage.sync.get(['geminiApiKey', 'openaiApiKey', 'claudeApiKey', 'perplexityApiKey', 'openrouterApiKey', 'customBaseUrl', 'customApiKey', 'customModelName', 'selectedModel', 'selectedModelId'], (result) => {
      const data = result as any;
      if (data.geminiApiKey) setGeminiApiKey(data.geminiApiKey);
      if (data.openaiApiKey) setOpenaiApiKey(data.openaiApiKey);
      if (data.claudeApiKey) setClaudeApiKey(data.claudeApiKey);
      if (data.perplexityApiKey) setPerplexityApiKey(data.perplexityApiKey);
      if (data.openrouterApiKey) setOpenrouterApiKey(data.openrouterApiKey);
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
      openrouterApiKey,
      customBaseUrl,
      customApiKey,
      customModelName,
      selectedModel,
      selectedModelId,
    });
  }, [geminiApiKey, openaiApiKey, claudeApiKey, perplexityApiKey, openrouterApiKey, customBaseUrl, customApiKey, customModelName, selectedModel, selectedModelId]);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 5 - attachments.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach(file => {
      const reader = new FileReader();

      if (file.type.startsWith('image/')) {
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setAttachments(prev => [...prev, { type: 'image', content: base64, name: file.name, mimeType: file.type }]);
        };
        reader.readAsDataURL(file);
      } else {
        // Assume text-based for other files for now (expand logic later for specific types if needed)
        reader.onload = (event) => {
          const text = event.target?.result as string;
          setAttachments(prev => [...prev, { type: 'text', content: text, name: file.name, mimeType: file.type }]);
        };
        reader.readAsText(file);
      }
    });

    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const removeMemory = (index: number) => {
    const updatedMemory = memory.filter((_, i) => i !== index);
    setMemory(updatedMemory);
    chrome.storage.local.set({ memory: updatedMemory });
  };

  const executeAction = async (action: any) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return "❌ Error: No active tab found.";

    console.log("📍 Executing Action:", JSON.stringify(action));

    // --- NAVIGATE ---
    if (action.action === 'navigate') {
      if (action.url) {
        try {
          console.log(`🧭 Navigating to: ${action.url}`);
          await chrome.tabs.update(tab.id, { url: action.url });

          // Wait for load with verification
          let attempts = 0;
          while (attempts < 30) {
            const t = await chrome.tabs.get(tab.id);
            if (t.status === 'complete') {
              const result = `✅ **Navigated** to ${t.url}`;
              console.log(result);
              return result;
            }
            await new Promise(r => setTimeout(r, 500));
            attempts++;
          }
          const timeout = `⚠️ **Navigation Timeout:** Page took too long to load.`;
          console.warn(timeout);
          return timeout;
        } catch (e: any) {
          const error = `❌ **Navigation Failed:** ${e.message}`;
          console.error(error);
          return error;
        }
      }
      return "❌ Error: No URL provided for navigation.";
    }

    // --- SEARCH (Direct Google Search - Most Reliable) ---
    if (action.action === 'search') {
      const url = `https://www.google.com/search?q=${encodeURIComponent(action.query)}`;
      console.log(`🔍 Direct search: ${action.query}`);
      await chrome.tabs.update(tab.id, { url });
      // Wait for load
      let attempts = 0;
      while (attempts < 20) {
        const t = await chrome.tabs.get(tab.id);
        if (t.status === 'complete') break;
        await new Promise(r => setTimeout(r, 500));
        attempts++;
      }
      const result = `✅ **Searched** Google for: "${action.query}"`;
      console.log(result);
      return result;
    }

    // --- NEW TAB ---
    if (action.action === 'new_tab') {
      await chrome.tabs.create({ url: action.url || 'chrome://newtab' });
      return `✅ **Opened New Tab**${action.url ? ` to ${action.url}` : ''}`;
    }

    // --- CLOSE TAB ---
    if (action.action === 'close_tab') {
      if (action.tabId) {
        await chrome.tabs.remove(action.tabId);
        return `✅ **Closed Tab** ${action.tabId}`;
      }
      return "❌ Error: No tabId provided.";
    }

    // --- SWITCH TAB ---
    if (action.action === 'switch_tab') {
      if (action.tabId) {
        try {
          const tabId = parseInt(action.tabId);
          const switchTab = await chrome.tabs.get(tabId);
          await chrome.tabs.update(tabId, { active: true });
          if (switchTab.windowId) await chrome.windows.update(switchTab.windowId, { focused: true });
          return `✅ **Switched** to Tab "${switchTab.title}"`;
        } catch (e) {
          return `❌ **Tab Not Found:** ID ${action.tabId}`;
        }
      }
      return `❌ Error: No tabId provided.`;
    }

    // --- GET TAB CONTENT ---
    if (action.action === 'get_tab_content') {
      if (action.tabId) {
        try {
          const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: action.tabId },
            func: () => document.body.innerText,
          });
          return `✅ **Read Content:**\n${result?.substring(0, 1000)}...`;
        } catch (e) {
          return `❌ **Failed to read tab**: Inaccessible.`;
        }
      }
      return "❌ Error: No tabId provided.";
    }

    // --- REMINDER ---
    if (action.action === 'set_reminder') {
      const seconds = action.seconds || 0;
      const msg = action.message || "Reminder!";

      if (seconds > 0) {
        const reminderId = Date.now().toString();
        const triggerAt = Date.now() + (seconds * 1000);

        // Add to reminders state
        const newReminder: Reminder = {
          id: reminderId,
          message: msg,
          triggerAt: triggerAt,
          createdAt: Date.now(),
          status: 'pending'
        };

        setReminders(prev => [...prev, newReminder]);

        setTimeout(() => {
          // Update reminder status to completed
          setReminders(prev => prev.map(r =>
            r.id === reminderId ? { ...r, status: 'completed' as const } : r
          ));

          // Play notification sound (beep)
          const beep = new Audio('data:audio/wav;base64,UklGRnoAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUsAAACAgICAgICAgICAgIB/f39/f39/f39/f4CAgICAgICBgYGBgYGBgYGBgYGAgICAgICAgICAgIB/f39+fn5+fn5+f39/f4CAgA==');
          beep.play().catch(() => { });

          // Browser Notification
          try {
            chrome.notifications.create(reminderId, {
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: '⏰ Reminder',
              message: msg,
              priority: 2,
              requireInteraction: true
            });
          } catch (e) {
            console.log("Notification failed:", e);
          }

          // Alert as fallback
          alert(`⏰ Reminder: ${msg}`);
        }, seconds * 1000);

        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timeStr = mins > 0 ? `${mins} minute(s) ${secs > 0 ? `and ${secs} second(s)` : ''}` : `${secs} second(s)`;
        return `✅ **Reminder Set** for ${timeStr}: "${msg}"`;
      }
      return "❌ Error: Invalid time for reminder.";
    }

    // --- DOM ACTIONS (scroll, click, type, press_key) ---
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (act) => {
          // Helper: Check if element is visible
          const isVisible = (el: HTMLElement): boolean => {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              parseFloat(style.opacity) > 0 &&
              rect.width > 0 &&
              rect.height > 0
            );
          };

          // Helper: Find element with multiple selector strategies
          const findElement = (selector: string): HTMLElement | null => {
            // Try direct selector first
            let el = document.querySelector(selector) as HTMLElement;
            if (el && isVisible(el)) return el;

            // If not found or hidden, try common alternatives
            const alternatives = [
              selector,
              selector.replace('input[', 'textarea['), // input -> textarea
              selector.replace('textarea[', 'input['), // textarea -> input
              `[aria-label="${selector.match(/aria-label="([^"]+)"/)?.[1] || ''}"]`,
            ];

            for (const alt of alternatives) {
              try {
                el = document.querySelector(alt) as HTMLElement;
                if (el && isVisible(el)) return el;
              } catch { }
            }

            return null;
          };

          // --- SCROLL ---
          if (act.action === 'scroll') {
            if (act.direction === 'top') window.scrollTo(0, 0);
            else if (act.direction === 'bottom') window.scrollTo(0, document.body.scrollHeight);
            else if (act.direction === 'up') window.scrollBy(0, -500);
            else window.scrollBy(0, 500);
            return `✅ **Scrolled** ${act.direction}`;
          }

          // --- CLICK ---
          if (act.action === 'click') {
            const el = findElement(act.selector);
            if (!el) return `❌ **Click Failed:** Element not found or hidden (${act.selector})`;

            el.scrollIntoView({ behavior: 'instant', block: 'center' });

            // Full click simulation
            el.focus();
            ['mousedown', 'mouseup', 'click'].forEach(eventType => {
              el.dispatchEvent(new MouseEvent(eventType, { view: window, bubbles: true, cancelable: true, buttons: 1 }));
            });

            // If it's a link, check if href exists
            if (el.tagName === 'A' && (el as HTMLAnchorElement).href) {
              return `✅ **Clicked** link: ${(el as HTMLAnchorElement).href.substring(0, 50)}...`;
            }
            return `✅ **Clicked** (${act.selector})`;
          }

          // --- TYPE ---
          if (act.action === 'type') {
            const el = findElement(act.selector) as HTMLInputElement | HTMLTextAreaElement;
            if (!el) return `❌ **Type Failed:** Input not found (${act.selector})`;

            el.scrollIntoView({ behavior: 'instant', block: 'center' });
            el.focus();
            el.click(); // Ensure focus

            // Clear existing value
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));

            // Set new value using native setter for React compatibility
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
              "value"
            )?.set;

            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(el, act.text);
            } else {
              el.value = act.text;
            }

            // Dispatch events
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));

            // Verify
            if (el.value === act.text) {
              return `✅ **Typed** "${act.text}" into (${act.selector})`;
            }
            return `⚠️ **Type Partial:** Typed but value is "${el.value}" (expected "${act.text}")`;
          }

          // --- PRESS KEY (Enter, Tab, Escape, etc.) ---
          if (act.action === 'press_key') {
            const key = act.key?.toLowerCase() || 'enter';
            const activeElement = act.selector
              ? (findElement(act.selector) || document.activeElement)
              : document.activeElement;

            if (!activeElement) return `❌ **Press Key Failed:** No active element`;

            const keyMap: Record<string, { key: string; code: string; keyCode: number }> = {
              'enter': { key: 'Enter', code: 'Enter', keyCode: 13 },
              'tab': { key: 'Tab', code: 'Tab', keyCode: 9 },
              'escape': { key: 'Escape', code: 'Escape', keyCode: 27 },
              'backspace': { key: 'Backspace', code: 'Backspace', keyCode: 8 },
              'arrowdown': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
              'arrowup': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
            };

            const keyInfo = keyMap[key] || { key: key, code: key, keyCode: 0 };

            ['keydown', 'keypress', 'keyup'].forEach(eventType => {
              activeElement.dispatchEvent(new KeyboardEvent(eventType, {
                key: keyInfo.key,
                code: keyInfo.code,
                keyCode: keyInfo.keyCode,
                which: keyInfo.keyCode,
                bubbles: true,
                cancelable: true,
              }));
            });

            // For Enter on forms, also try to submit
            if (key === 'enter') {
              const form = (activeElement as HTMLElement).closest?.('form');
              if (form) {
                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
              }
            }

            return `✅ **Pressed** ${keyInfo.key} key`;
          }

          // --- TYPE AND SUBMIT (Convenience action: type + Enter) ---
          if (act.action === 'type_and_submit') {
            const el = findElement(act.selector) as HTMLInputElement;
            if (!el) return `❌ **Type Failed:** Input not found (${act.selector})`;

            el.scrollIntoView({ behavior: 'instant', block: 'center' });
            el.focus();
            el.click();
            el.value = '';

            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
              "value"
            )?.set;

            if (nativeInputValueSetter) nativeInputValueSetter.call(el, act.text);
            else el.value = act.text;

            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));

            // Press Enter
            ['keydown', 'keypress', 'keyup'].forEach(eventType => {
              el.dispatchEvent(new KeyboardEvent(eventType, {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
                bubbles: true, cancelable: true,
              }));
            });

            // Try form submit
            const form = el.closest?.('form');
            if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

            return `✅ **Typed and Submitted** "${act.text}"`;
          }

          return `❓ Unknown action: ${act.action}`;
        },
        args: [action]
      });

      const result = results[0]?.result || '❓ No result';
      console.log("📍 Action Result:", result);

      // Wait after actions that might trigger navigation
      if (action.action === 'click' || action.action === 'press_key' || action.action === 'type_and_submit') {
        console.log("⏳ Waiting for potential page load...");
        await new Promise(r => setTimeout(r, 2000));
        // Check if page is still loading
        let attempts = 0;
        while (attempts < 10) {
          const t = await chrome.tabs.get(tab.id);
          if (t.status === 'complete') break;
          await new Promise(r => setTimeout(r, 500));
          attempts++;
        }
      }

      return result;
    } catch (e: any) {
      const error = `❌ **Action Failed:** ${e.message || "Cannot execute on this page."}`;
      console.error(error);
      return error;
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
      attachments: isUser ? [...attachments] : undefined, // Store attachments with user message
    };

    setMessages(prev => [...prev, newMessage]);
    if (isUser) {
      setInput('');
      setAttachments([]); // Clear attachments after sending
    }
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
            const isRestrictedUrl = !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('brave://') || tab.url.startsWith('https://chrome.google.com/webstore');

            if (isRestrictedUrl) {
              pageContent = `[System Message: Restricted Page]
You are currently on a restricted system page (${tab.url}).
Browser security prevents reading content or executing scripts here.
You CANNOT interact with this page (click, type, scroll).
You CAN navigate to other URLs using the 'navigate' action.`;
            } else {
              try {
                const [{ result }] = await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: () => {
                    // Helper to generate a useful selector
                    const getSelector = (el: Element): string => {
                      if (el.id) return `#${el.id}`;
                      if (el.getAttribute('name')) return `${el.tagName.toLowerCase()}[name="${el.getAttribute('name')}"]`;
                      if (el.getAttribute('aria-label')) return `${el.tagName.toLowerCase()}[aria-label="${el.getAttribute('aria-label')}"]`;
                      if (el.className && typeof el.className === 'string') return `.${el.className.split(' ').join('.')}`;
                      return el.tagName.toLowerCase();
                    };

                    // Find interactive elements
                    const interactive = Array.from(document.querySelectorAll('input, textarea, button, a, select, [role="button"]'))
                      .filter(el => {
                        const style = window.getComputedStyle(el);
                        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                      })
                      .map(el => {
                        const tag = el.tagName.toLowerCase();
                        const type = el.getAttribute('type') || '';
                        const label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent?.slice(0, 50).trim() || '';
                        const selector = getSelector(el);
                        return `[${tag}${type ? ` type="${type}"` : ''}] Selector: ${selector} | Label: "${label}"`;
                      })
                      .slice(0, 100) // Limit to top 100 elements to save tokens
                      .join('\n');

                    return `Page Title: ${document.title}\n\nInteractive Elements:\n${interactive}\n\nVisible Text:\n${document.body.innerText.slice(0, 2000)}`;
                  },
                });
                pageContent = result || "";
              } catch (e) {
                pageContent = "Content inaccessible (Restricted Page e.g., New Tab, Chrome Web Store).";
              }
            }

            context = {
              title: tab.title || 'Unknown Page',
              url: tab.url || 'Unknown URL',
              content: pageContent,
              screenshot: screenshotUrl,
              openTabs: allTabs.map(t => ({ id: t.id!, title: t.title || 'Untitled', url: t.url || '' }))
            };
          } catch (e: any) {
            console.error("Context capture failed:", e);
            // Proceed without full context if capture fails
            context = {
              title: tab.title || 'Unknown',
              url: tab.url || 'Unknown',
              content: `Failed to capture context. Error: ${e.message}. (You might be on a restricted page like chrome://newtab or the Web Store. You can still navigate to other URLs.)`,
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
        if (selectedModel === 'openrouter') currentApiKey = openrouterApiKey;
        if (selectedModel === 'custom') currentApiKey = customApiKey;

        // Send request to AI provider with Auto-Retry for Rate Limits
        let responseText = "";
        let retryCount = 0;
        const MAX_RETRIES = 3;

        while (retryCount <= MAX_RETRIES) {
          try {
            responseText = await sendMessage(
              selectedModel,
              currentApiKey,
              currentHistory,
              loopCount === 0 ? text : "Proceed with the next step based on the previous action result.",
              context,
              { baseUrl: customBaseUrl, modelName: customModelName },
              memory,
              selectedModelId,
              loopCount === 0 ? attachments : [] // Only send attachments on first message
            );
            break; // Success, exit retry loop
          } catch (error: any) {
            if (retryCount < MAX_RETRIES && (error.message.includes("429") || error.message.includes("quota") || error.message.includes("rate limit"))) {
              console.warn(`Rate limit hit. Retrying in 4 seconds... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
              // Extract wait time if available, otherwise default to 4s
              const waitTime = 4000;
              await new Promise(resolve => setTimeout(resolve, waitTime));
              retryCount++;
            } else {
              throw error; // Re-throw other errors or if max retries reached
            }
          }
        }

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
            if (parsed.action) {
              action = parsed.action;
            }

            if (parsed.response) {
              responseContent = parsed.response;
            } else if (parsed.thought) {
              responseContent = parsed.thought;
            }
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

          // If the AI also provided a response along with the action, use it and stop
          // This handles cases like "I've set the reminder for you" + action
          if (responseContent && responseContent !== thought && !responseContent.includes('"action"')) {
            finalResponse = responseContent;
            break;
          }

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
      console.error("Processing Error:", error);
      let errorMessage = "An unexpected error occurred.";

      if (error.message.includes("API Key is missing")) {
        errorMessage = "⚠️ API Key is missing. Please go to Settings and enter your API key.";
      } else if (error.message.includes("401") || error.message.includes("unauthorized")) {
        errorMessage = "🚫 Authentication failed. Please check your API key in Settings.";
      } else if (error.message.includes("429") || error.message.includes("quota")) {
        errorMessage = "⏳ Rate limit exceeded. Please try again later or check your API quota.";
      } else if (error.message.includes("JSON")) {
        errorMessage = "🤖 The AI returned an invalid response. Please try asking again.";
      } else {
        errorMessage = `❌ Error: ${error.message || "Failed to process request."}`;
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
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
      openrouterApiKey,
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
    <div className="flex h-full w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300 overflow-hidden relative">
      {!hasConsented && <TermsModal onAccept={handleAcceptTerms} />}

      {/* Mobile Overlay */}
      {showHistory && (
        <div
          className="fixed inset-0 bg-black/50 z-30 sm:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setShowHistory(false)}
        />
      )}

      {/* History Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl sm:shadow-none",
        showHistory ? "translate-x-0" : "-translate-x-full"
      )}>
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
          href="https://github.com/sponsors/TrixCoder"
          title="Sponsored"
          description="Support development & get Pro features!"
        />
      </div>

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col h-full w-full transition-all duration-300 relative",
        showHistory ? "sm:ml-64" : "ml-0"
      )}>
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20 transition-all duration-300">
          <div className="flex items-center gap-3 overflow-hidden">
            <button onClick={() => setShowHistory(!showHistory)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors shrink-0">
              <Menu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="flex items-center gap-2.5 overflow-hidden group cursor-default">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <img src="/icons/icon48.png" alt="Logo" className="w-8 h-8 rounded-full shrink-0 relative z-10 shadow-sm" />
              </div>
              <h1 className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 truncate tracking-tight">AI Agent</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setShowReminders(!showReminders)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors relative group">
              <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
              {reminders.filter(r => r.status === 'pending').length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-white dark:ring-gray-900" />
              )}
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors group">
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors" />
            </button>
          </div>
        </header>

        {/* Reminders Panel */}
        {showReminders && (
          <div className="absolute top-14 right-3 z-50 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Bell className="w-4 h-4" /> Reminders
                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                  {reminders.filter(r => r.status === 'pending').length} pending
                </span>
              </h3>
              <button onClick={() => setShowReminders(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {(['all', 'pending', 'completed'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setReminderFilter(filter)}
                  className={cn(
                    "flex-1 py-2 text-xs font-medium capitalize transition-colors",
                    reminderFilter === filter
                      ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                      : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  )}
                >
                  {filter} ({filter === 'all'
                    ? reminders.length
                    : reminders.filter(r => r.status === filter).length})
                </button>
              ))}
            </div>

            <div className="max-h-72 overflow-y-auto">
              {reminders.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No reminders yet</p>
                  <p className="text-xs mt-1">Ask me: "Remind me to..."</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {reminders
                    .filter(r => reminderFilter === 'all' || r.status === reminderFilter)
                    .sort((a, b) => a.triggerAt - b.triggerAt)
                    .map(reminder => (
                      <div key={reminder.id} className={cn(
                        "p-3 flex items-start gap-3 transition-colors",
                        reminder.status === 'completed' ? "bg-green-50/50 dark:bg-green-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      )}>
                        {reminder.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        ) : (
                          <div className="relative">
                            <Clock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{reminder.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {reminder.status === 'pending' ? (
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                ⏳ In {Math.max(0, Math.ceil((reminder.triggerAt - Date.now()) / 1000))}s
                              </span>
                            ) : (
                              <span className="text-xs text-green-600 dark:text-green-400">
                                ✅ {new Date(reminder.triggerAt).toLocaleTimeString()}
                              </span>
                            )}
                            <span className="text-xs text-gray-400">
                              Set at {new Date(reminder.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {reminder.status === 'completed' && (
                            <button
                              onClick={() => {
                                // Snooze for 5 more minutes
                                const snoozeTime = 5 * 60;
                                setReminders(prev => prev.map(r =>
                                  r.id === reminder.id
                                    ? { ...r, status: 'pending' as const, triggerAt: Date.now() + (snoozeTime * 1000) }
                                    : r
                                ));
                                setTimeout(() => {
                                  setReminders(prev => prev.map(r =>
                                    r.id === reminder.id ? { ...r, status: 'completed' as const } : r
                                  ));
                                  const beep = new Audio('data:audio/wav;base64,UklGRnoAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUsAAACAgICAgICAgICAgIB/f39/f39/f39/f4CAgICAgICBgYGBgYGBgYGBgYGAgICAgICAgICAgIB/f39+fn5+fn5+f39/f4CAgA==');
                                  beep.play().catch(() => { });
                                  alert(`⏰ Reminder: ${reminder.message}`);
                                }, snoozeTime * 1000);
                              }}
                              className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 rounded text-xs"
                              title="Snooze 5 min"
                            >
                              🔄
                            </button>
                          )}
                          <button
                            onClick={() => setReminders(prev => prev.filter(r => r.id !== reminder.id))}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  {reminders.filter(r => reminderFilter === 'all' || r.status === reminderFilter).length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No {reminderFilter} reminders
                    </div>
                  )}
                </div>
              )}
            </div>

            {reminders.length > 0 && (
              <div className="p-2 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                <button
                  onClick={() => setReminders(prev => prev.filter(r => r.status !== 'completed'))}
                  className="flex-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded"
                >
                  Clear Completed
                </button>
                <button
                  onClick={() => setReminders([])}
                  className="flex-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-gray-900 rounded-3xl shadow-2xl border border-gray-700/50 overflow-hidden">
              {/* Header */}
              <div className="flex justify-between items-center p-6 pb-4">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="px-6 pb-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* API Keys Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-white">API Keys</h3>
                  {[
                    { label: 'Gemini API Key', value: geminiApiKey, setter: setGeminiApiKey },
                    { label: 'OpenAI API Key', value: openaiApiKey, setter: setOpenaiApiKey },
                    { label: 'Claude API Key', value: claudeApiKey, setter: setClaudeApiKey },
                    { label: 'Perplexity API Key', value: perplexityApiKey, setter: setPerplexityApiKey },
                    { label: 'OpenRouter API Key', value: openrouterApiKey, setter: setOpenrouterApiKey },
                  ].map(({ label, value, setter }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-sm text-gray-300 w-36 shrink-0">{label}</span>
                      <div className="flex-1 relative">
                        <input
                          type="password"
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          className="w-full p-2.5 pr-10 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          placeholder="Enter API Key..."
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Provider Section */}
                <div className="space-y-4 pt-4 border-t border-gray-700/50">
                  <h3 className="font-semibold text-white">Custom Provider</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-300 w-36 shrink-0">Base URL</span>
                      <input type="text" value={customBaseUrl} onChange={(e) => setCustomBaseUrl(e.target.value)} className="flex-1 p-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 outline-none" placeholder="https://api.example.com/v1" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-300 w-36 shrink-0">Model Name</span>
                      <input type="text" value={customModelName} onChange={(e) => setCustomModelName(e.target.value)} className="flex-1 p-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 outline-none" placeholder="custom-model-001" />
                    </div>
                  </div>
                </div>

                {/* Memory Section */}
                <div className="space-y-4 pt-4 border-t border-gray-700/50">
                  <h3 className="font-semibold text-white">Memory</h3>
                  <div className="space-y-2">
                    {memory.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
                        <span className="text-sm text-gray-200">
                          <span className="text-gray-400">{item.key}:</span> {item.value}
                        </span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => removeMemory(idx)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const key = prompt('Enter key (e.g., Name):');
                        const value = prompt('Enter value:');
                        if (key && value) {
                          setMemory(prev => [...prev, { key, value }]);
                        }
                      }}
                      className="w-full p-3 border border-dashed border-gray-600 rounded-xl text-blue-400 hover:bg-gray-800/50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                </div>

                {/* Save Button */}
                <button onClick={saveSettings} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-medium transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50">
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Model Selector */}
        <div className="flex flex-col bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-2 p-2">
            {(['gemini', 'openai', 'claude', 'perplexity', 'openrouter', 'custom'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setSelectedModel(m); chrome.storage.sync.set({ selectedModel: m }); }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 border",
                  selectedModel === m
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 border-transparent"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                )}
              >
                {m === 'openrouter' ? 'OpenRouter' : m}
              </button>
            ))}
          </div>
          {selectedModel !== 'custom' && (
            <div className="px-2 pb-2">
              <select
                value={selectedModelId}
                onChange={(e) => { setSelectedModelId(e.target.value); chrome.storage.sync.set({ selectedModelId: e.target.value }); }}
                className="w-full p-2 text-xs rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer appearance-none"
                style={{ maxHeight: '200px' }}
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
                <div className={cn("rounded-2xl p-4 shadow-sm relative group", msg.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-tl-none")}>
                  {/* Display Attachments for User Messages */}
                  {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {msg.attachments.map((att, idx) => (
                        att.type === 'image' ? (
                          <img key={idx} src={att.content} alt={att.name} className="max-w-[100px] max-h-[100px] rounded-lg border border-white/30" />
                        ) : (
                          <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded text-xs">
                            <FileText className="w-3 h-3" />
                            <span className="truncate max-w-[80px]">{att.name}</span>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                  {msg.image && (
                    <img src={msg.image} alt="Uploaded" className="max-w-full h-auto rounded-lg mb-2" />
                  )}
                  <MarkdownMessage content={msg.content} />

                  {/* Copy Button */}
                  <button
                    onClick={() => copyToClipboard(msg.content)}
                    className="absolute top-2 right-2 p-1 rounded bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Copy"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
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
          {/* Attachment Previews */}
          {attachments.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {attachments.map((att, idx) => (
                <div key={idx} className="relative group">
                  {att.type === 'image' ? (
                    <img src={att.content} alt={att.name} className="w-16 h-16 object-cover rounded-xl border border-gray-200 dark:border-gray-700" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center p-1">
                      <FileText className="w-6 h-6 text-gray-500 dark:text-gray-400 mb-1" />
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">{att.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {attachments.length < 5 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          <div className="relative flex items-end gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-2xl border border-gray-200 dark:border-gray-700 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shadow-inner">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "p-2 rounded-xl transition-colors",
                attachments.length > 0
                  ? "text-blue-500 bg-blue-100 dark:bg-blue-900/30"
                  : "text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
              title={`Add files (${attachments.length}/5)`}
            >
              <Paperclip className="w-5 h-5" />
            </button>
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
            <button onClick={handleSend} disabled={isLoading || (!input.trim() && attachments.length === 0)} className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-600/20"><Send className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainApp;
