import { useState } from 'react';
import { X, ExternalLink } from 'lucide-react';

interface AdBannerProps {
  href?: string;
  title?: string;
  description?: string;
}

export function AdBanner({
  href,
  title = "Sponsored",
  description = "Support development & get Pro features!"
}: AdBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || !href) return null;

  return (
    <div className="mt-auto p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
      <div className="relative group">
        <button
          onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
          className="absolute -top-2 -right-2 p-1 bg-gray-200 dark:bg-gray-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-300 dark:hover:bg-gray-600"
          title="Dismiss Ad"
        >
          <X className="w-3 h-3 text-gray-500 dark:text-gray-400" />
        </button>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-xl">
              🚀
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-0.5">{title}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight">
                {description}
              </p>
              <div className="flex items-center gap-1 mt-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                Learn more <ExternalLink className="w-3 h-3" />
              </div>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
