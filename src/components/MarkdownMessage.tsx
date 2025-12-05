import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css'; // Or any other style

interface MarkdownMessageProps {
    content: string;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
    if (!content || !content.trim()) return null;

    return (
        <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            <ReactMarkdown
                rehypePlugins={[rehypeHighlight]}
                components={{
                    img: ({ node, ...props }) => (
                        <div className="relative group inline-block">
                            <img {...props} className="rounded-lg max-w-full h-auto" />
                            <a
                                href={props.src}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Download Image"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                            </a>
                        </div>
                    )
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
