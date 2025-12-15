import React from "react";
import en from "./en.json";
import sk from "./sk.json";
import cz from "./cz.json";

export type Language = "en" | "sk" | "cz";
export interface Translations {
    [key: string]: string | Translations;
}

const LOCALE_KEY = "app_locale";

const bundles: Record<Language, Translations> = {
    en: en as unknown as Translations,
    sk: sk as unknown as Translations,
    cz: cz as unknown as Translations,
};

interface I18nContextValue {
    lang: Language;
    setLanguage: (l: Language) => void;
    t: (key: string, fallback?: string) => string;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

const getNested = (obj: Translations | undefined, key: string): string | undefined => {
    if (!obj) return undefined;
    const parts = key.split(".");
    let cur: string | Translations | undefined = obj;
    for (const p of parts) {
        if (typeof cur === "string") return undefined;
        cur = (cur as Translations)[p];
        if (cur === undefined) return undefined;
    }
    return typeof cur === "string" ? cur : undefined;
};

export const I18nProvider: React.FC<{ defaultLang?: Language; children: React.ReactNode }> = ({
                                                                                                  defaultLang,
                                                                                                  children,
                                                                                              }) => {
    const getInitial = (): Language => {
        const saved = (typeof window !== "undefined" && localStorage.getItem(LOCALE_KEY)) as Language | null;
        if (saved && (saved === "en" || saved === "sk" || saved === "cz")) return saved;
        const nav = typeof navigator !== "undefined" ? navigator.language.split("-")[0] : "en";
        if (nav === "sk") return "sk";
        if (nav === "cs" || nav === "cz") return "cz";
        return (defaultLang as Language) || "en";
    };

    const [lang, setLang] = React.useState<Language>(getInitial);

    React.useEffect(() => {
        try {
            localStorage.setItem(LOCALE_KEY, lang);
        } catch {}
    }, [lang]);

    const t = React.useCallback(
        (key: string, fallback?: string) => {
            const primary = getNested(bundles[lang], key);
            if (primary) return primary;
            const enFallback = getNested(bundles.en, key);
            return enFallback ?? fallback ?? key;
        },
        [lang]
    );

    const value = React.useMemo(() => ({ lang, setLanguage: setLang, t }), [lang, t]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = (): { t: (k: string, fallback?: string) => string; lang: Language; setLanguage: (l: Language) => void } => {
    const ctx = React.useContext(I18nContext);
    if (!ctx) throw new Error("useTranslation must be used inside I18nProvider");
    return { t: ctx.t, lang: ctx.lang, setLanguage: ctx.setLanguage };
};