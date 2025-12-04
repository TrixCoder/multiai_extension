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
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                {content}
            </ReactMarkdown>
        </div>
    );
}
