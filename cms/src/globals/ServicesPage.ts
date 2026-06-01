import type { GlobalConfig } from 'payload'

export const ServicesPage: GlobalConfig = {
  slug: 'services-page',
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
              defaultValue: 'Manufacturing Services - DJI Luggage',
            },
            {
              name: 'hero',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'Manufacturing',
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
                {
                  name: 'backgroundImage',
                  type: 'upload',
                  relationTo: 'media',
                },
                {
                  name: 'externalBackgroundImageUrl',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'imageAlt',
                  type: 'text',
                  defaultValue: 'Warehouse shelving',
                },
              ],
            },
          ],
        },
        {
          label: 'Focus',
          fields: [
            {
              name: 'focus',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'Our Focus',
                  required: true,
                },
                {
                  name: 'heading',
                  type: 'textarea',
                  required: true,
                },
                {
                  name: 'paragraphs',
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
          label: 'Aerial Image',
          fields: [
            {
              name: 'aerial',
              type: 'group',
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                },
                {
                  name: 'externalImageUrl',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'imageAlt',
                  type: 'text',
                  defaultValue: 'Highway aerial view',
                },
                {
                  name: 'labels',
                  type: 'array',
                  fields: [
                    {
                      name: 'label',
                      type: 'text',
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
          label: 'Manufacturing Services',
          fields: [
            {
              name: 'services',
              type: 'group',
              fields: [
                {
                  name: 'heading',
                  type: 'text',
                  defaultValue: 'Manufacturing Services',
                  required: true,
                },
                {
                  name: 'items',
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
                    {
                      name: 'image',
                      type: 'upload',
                      relationTo: 'media',
                    },
                    {
                      name: 'externalImageUrl',
                      type: 'text',
                      required: true,
                    },
                    {
                      name: 'imageAlt',
                      type: 'text',
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
          label: 'Industries',
          fields: [
            {
              name: 'industries',
              type: 'group',
              fields: [
                {
                  name: 'title',
                  type: 'text',
                  defaultValue: 'Industries We Cover',
                  required: true,
                },
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                },
                {
                  name: 'externalImageUrl',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'imageAlt',
                  type: 'text',
                  defaultValue: 'Warehouse interior',
                },
                {
                  name: 'items',
                  type: 'array',
                  fields: [
                    {
                      name: 'name',
                      type: 'text',
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
    en: 'Services Page',
    zh: '服务页',
  },
}
