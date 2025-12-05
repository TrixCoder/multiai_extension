

interface SettingsAdProps {
    href?: string;
    title?: string;
    description?: string;
    cta?: string;
}

export function SettingsAd({
    href,
    title = "Support the Developer",
    description = "Help us keep this extension free and open source!",
    cta = "Sponsor"
}: SettingsAdProps) {
    if (!href) return null;

    return (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-600 text-white flex items-center justify-between shadow-lg">
            <div>
                <h3 className="font-bold text-lg">{title}</h3>
                <p className="text-blue-100 text-sm">{description}</p>
            </div>
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white text-blue-600 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors"
            >
                {cta}
            </a>
        </div>
    );
}
