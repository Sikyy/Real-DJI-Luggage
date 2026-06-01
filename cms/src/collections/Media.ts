import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'alt',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      type: 'textarea',
    },
  ],
  upload: {
    staticDir: 'media',
  },
  labels: {
    plural: {
      en: 'Media',
      zh: '媒体',
    },
    singular: {
      en: 'Media',
      zh: '媒体',
    },
  },
}
