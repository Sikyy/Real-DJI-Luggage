import type { CollectionConfig } from 'payload'

export const TrustedLogos: CollectionConfig = {
  slug: 'trusted-logos',
  access: {
    read: () => true,
  },
  admin: {
    defaultColumns: ['name', 'sourceType', 'sortOrder', 'isActive'],
    group: {
      en: 'About',
      zh: '关于',
    },
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'sourceType',
      type: 'select',
      defaultValue: 'inlineSvg',
      options: [
        { label: 'Payload Media', value: 'media' },
        { label: 'External URL', value: 'externalUrl' },
        { label: 'Inline SVG', value: 'inlineSvg' },
        { label: 'Source Symbol Reference', value: 'sourceSymbol' },
      ],
      required: true,
    },
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      admin: {
        condition: (_, siblingData) => siblingData?.sourceType === 'media',
      },
    },
    {
      name: 'externalUrl',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.sourceType === 'externalUrl',
      },
    },
    {
      name: 'svgMarkup',
      type: 'code',
      admin: {
        condition: (_, siblingData) => siblingData?.sourceType === 'inlineSvg',
        language: 'html',
      },
    },
    {
      name: 'sourceSymbolId',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.sourceType === 'sourceSymbol',
        description: 'Matches the symbol ID currently embedded in the static about page.',
      },
    },
    {
      name: 'viewBox',
      type: 'text',
      admin: {
        description: 'SVG viewBox for inline SVG or source symbol rendering.',
      },
    },
    {
      name: 'destinationUrl',
      type: 'text',
      admin: {
        description: 'Optional customer URL when logo clicks are enabled.',
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      required: true,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
  labels: {
    plural: {
      en: 'Trusted Logos',
      zh: '合作品牌 Logo',
    },
    singular: {
      en: 'Trusted Logo',
      zh: '合作品牌 Logo',
    },
  },
}
