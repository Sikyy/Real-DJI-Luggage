import type { GlobalConfig } from 'payload'

export const HomePage: GlobalConfig = {
  slug: 'home-page',
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
              defaultValue: 'DJI Luggage - Indonesian Luggage Manufacturer',
            },
            {
              name: 'hero',
              type: 'group',
              fields: [
                {
                  name: 'breadcrumb',
                  type: 'text',
                  defaultValue: 'Home',
                  required: true,
                },
                {
                  name: 'title',
                  type: 'textarea',
                  required: true,
                },
                {
                  name: 'description',
                  type: 'textarea',
                  required: true,
                },
                {
                  name: 'buttonLabel',
                  type: 'text',
                  defaultValue: 'Get a Quote',
                  required: true,
                },
                {
                  name: 'buttonUrl',
                  type: 'text',
                  defaultValue: '/contact',
                  required: true,
                },
                {
                  name: 'videoUrl',
                  type: 'text',
                },
                {
                  name: 'posterUrl',
                  type: 'text',
                },
              ],
            },
          ],
        },
        {
          label: 'Services',
          fields: [
            {
              name: 'services',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'What We Do',
                  required: true,
                },
                {
                  name: 'heading',
                  type: 'textarea',
                  required: true,
                },
                {
                  name: 'cards',
                  type: 'array',
                  fields: [
                    {
                      name: 'title',
                      type: 'text',
                      required: true,
                    },
                    {
                      name: 'description',
                      type: 'textarea',
                      required: true,
                    },
                  ],
                  required: true,
                },
                {
                  name: 'buttonLabel',
                  type: 'text',
                  defaultValue: 'Learn More',
                },
                {
                  name: 'buttonUrl',
                  type: 'text',
                  defaultValue: '/services',
                },
              ],
            },
          ],
        },
        {
          label: 'Values',
          fields: [
            {
              name: 'values',
              type: 'array',
              fields: [
                {
                  name: 'number',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'title',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'description',
                  type: 'textarea',
                  required: true,
                },
              ],
              required: true,
            },
          ],
        },
        {
          label: 'Technology CTA',
          fields: [
            {
              name: 'technologyCta',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'Our Technology',
                  required: true,
                },
                {
                  name: 'headingHtml',
                  type: 'code',
                  admin: {
                    description:
                      'HTML is used here so inline image chips can preserve the Framer-style headline.',
                    language: 'html',
                  },
                  required: true,
                },
                {
                  name: 'buttonLabel',
                  type: 'text',
                  defaultValue: 'Explore Platform',
                },
                {
                  name: 'buttonUrl',
                  type: 'text',
                  defaultValue: '/platform',
                },
              ],
            },
          ],
        },
        {
          label: 'How We Work',
          fields: [
            {
              name: 'howWeWork',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'How We Work',
                  required: true,
                },
                {
                  name: 'body',
                  type: 'textarea',
                  required: true,
                },
                {
                  name: 'steps',
                  type: 'array',
                  fields: [
                    {
                      name: 'number',
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
              ],
            },
          ],
        },
        {
          label: 'Newsroom',
          fields: [
            {
              name: 'newsroom',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'Recent Articles',
                  required: true,
                },
                {
                  name: 'heading',
                  type: 'text',
                  defaultValue: 'Newsroom',
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
    en: 'Home Page',
    zh: '首页',
  },
}
