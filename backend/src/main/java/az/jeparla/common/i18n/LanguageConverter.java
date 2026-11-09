package az.jeparla.common.i18n;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Maps {@link Language} to the lowercase codes of the {@code users_preferred_locale} CHECK. */
@Converter
public class LanguageConverter implements AttributeConverter<Language, String> {

    @Override
    public String convertToDatabaseColumn(Language language) {
        return language == null ? null : language.code();
    }

    @Override
    public Language convertToEntityAttribute(String code) {
        return code == null ? null : Language.fromCode(code);
    }
}
