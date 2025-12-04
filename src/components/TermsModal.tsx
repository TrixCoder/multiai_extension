import { useState } from 'react';
import { Shield, Lock, CheckCircle } from 'lucide-react';

interface TermsModalProps {
    onAccept: () => void;
}

export function TermsModal({ onAccept }: TermsModalProps) {
    const [canAccept, setCanAccept] = useState(false);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // Allow acceptance when scrolled near the bottom
        if (scrollHeight - scrollTop - clientHeight < 50) {
            setCanAccept(true);
        }
    };

    return (
        <div className="absolute inset-0 z-50 bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-700 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-700 flex items-center gap-3">
                    <div className="bg-blue-900/30 p-2 rounded-lg">
                        <Shield className="w-6 h-6 text-blue-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Terms & Privacy</h2>
                </div>

                <div
                    className="p-6 overflow-y-auto text-gray-300 text-sm space-y-4 leading-relaxed scrollbar-thin scrollbar-thumb-gray-600"
                    onScroll={handleScroll}
                >
                    <p className="font-semibold text-white">Welcome to Multimodal AI Browser Agent.</p>
                    <p>
                        Before you continue, please read and accept our Terms of Service and Privacy Policy.
                        We value your privacy and transparency.
                    </p>

                    <h3 className="text-white font-semibold mt-4 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-emerald-400" /> Data Collection
                    </h3>
                    <p>
                        To provide you with advanced AI capabilities, we collect certain data from your browsing session, including:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-gray-400">
                        <li>Content of the active tab (text and HTML).</li>
                        <li>Screenshots of the active tab (for visual context).</li>
                        <li>List of open tabs (for navigation).</li>
                        <li>Chat history and interactions with the AI.</li>
                    </ul>

                    <h3 className="text-white font-semibold mt-4">Data Usage</h3>
                    <p>
                        This data is used solely to:
                        1. Process your requests via Gemini or OpenAI APIs.
                        2. Improve the performance and accuracy of our AI models.
                    </p>
                    <p>
                        We may store anonymized usage data in our secure databases. Your personal API keys are stored locally on your device.
                    </p>

                    <h3 className="text-white font-semibold mt-4">Agreement</h3>
                    <p>
                        By clicking "Accept & Continue", you acknowledge that you have read this policy and consent to the collection and processing of your data as described above.
                    </p>

                    {/* Spacer to force scroll */}
                    <div className="h-4"></div>
                </div>

                <div className="p-6 border-t border-gray-700 bg-gray-800/50">
                    <button
                        onClick={onAccept}
                        disabled={!canAccept}
                        className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${canAccept
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {canAccept ? (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                Accept & Continue
                            </>
                        ) : (
                            'Scroll to Read All'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
