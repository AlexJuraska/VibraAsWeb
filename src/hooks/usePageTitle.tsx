import { useEffect } from "react";
import { useTranslation } from "../i18n/i18n";

export function usePageTitle(
    titleKey?: string,
    fallback?: string
) {
    const { t, lang } = useTranslation();

    useEffect(() => {
        if (!titleKey && fallback) {
            document.title = fallback;
        } else if (titleKey) {
            document.title = t(titleKey, fallback);
        }
    }, [titleKey, fallback, t, lang]);
}
