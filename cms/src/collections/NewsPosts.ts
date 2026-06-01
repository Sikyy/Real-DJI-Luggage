import type { CollectionConfig } from 'payload'

export const NewsPosts: CollectionConfig = {
  slug: 'news-posts',
  access: {
    read: () => true,
  },
  admin: {
    defaultColumns: ['title', 'category', 'author', 'publishedAt', 'status'],
    group: {
      en: 'Content',
      zh: '内容',
    },
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'News', value: 'news' },
        { label: 'Insights', value: 'insights' },
      ],
      required: true,
    },
    {
      name: 'excerpt',
      type: 'textarea',
      required: true,
    },
    {
      name: 'author',
      type: 'text',
      required: true,
    },
    {
      name: 'intro',
      type: 'textarea',
      required: true,
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'externalCoverImageUrl',
      type: 'text',
    },
    {
      name: 'content',
      type: 'richText',
      admin: {
        description: 'Optional rich text for future-rendered article bodies.',
      },
    },
    {
      name: 'contentSections',
      type: 'array',
      fields: [
        {
          name: 'heading',
          type: 'text',
          required: true,
        },
        {
          name: 'body',
          type: 'textarea',
          required: true,
        },
      ],
      required: true,
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      required: true,
    },
  ],
  versions: {
    drafts: true,
  },
  labels: {
    plural: {
      en: 'News Posts',
      zh: '新闻文章',
    },
    singular: {
      en: 'News Post',
      zh: '新闻文章',
    },
  },
}
