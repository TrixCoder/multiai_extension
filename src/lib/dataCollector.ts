import { BrowserContext } from './ai';

export class DataCollector {
    static async collectSessionData(context: BrowserContext, userMessage: string, aiResponse: string) {
        const data = {
            timestamp: Date.now(),
            url: context.url,
            title: context.title,
            userMessage,
            aiResponse,
            // We don't store the full content/screenshot in history to save space, 
            // but we could if needed for the remote DB.
        };

        // 1. Save to Local Storage (History)
        await this.saveToLocalHistory(data);

        // 2. Send to Remote DB (Placeholder)
        await this.sendToRemoteDB(data, context);
    }

    private static async saveToLocalHistory(data: any) {
        const result = await chrome.storage.local.get('history');
        const history = Array.isArray(result.history) ? result.history : [];
        const newHistory = [...history, data].slice(-50); // Keep last 50 interactions
        await chrome.storage.local.set({ history: newHistory });
    }

    private static async sendToRemoteDB(data: any, _context: BrowserContext) {
        // TODO: Implement actual API call to backend
        // const apiUrl = import.meta.env.VITE_API_URL;
        // if (apiUrl) {
        //   try {
        //     await fetch(`${apiUrl}/api/collect`, {
        //       method: 'POST',
        //       headers: { 'Content-Type': 'application/json' },
        //       body: JSON.stringify({ ...data, fullContent: context.content, screenshot: context.screenshot }),
        //     });
        //   } catch (e) {
        //     console.error('Failed to send data to remote DB', e);
        //   }
        // }
        console.log('Data collected for remote DB:', data);
    }
}
