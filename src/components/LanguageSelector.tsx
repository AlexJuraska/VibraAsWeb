import React from 'react';
import { useTranslation, Language } from '../i18n/i18n';

const LANG_LABELS: Record<Language, string> = {
    en: 'English',
    sk: 'Slovenčina',
    cz: 'Čeština',
};

export default function LanguageSelector() {
    const { lang, setLanguage, t } = useTranslation();

    const onChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
        setLanguage(e.target.value as Language);
    };

    return (
        <label style={{ display: 'inline-flex', alignSelf: "flex-end", gap: 8 }}>
            <span style={{ fontSize: 12 }}>{t('components.languageSelector', 'Lang')}:</span>
            <select
                value={lang}
                onChange={onChange}
            >
                <option value="en">{LANG_LABELS.en}</option>
                <option value="sk">{LANG_LABELS.sk}</option>
                <option value="cz">{LANG_LABELS.cz}</option>
            </select>
        </label>
    );
}