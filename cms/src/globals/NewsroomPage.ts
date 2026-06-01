import type { GlobalConfig } from 'payload'

export const NewsroomPage: GlobalConfig = {
  slug: 'newsroom-page',
  access: {
    read: () => true,
  },
  admin: {
    group: {
      en: 'Pages',
      zh: '页面',
    },
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Hero',
          fields: [
            {
              name: 'metaTitle',
              type: 'text',
              defaultValue: 'Insights - DJI Luggage',
            },
            {
              name: 'hero',
              type: 'group',
              fields: [
                {
                  name: 'title',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'descriptions',
                  type: 'array',
                  fields: [
                    {
                      name: 'body',
                      type: 'textarea',
                      required: true,
                    },
                  ],
                  required: true,
                },
              ],
            },
          ],
        },
        {
          label: 'Filters',
          fields: [
            {
              name: 'filters',
              type: 'array',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'value',
                  type: 'select',
                  options: [
                    { label: 'All', value: 'all' },
                    { label: 'Insights', value: 'insights' },
                    { label: 'News', value: 'news' },
                  ],
                  required: true,
                },
              ],
              required: true,
            },
            {
              name: 'posts',
              type: 'relationship',
              hasMany: true,
              relationTo: 'news-posts',
            },
          ],
        },
        {
          label: 'Final CTA',
          fields: [
            {
              name: 'finalCta',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: "Let's Get To Work",
                },
                {
                  name: 'heading',
                  type: 'textarea',
                },
                {
                  name: 'buttonLabel',
                  type: 'text',
                  defaultValue: 'Contact Us',
                },
                {
                  name: 'buttonUrl',
                  type: 'text',
                  defaultValue: '/contact',
                },
                {
                  name: 'backgroundImage',
                  type: 'upload',
                  relationTo: 'media',
                },
                {
                  name: 'externalBackgroundImageUrl',
                  type: 'text',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  label: {
    en: 'Newsroom Page',
    zh: '新闻中心页',
  },
}
