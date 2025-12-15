import React from 'react';
import { useTranslation, Language } from '../i18n/i18n';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';

const LANG_LABELS: Record<Language, string> = {
    en: 'English',
    sk: 'Slovenčina',
    cz: 'Čeština',
};

export default function LanguageSelector() {
    const { lang, setLanguage, t } = useTranslation();

    const handleChange = (e: SelectChangeEvent<string>) => {
        setLanguage(e.target.value as Language);
    };

    return (
        <FormControl
            size="small"
            variant="standard"
            sx={{ minWidth: 140, alignSelf: 'flex-end', gap: 1 }}
        >
            <InputLabel id="language-select-label" sx={{ fontSize: 12 }}>
                {t('components.languageSelector', 'Lang')}
            </InputLabel>
            <Select
                labelId="language-select-label"
                id="language-select"
                value={lang}
                label={t('components.languageSelector', 'Lang')}
                onChange={handleChange}
            >
                <MenuItem value="en">{LANG_LABELS.en}</MenuItem>
                <MenuItem value="sk">{LANG_LABELS.sk}</MenuItem>
                <MenuItem value="cz">{LANG_LABELS.cz}</MenuItem>
            </Select>
        </FormControl>
    );
}