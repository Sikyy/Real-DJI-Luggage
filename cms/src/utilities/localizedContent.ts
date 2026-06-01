import type { CollectionConfig, GlobalConfig } from 'payload'

type FieldLike = Record<string, unknown>

type LocalizableConfig = CollectionConfig | GlobalConfig

const localizableFieldTypes = new Set(['code', 'richText', 'text', 'textarea'])

const nonContentSlugs = new Set(['contact-submissions', 'users'])

const excludedFieldNames = new Set([
  'brandName',
  'buttonUrl',
  'destinationUrl',
  'email',
  'externalBackgroundImageUrl',
  'externalCoverImageUrl',
  'externalHeroImageUrl',
  'externalIconUrl',
  'externalImageUrl',
  'externalLogoImageUrl',
  'externalUrl',
  'globeVideoUrl',
  'logoHref',
  'logoLabel',
  'posterUrl',
  'requestQuoteUrl',
  'slug',
  'sourceSymbolId',
  'sourceUrl',
  'svgMarkup',
  'url',
  'videoUrl',
  'viewBox',
])

function hasChildFields(field: FieldLike): field is FieldLike & { fields: FieldLike[] } {
  return Array.isArray(field.fields)
}

function hasTabs(field: FieldLike): field is FieldLike & { tabs: Array<FieldLike & { fields?: FieldLike[] }> } {
  return Array.isArray(field.tabs)
}

function shouldLocalize(field: FieldLike) {
  if (field.localized !== undefined) return false
  if (typeof field.name !== 'string') return false
  if (!localizableFieldTypes.has(String(field.type))) return false
  if (excludedFieldNames.has(field.name)) return false
  if (/Url$/.test(field.name) || /URL$/.test(field.name)) return false
  if (/^external/.test(field.name)) return false
  return true
}

function localizeField(field: FieldLike): FieldLike {
  const next: FieldLike = { ...field }

  if (hasTabs(next)) {
    next.tabs = next.tabs.map((tab) => ({
      ...tab,
      fields: Array.isArray(tab.fields) ? tab.fields.map(localizeField) : tab.fields,
    }))
  }

  if (hasChildFields(next)) {
    next.fields = next.fields.map(localizeField)
  }

  if (shouldLocalize(next)) {
    next.localized = true
  }

  return next
}

export function withLocalizedContent<TConfig extends LocalizableConfig>(config: TConfig): TConfig {
  const configWithFields = config as TConfig & { fields?: FieldLike[] }
  if (nonContentSlugs.has(config.slug) || !Array.isArray(configWithFields.fields)) return config

  return {
    ...config,
    fields: configWithFields.fields.map(localizeField),
  } as TConfig
}
